#!/usr/bin/env python3
"""Dasha Compute fine-tune engine backend: `cuda` (Nvidia GPUs, Unsloth).

Implements the engine-backend interface documented in finetune_runner.py:

    ENGINE_ID = "cuda"
    generate_config(spec, ctx) -> {"command", "config_path", "config_text"}
    run(config, ctx) -> dict   # terminal result incl. "engine": "cuda"
    report_telemetry(coordinator, token, job_id, update) -> dict
    doctor() -> int
    is_ready() -> bool         # extra: GPU + driver + capability gating

The backend NEVER executes client-supplied code, shell, or YAML. It only
ever runs one fixed command — `python3 <generated train.py>` — where
train.py is generated deterministically by generate_config() from the
validated spec using the pinned Unsloth stack. Requires an Nvidia GPU with
compute capability >= 8.0 (bf16), CUDA 12.x driver, and the pinned
`unsloth` version (see cuda/Dockerfile + CUDA-SANDBOX.md).

Canonical artifact: Unsloth writes standard PEFT-format safetensors
(`adapter_model.safetensors` + `adapter_config.json`), which is the
canonical cross-engine adapter format per FINETUNE-JOB-SPEC.md §"Artifact
canonical format". The MLX serving lane converts at its boundary.

This module must import WITHOUT torch/unsloth installed: the heavy
dependencies live only inside the generated training script (and the
optional Docker image). Import-time GPU probing is cached and cheap.
"""

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time

import finetune_runner as core

ENGINE_ID = "cuda"

# Pinned Unsloth version. VERIFY against PyPI before building the image or
# cutting a provider release — Unsloth is fast-moving and the API surface
# used by the generated script (FastLanguageModel.get_peft_model with
# use_dora, train_on_responses_only) must exist in the pinned release.
# Kept in sync with compute/provider/cuda/Dockerfile (ARG UNSLOTH_VERSION).
UNSLOTH_PIN = "2026.2.1"

CUDA_MIN_VERSION = (12, 0)
MIN_COMPUTE_CAPABILITY = (8, 0)   # bf16 training needs Ampere+
VRAM_RESERVE_GB = 2.0             # desktop/compositor reserve (spec §Capability)

# Provider-side base-model allowlist (defense in depth; the server's MODELS +
# license gate is authoritative). Pins (base, quant, engine) triples: these
# are Unsloth's 4-bit pre-quantized repos, so QLoRA is automatic and the
# adapter is only valid against exactly this base+quant.
BASE_MODELS = {
    "qwen3-1.7b": {"repo": "unsloth/Qwen3-1.7B", "size_tier": "1b", "min_vram_gb": 6},
    "qwen3-4b": {"repo": "unsloth/Qwen3-4B", "size_tier": "3b", "min_vram_gb": 8},
    "qwen3-8b": {"repo": "unsloth/Qwen3-8B", "size_tier": "8b", "min_vram_gb": 12},
    "qwen3-32b": {"repo": "unsloth/Qwen3-32B", "size_tier": "32b", "min_vram_gb": 32},
    "gemma3-4b": {"repo": "unsloth/gemma-3-4b-it", "size_tier": "3b", "min_vram_gb": 8},
}

# lora_layers -> target modules. Deterministic; fixed by the backend, not
# the client. 16 = all linear layers, 8 = attention only, 4 = q/v only.
TARGET_MODULES_BY_LAYERS = {
    16: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    8: ["q_proj", "k_proj", "v_proj", "o_proj"],
    4: ["q_proj", "v_proj"],
}

# Fixed fields the client cannot change (mirrors the mlx lane's fixed set).
FIXED_TRAINING_FIELDS = {
    "load_in_4bit": True,
    "lora_dropout": 0,
    "bias": "none",
    "use_gradient_checkpointing": "unsloth",
    "optim": "paged_adamw_8bit",
    "lr_scheduler_type": "cosine",
    "warmup_ratio": 0.03,
    "logging_steps": 10,
    "eval_steps": 100,
    "report_to": "none",
}


# ---------------------------------------------------------------------------
# GPU probing (cheap, cached; stdlib only)
# ---------------------------------------------------------------------------

_PROBE_CACHE = {}


def _parse_version(text):
    match = re.search(r"(\d+)\.(\d+)", str(text or ""))
    if not match:
        return None
    return (int(match.group(1)), int(match.group(2)))


def _probe_gpu():
    """Return {model, vram_gb, cuda_version, driver_version,
    compute_capability} or None when no usable Nvidia GPU is present.

    DASHA_CUDA_FAKE_PROBE (JSON) overrides the probe — test-only seam.
    Never rely on it outside tests: advertisement is provider-claimed and
    the coordinator treats it as untrusted either way.
    """
    if "probe" in _PROBE_CACHE:
        return _PROBE_CACHE["probe"]
    probe = _do_probe()
    _PROBE_CACHE["probe"] = probe
    return probe


def _do_probe():
    fake = os.environ.get("DASHA_CUDA_FAKE_PROBE")
    if fake:
        try:
            parsed = json.loads(fake)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    if shutil.which("nvidia-smi") is None:
        return None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,driver_version,cuda_version",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=15)
    except Exception:
        return None
    if out.returncode != 0 or not out.stdout.strip():
        return None
    parts = [p.strip() for p in out.stdout.strip().split("\n")[0].split(",")]
    if len(parts) < 4:
        return None
    name, mem_mb, driver, cuda = parts[0], parts[1], parts[2], parts[3]
    try:
        vram_gb = round(float(mem_mb) / 1024, 1)
    except ValueError:
        return None
    cuda_version = _parse_version(cuda)
    if cuda_version is None:
        # Fallback: parse the "CUDA Version: X.Y" header line.
        try:
            header = subprocess.run(["nvidia-smi"], capture_output=True,
                                    text=True, timeout=15).stdout
            cuda_version = _parse_version(
                re.search(r"CUDA Version:\s*([0-9.]+)", header).group(1))
        except Exception:
            cuda_version = None
    return {
        "model": name[:96],
        "vram_gb": vram_gb,
        "cuda_version": f"{cuda_version[0]}.{cuda_version[1]}" if cuda_version else None,
        "driver_version": driver[:32],
        "compute_capability": _compute_capability(),
    }


def _compute_capability():
    """'8.9' style string, or None when it cannot be determined."""
    try:
        import torch
        if torch.cuda.is_available():
            major, minor = torch.cuda.get_device_capability(0)
            return f"{major}.{minor}"
    except Exception:
        pass
    try:
        from pynvml import (nvmlDeviceGetCudaComputeCapability,
                            nvmlDeviceGetHandleByIndex, nvmlInit)
        nvmlInit()
        major, minor = nvmlDeviceGetCudaComputeCapability(nvmlDeviceGetHandleByIndex(0))
        return f"{int(major)}.{int(minor)}"
    except Exception:
        return None


def _capability_tuple(capability):
    try:
        major, minor = str(capability).split(".")
        return (int(major), int(minor))
    except Exception:
        return None


def is_ready():
    """True when this machine can actually train on CUDA right now."""
    probe = _probe_gpu()
    if not probe:
        return False
    cuda_version = _parse_version(probe.get("cuda_version"))
    if cuda_version is None or cuda_version < CUDA_MIN_VERSION:
        return False
    capability = _capability_tuple(probe.get("compute_capability"))
    if capability is None or capability < MIN_COMPUTE_CAPABILITY:
        return False
    return True


def gpu_info():
    """Sanitized gpu object for the poll payload, or None."""
    probe = _probe_gpu()
    if not probe or not is_ready():
        return None
    return {
        "model": str(probe.get("model") or "")[:96],
        "vram_gb": probe.get("vram_gb"),
        "cuda_version": probe.get("cuda_version"),
        "driver_version": str(probe.get("driver_version") or "")[:32],
        "compute_capability": probe.get("compute_capability"),
    }


# ---------------------------------------------------------------------------
# Deterministic training-script generation
# ---------------------------------------------------------------------------

def _script_literal(value):
    """Render a Python literal deterministically (no client strings ever)."""
    if isinstance(value, bool):
        return "True" if value else "False"
    if value is None:
        return "None"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return repr(value)
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(_script_literal(v) for v in value) + "]"
    raise TypeError(f"unsupported literal: {type(value)}")


def spec_to_train_script(spec, *, train_path, valid_path, adapter_dir,
                         checkpoint_dir, resume_from, dtype):
    """Generate the fixed Unsloth training script deterministically.

    The ONLY code this backend will ever execute. `spec` must already have
    passed core.sanitize_spec(). Every interpolated value comes from the
    sanitized spec, the allowlist, or the job context — never from raw
    client input.
    """
    base = BASE_MODELS[spec["base_model"]]
    target_modules = TARGET_MODULES_BY_LAYERS[spec["lora_layers"]]
    lora_alpha = spec["lora_rank"]  # matches the Unsloth reference (r == alpha)
    lines = [
        "#!/usr/bin/env python3",
        "# generated by dasha-compute finetune_runner_cuda — do not hand-edit",
        f"# spec_hash: {core.spec_hash(spec)}",
        f"# unsloth pin: {UNSLOTH_PIN} (see compute/provider/cuda/Dockerfile)",
        '"""Fixed Unsloth QLoRA runner. All config is baked in at generation',
        'time; this script reads no client-supplied code, YAML, or shell."""',
        "import json",
        "import os",
        "",
        "from unsloth import FastLanguageModel",
        "from unsloth.chat_templates import get_chat_template, train_on_responses_only",
        "from trl import SFTTrainer",
        "from transformers import TrainingArguments",
        "from datasets import Dataset",
        "",
        f"MODEL_REPO = {_script_literal(base['repo'])}",
        f"MAX_SEQ_LENGTH = {_script_literal(spec['max_seq_length'])}",
        f"LORA_RANK = {_script_literal(spec['lora_rank'])}",
        f"LORA_ALPHA = {_script_literal(lora_alpha)}",
        f"TARGET_MODULES = {_script_literal(target_modules)}",
        f"USE_DORA = {_script_literal(spec['finetune_type'] == 'dora')}",
        f"ITERS = {_script_literal(spec['iters'])}",
        f"LEARNING_RATE = {_script_literal(spec['learning_rate'])}",
        f"BATCH_SIZE = {_script_literal(spec['batch_size'])}",
        f"GRAD_ACCUM = {_script_literal(spec['grad_accumulation_steps'])}",
        f"SEED = {_script_literal(spec['seed'])}",
        f"SAVE_EVERY = {_script_literal(spec['save_every'])}",
        f"TRAIN_PATH = {_script_literal(train_path)}",
        f"VALID_PATH = {_script_literal(valid_path)}",
        f"ADAPTER_DIR = {_script_literal(adapter_dir)}",
        f"CHECKPOINT_DIR = {_script_literal(checkpoint_dir)}",
        f"RESUME_FROM = {_script_literal(resume_from)}",
        f"USE_BF16 = {_script_literal(dtype == 'bfloat16')}",
        "",
        "def load_rows(path):",
        "    rows = []",
        "    with open(path, encoding='utf-8') as handle:",
        "        for line in handle:",
        "            line = line.strip()",
        "            if line:",
        "                rows.append(json.loads(line))",
        "    return rows",
        "",
        "model, tokenizer = FastLanguageModel.from_pretrained(",
        "    model_name=MODEL_REPO,",
        "    max_seq_length=MAX_SEQ_LENGTH,",
        "    dtype=None,  # auto: bf16 on Ampere+",
        "    load_in_4bit=True,  # QLoRA; fixed, not client-controlled",
        ")",
        "# Standardize on the ChatML template so assistant-only loss masking",
        "# uses known markers (dataset pipeline may use any template).",
        'tokenizer = get_chat_template(tokenizer, chat_template="chatml")',
        "",
        "def to_text(row):",
        "    return {\"text\": tokenizer.apply_chat_template(",
        '        row["messages"], tokenize=False, add_generation_prompt=False)}',
        "",
        'train_ds = Dataset.from_list([to_text(r) for r in load_rows(TRAIN_PATH)])',
        'valid_ds = Dataset.from_list([to_text(r) for r in load_rows(VALID_PATH)])',
        "",
        "model = FastLanguageModel.get_peft_model(",
        "    model,",
        "    r=LORA_RANK,",
        "    target_modules=TARGET_MODULES,",
        "    lora_alpha=LORA_ALPHA,",
        "    lora_dropout=0,  # Unsloth is optimized for dropout=0; fixed",
        '    bias="none",',
        '    use_gradient_checkpointing="unsloth",  # fixed',
        "    random_state=SEED,",
        "    use_dora=USE_DORA,",
        ")",
        "",
        "trainer = SFTTrainer(",
        "    model=model,",
        "    tokenizer=tokenizer,",
        "    train_dataset=train_ds,",
        "    eval_dataset=valid_ds,",
        '    dataset_text_field="text",',
        "    max_seq_length=MAX_SEQ_LENGTH,",
        "    dataset_num_proc=2,",
        "    args=TrainingArguments(",
        "        per_device_train_batch_size=BATCH_SIZE,",
        "        gradient_accumulation_steps=GRAD_ACCUM,",
        "        max_steps=ITERS,",
        "        learning_rate=LEARNING_RATE,",
        "        bf16=USE_BF16,",
        "        fp16=not USE_BF16,",
        '        optim="paged_adamw_8bit",  # fixed',
        '        lr_scheduler_type="cosine",  # fixed',
        "        warmup_ratio=0.03,  # fixed",
        "        logging_steps=10,  # fixed: loss telemetry cadence",
        '        eval_strategy="steps",',
        "        eval_steps=100,  # fixed",
        '        save_strategy="steps",',
        "        save_steps=SAVE_EVERY,",
        "        save_total_limit=2,",
        "        seed=SEED,",
        "        output_dir=CHECKPOINT_DIR,",
        '        report_to="none",  # telemetry goes to the coordinator, not wandb',
        "    ),",
        ")",
        "# Assistant-only loss masking (the mask_prompt=true equivalent).",
        "trainer = train_on_responses_only(",
        "    trainer,",
        '    instruction_part="<|im_start|>user\\n",',
        '    response_part="<|im_start|>assistant\\n",',
        ")",
        "stats = trainer.train(resume_from_checkpoint=RESUME_FROM)",
        "# Canonical PEFT artifact: adapter_model.safetensors + adapter_config.json",
        "# (+ tokenizer). vLLM reads this natively; the MLX lane converts at",
        "# its serving boundary.",
        "model.save_pretrained(ADAPTER_DIR)",
        "tokenizer.save_pretrained(ADAPTER_DIR)",
        'print(json.dumps({"status": "trained",',
        '                    "train_runtime_s": stats.metrics.get("train_runtime")}))',
        "",
    ]
    return "\n".join(lines)


def build_train_command(script_path):
    """The one and only command shape this backend executes (host mode).

    script_path must point at a train.py produced by generate_config(); the
    path is derived from the job working directory, never from client input.
    When DASHA_CUDA_DOCKER_IMAGE is set, the daemon wraps this command in
    `docker run` (see CUDA-SANDBOX.md); the script path is bind-mounted at
    the same absolute path so the baked-in paths stay valid.
    """
    return [sys.executable, script_path]


def _dockerize(command, ctx):
    """Wrap the trainer command in `docker run` when configured.

    Boundary (see CUDA-SANDBOX.md): the daemon stays on the host; only the
    trainer runs in the container. The job workdir is bind-mounted at the
    SAME absolute path so generated absolute paths keep working; the model
    cache is mounted read-only; the container gets no network.
    """
    image = os.environ.get("DASHA_CUDA_DOCKER_IMAGE")
    if not image:
        return command
    workdir = ctx.workdir
    cache = core.model_cache_dir()
    max_mem = []
    try:
        probe = _probe_gpu() or {}
        vram_gb = float(probe.get("vram_gb") or 0)
        if vram_gb > 0:
            # Container memory cap: leave the VRAM reserve + 1 GB outside.
            max_mem = ["--memory", f"{max(4, int(vram_gb - VRAM_RESERVE_GB - 1))}g"]
    except Exception:
        max_mem = []
    docker_cmd = [
        "docker", "run", "--rm",
        "--gpus", '"device=0"',
        "--network", "none",
        "--pids-limit", "1024",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "-v", f"{workdir}:{workdir}",
        "-v", f"{cache}:{cache}:ro",
        "-w", workdir,
    ] + max_mem + [image] + command
    return docker_cmd


def check_unsloth():
    try:
        import unsloth  # noqa: F401
        from importlib.metadata import version
        installed = version("unsloth")
        return True, installed
    except Exception as error:
        return False, str(error)


def ensure_base_model(repo):
    """Download/cache the allowlisted 4-bit base once. Returns local path."""
    from huggingface_hub import snapshot_download
    return snapshot_download(repo_id=repo, cache_dir=core.model_cache_dir())


def report_telemetry(coordinator, token, job_id, update):
    return core.report_progress(coordinator, token, job_id, update)


def _select_dtype():
    capability = _capability_tuple((_probe_gpu() or {}).get("compute_capability"))
    if capability and capability >= MIN_COMPUTE_CAPABILITY:
        return "bfloat16"
    return "float16"


def generate_config(spec, ctx):
    """Build this backend's config from the sanitized spec; write train.py."""
    base = BASE_MODELS[spec["base_model"]]
    checkpoint_dir = os.path.join(ctx.workdir, "checkpoints")
    os.makedirs(checkpoint_dir, exist_ok=True)
    script_path = os.path.join(ctx.workdir, "train.py")
    script_text = spec_to_train_script(
        spec, train_path=ctx.train_path, valid_path=ctx.valid_path,
        adapter_dir=ctx.adapter_dir, checkpoint_dir=checkpoint_dir,
        resume_from=ctx.resume_dir, dtype=_select_dtype(),
    )
    with open(script_path, "w", encoding="utf-8") as handle:
        handle.write(script_text)
    return {"command": _dockerize(build_train_command(script_path), ctx),
            "config_path": script_path, "config_text": script_text,
            "spec": spec, "base_model": spec["base_model"]}


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

def _vram_used_mb():
    """VRAM used on device 0 in MB, or None when unreadable."""
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits",
             "--id=0"],
            capture_output=True, text=True, timeout=10)
        return int(out.stdout.strip().split()[0])
    except Exception:
        return 0


class Watchdog:
    """Kills the trainer on wall-clock or VRAM overrun (host-side)."""

    def __init__(self, process, max_wall_seconds, max_vram_mb):
        self.process = process
        self.deadline = time.monotonic() + max_wall_seconds
        self.max_vram_mb = max_vram_mb
        self.tripped = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._watch, daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop.set()
        self._thread.join(5)

    def _watch(self):
        while not self._stop.wait(15):
            if self.process.poll() is not None:
                return
            if time.monotonic() > self.deadline:
                self.tripped = "wall_clock_exceeded"
                self.process.kill()
                return
            if self.max_vram_mb and _vram_used_mb() > self.max_vram_mb:
                self.tripped = "vram_exceeded"
                self.process.kill()
                return


LOSS_LINE_RE = re.compile(r"'loss':\s*([0-9]+\.[0-9]+)")


def _parse_loss_line(line):
    match = LOSS_LINE_RE.search(line)
    return float(match.group(1)) if match else None


def _checkpoints_dir(ctx):
    return os.path.join(ctx.workdir, "checkpoints")


def run(config, ctx):
    """Run the fixed trainer command; stream telemetry; return the result."""
    ok, unsloth_version = check_unsloth()
    if not ok:
        raise RuntimeError(f"unsloth {UNSLOTH_PIN} required: {unsloth_version}")
    ensure_base_model(BASE_MODELS[config["base_model"]]["repo"])
    command = config["command"]
    process = subprocess.Popen(command, cwd=ctx.workdir, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, bufsize=1)
    probe = _probe_gpu() or {}
    try:
        max_vram_mb = int(float(probe.get("vram_gb") or 0) * 1024) - 1024
    except (TypeError, ValueError):
        max_vram_mb = 0
    watchdog = Watchdog(process, ctx.max_wall_seconds,
                        max_vram_mb if max_vram_mb > 0 else None)
    watchdog.start()
    train_loss, iters_done = [], 0
    cancelled = threading.Event()

    def _on_signal(_signum, _frame):
        cancelled.set()
        try:
            process.terminate()
        except Exception:
            pass

    old_handlers = {s: signal.signal(s, _on_signal) for s in (signal.SIGINT, signal.SIGTERM)}
    try:
        for line in process.stdout:
            loss = _parse_loss_line(line)
            if loss is not None:
                # TRL logs every logging_steps; iters ≈ reports * 10.
                train_loss.append(loss)
                iters_done = len(train_loss) * FIXED_TRAINING_FIELDS["logging_steps"]
                update = {"iters_done": iters_done, "train_loss": loss}
                if ctx.progress_callback:
                    ctx.progress_callback(update)
                else:
                    report_telemetry(ctx.coordinator, ctx.token, ctx.job_id, update)
        process.wait()
    finally:
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)
        watchdog.stop()

    base_result = {"job_id": ctx.job_id, "engine": ENGINE_ID,
                   "trained_engine": ENGINE_ID, "iters_done": iters_done,
                   "spec_hash": core.spec_hash(config["spec"])}
    if watchdog.tripped == "vram_exceeded":
        raise RuntimeError("trainer killed: VRAM cap exceeded")
    if watchdog.tripped == "wall_clock_exceeded" or cancelled.is_set():
        checkpoint_ref = None
        try:
            checkpoint_ref = core.upload_adapter_dir(ctx.coordinator, ctx.token, ctx.job_id, ctx.adapter_dir)
        except Exception:
            pass
        return {**base_result, "status": "preempted", "checkpoint_ref": checkpoint_ref}
    if process.returncode != 0:
        return {**base_result, "status": "failed",
                "error": f"cuda trainer exited with code {process.returncode}"}
    adapter_ref = core.upload_adapter_dir(ctx.coordinator, ctx.token, ctx.job_id, ctx.adapter_dir)
    return {**base_result, "status": "complete", "train_loss": train_loss,
            "adapter_ref": adapter_ref}


def doctor():
    failures = 0
    probe = _probe_gpu()
    if not probe:
        print("cuda      failed · no Nvidia GPU detected (nvidia-smi missing or no device)")
        return 1
    print(f"cuda      gpu {probe.get('model')} · {probe.get('vram_gb')} GB VRAM · "
          f"driver {probe.get('driver_version')} · CUDA {probe.get('cuda_version')} · "
          f"cc {probe.get('compute_capability')}")
    cuda_version = _parse_version(probe.get("cuda_version"))
    if cuda_version is None or cuda_version < CUDA_MIN_VERSION:
        print(f"cuda      failed · CUDA >= {CUDA_MIN_VERSION[0]}.{CUDA_MIN_VERSION[1]} required")
        failures += 1
    capability = _capability_tuple(probe.get("compute_capability"))
    if capability is None:
        print("cuda      failed · cannot determine compute capability (need torch or pynvml)")
        failures += 1
    elif capability < MIN_COMPUTE_CAPABILITY:
        print(f"cuda      failed · compute capability >= "
              f"{MIN_COMPUTE_CAPABILITY[0]}.{MIN_COMPUTE_CAPABILITY[1]} required for bf16")
        failures += 1
    ok, detail = check_unsloth()
    print(f"cuda      unsloth {'ok · ' + detail if ok else 'note · ' + detail + ' (only needed at train time)'}")
    print(f"cuda      bases: {', '.join(BASE_MODELS)}")
    return failures
