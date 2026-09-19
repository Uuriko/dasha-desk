#!/usr/bin/env python3
"""Dasha Compute fine-tune provider runner — engine dispatcher (DASHA_BACKEND=finetune).

The fine-tune capability is ENGINE-TYPED (FINETUNE-JOB-SPEC.md): the kit
advertises `finetune_engines: ["mlx"]` on poll, and the server may assign an
expected `engine` on the job. This module validates the declarative spec,
verifies `spec_hash`, fetches the coordinator-sanitized dataset, then hands
off to the engine backend that implements this interface:

    ENGINE_ID = "mlx"                       # engine id string
    generate_config(spec, ctx) -> dict       # build the backend's own config
                                            # from the sanitized spec; the ONLY
                                            # config the backend will execute
    run(config, ctx) -> dict                # execute training, stream
                                            # telemetry, return terminal
                                            # result incl. "engine": ENGINE_ID
    report_telemetry(coordinator, token, job_id, update) -> dict
    doctor() -> int                         # 0 when the engine can train

Backends live in `finetune_runner_<engine>.py` and are imported lazily so a
missing optional dependency never breaks the dispatcher. v1 ships the `mlx`
backend (`finetune_runner_mlx.py`: stock `mlx_lm.lora`). The seam for a
future `cuda` backend (Unsloth/Axolotl on Nvidia) is `register_engine()` /
`get_engine()` below — do NOT implement cuda here.

Security model (see dasha-tune-plan/INTEGRATION-SURFACE.md §5):
  * No backend may execute client-supplied code, shell, or YAML. Each
    backend generates its own config deterministically from the validated
    spec via generate_config(); unknown spec fields are stripped,
    out-of-range values rejected, spec_hash verified before training.
  * The dataset is the trust boundary: centrally sanitized by the
    coordinator, but providers inherently see user datasets in the clear
    (privacy tier enforced server-side at matching time).
  * macOS has no GPU-capable sandbox (Apple's `container` tool runs Linux
    VMs with no Metal). Kit-level defense in depth: per-job working dir,
    no subprocess other than the backend's fixed trainer command, watchdog
    on wall-clock + RSS with kill, downloads only from the coordinator and
    allowlisted weight repos.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import shutil
import tarfile
import urllib.error
import urllib.request
import uuid

# ---------------------------------------------------------------------------
# Spec schema (mirrors FINETUNE-JOB-SPEC.md; server is authoritative)
# ---------------------------------------------------------------------------

OS_RESERVE_GB = 4.0

ENUM_FIELDS = {
    "finetune_type": {"lora", "dora"},
    "lora_rank": {4, 8, 16},
    "lora_layers": {4, 8, 16},
    "batch_size": {1, 2, 4},
    "max_seq_length": {512, 1024, 2048, 4096},
    "privacy": {"network", "trusted", "local"},
}

RANGE_FIELDS = {
    "iters": (50, 5000),
    "learning_rate": (1e-6, 1e-4),
    "grad_accumulation_steps": (1, 32),
    "eval_split": (0.05, 0.2),
    "replay_mix_ratio": (0.0, 0.5),
    "save_every": (50, 1000),
}

REQUIRED_FIELDS = (
    "base_model", "dataset_ref", "finetune_type", "lora_rank", "lora_layers",
    "iters", "learning_rate", "batch_size", "max_seq_length",
    "grad_accumulation_steps", "eval_split", "replay_mix_ratio",
    "seed", "save_every", "privacy",
)

DATASET_REF_RE = re.compile(r"^ds_[A-Za-z0-9_-]{1,64}$")

# Memory floors by size tier (QLoRA, batch 1, grad-ckpt — spec §Capability).
TIER_MEMORY_FLOOR_GB = {"1b": 4, "3b": 6, "7b": 10, "8b": 10, "13b": 16, "32b": 24}


class SpecError(ValueError):
    """A submitted fine-tune spec failed validation."""


class EngineMismatchError(RuntimeError):
    """The job's expected engine is not runnable by this kit."""


def sanitize_spec(raw, base_models):
    """Validate a raw spec dict per FINETUNE-JOB-SPEC.md.

    Returns a cleaned dict containing exactly the known fields (unknown
    fields are stripped). `base_models` is the engine backend's allowlist
    (defense in depth; the server's MODELS + license gate is authoritative).
    Raises SpecError on any violation.
    """
    if not isinstance(raw, dict):
        raise SpecError("spec must be an object")
    missing = [field for field in REQUIRED_FIELDS if field not in raw]
    if missing:
        raise SpecError(f"missing fields: {', '.join(missing)}")
    spec = {}
    base_model = raw["base_model"]
    if base_model not in base_models:
        raise SpecError(f"base_model not in provider allowlist: {base_model!r}")
    spec["base_model"] = base_model
    dataset_ref = raw["dataset_ref"]
    if not isinstance(dataset_ref, str) or not DATASET_REF_RE.match(dataset_ref):
        raise SpecError(f"dataset_ref malformed: {dataset_ref!r}")
    spec["dataset_ref"] = dataset_ref
    for field, allowed in ENUM_FIELDS.items():
        value = raw[field]
        if value not in allowed:
            raise SpecError(f"{field}={value!r} not in {sorted(allowed)}")
        spec[field] = value
    for field, (low, high) in RANGE_FIELDS.items():
        value = raw[field]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise SpecError(f"{field} must be a number, got {value!r}")
        if not (low <= value <= high):
            raise SpecError(f"{field}={value!r} outside [{low}, {high}]")
        spec[field] = value
    seed = raw["seed"]
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise SpecError(f"seed must be an int, got {seed!r}")
    spec["seed"] = seed
    # Unknown fields are stripped: only the allowlisted fields above survive.
    return spec


def canonical_spec_json(spec):
    return json.dumps(spec, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def spec_hash(spec):
    return hashlib.sha256(canonical_spec_json(spec).encode("utf-8")).hexdigest()


def verify_spec_hash(spec, expected):
    """True when the spec's hash matches the coordinator-pinned hash."""
    if not isinstance(expected, str):
        return False
    return hmac.compare_digest(spec_hash(spec), expected)


def finetune_memory_gb(memory_gb, reserve_gb=OS_RESERVE_GB):
    """Advertisable fine-tune memory: visible memory minus the OS reserve.

    mlx: unified memory minus 4 GB. A future cuda backend reports total VRAM
    minus its 2 GB reserve via reserve_gb=2.0.
    """
    try:
        value = float(memory_gb)
    except (TypeError, ValueError):
        return None
    headroom = round(value - reserve_gb, 1)
    return headroom if headroom > 0 else None


# ---------------------------------------------------------------------------
# Engine registry (lazy: a missing engine dependency never breaks dispatch)
# ---------------------------------------------------------------------------

_ENGINE_MODULES = {
    "mlx": "finetune_runner_mlx",
    "cuda": "finetune_runner_cuda",  # Unsloth on Nvidia; gated by is_ready()
}

_ENGINE_CACHE = {}


def register_engine(engine_id, module_name):
    """Register a future engine backend module (imported lazily)."""
    _ENGINE_MODULES[engine_id] = module_name
    _ENGINE_CACHE.pop(engine_id, None)


def get_engine(engine_id):
    """Return the backend module for engine_id. Raises EngineMismatchError."""
    if engine_id not in _ENGINE_CACHE:
        module_name = _ENGINE_MODULES.get(engine_id)
        if module_name is None:
            raise EngineMismatchError(f"engine {engine_id!r} not supported by this kit")
        try:
            __import__(module_name)
        except ImportError as error:
            raise EngineMismatchError(f"engine {engine_id!r} unavailable: {error}") from error
        import sys
        _ENGINE_CACHE[engine_id] = sys.modules[module_name]
    return _ENGINE_CACHE[engine_id]


def _engine_ready(engine_id):
    """Import-availability plus the backend's own readiness gate.

    Backends may define `is_ready() -> bool` (e.g. cuda checks for a usable
    GPU + driver + compute capability). Backends without the hook keep the
    old behavior: importable means available.
    """
    try:
        module = get_engine(engine_id)
    except EngineMismatchError:
        return False
    is_ready = getattr(module, "is_ready", None)
    if callable(is_ready):
        try:
            return bool(is_ready())
        except Exception:
            return False
    return True


def supported_engines():
    """Engine ids this kit can actually run (for poll advertisement)."""
    return [engine_id for engine_id in _ENGINE_MODULES if _engine_ready(engine_id)]


def _engine_available(engine_id):
    return _engine_ready(engine_id)


# ---------------------------------------------------------------------------
# Coordinator HTTP helpers (shared, engine-agnostic)
# ---------------------------------------------------------------------------

def _http_json(url, token, payload=None, timeout=60):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url, data=data, method="POST" if payload is not None else "GET",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}",
                 "User-Agent": "dasha-compute-finetune/0.3"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {error.code}: {detail[:300]}") from error


def report_progress(coordinator, token, job_id, update):
    return _http_json(f"{coordinator}/v1/providers/finetune/jobs/{job_id}/progress",
                      token, {"job_id": job_id, **update})


def report_result(coordinator, token, job_id, result):
    return _http_json(f"{coordinator}/v1/providers/finetune/jobs/{job_id}/result",
                      token, {"provider_id": os.getenv("DASHA_PROVIDER_ID", "unknown"), **result})


# ---------------------------------------------------------------------------
# Provisioning (engine-agnostic): dataset + checkpoint resume + artifact upload
# ---------------------------------------------------------------------------

def model_cache_dir():
    return os.path.expanduser(os.getenv("DASHA_FINETUNE_MODEL_CACHE", "~/.dasha-finetune/models"))


def job_workdir(job_id):
    root = os.getenv("DASHA_FINETUNE_WORKDIR", os.path.expanduser("~/.dasha-finetune/jobs"))
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", str(job_id))[:64] or "job"
    path = os.path.join(root, safe)
    os.makedirs(path, exist_ok=True)
    return path


def fetch_dataset(coordinator, token, dataset_ref, dest_dir):
    """Fetch the coordinator-sanitized dataset into the job dir.

    Expects the coordinator to return {"train": "<jsonl>", "valid": "<jsonl>"}.
    Writes train.jsonl / valid.jsonl and returns their paths.
    """
    payload = _http_json(f"{coordinator}/v1/providers/finetune/datasets/{dataset_ref}", token)
    paths = {}
    for split in ("train", "valid"):
        content = payload.get(split)
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError(f"dataset {dataset_ref} missing {split} split")
        path = os.path.join(dest_dir, f"{split}.jsonl")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(content if content.endswith("\n") else content + "\n")
        paths[split] = path
    return paths["train"], paths["valid"]


def fetch_resume_adapter(coordinator, token, adapter_ref, dest_dir):
    """Download a checkpoint adapter for resume; returns its directory."""
    payload = _http_json(f"{coordinator}/v1/providers/finetune/adapters/{adapter_ref}", token)
    blob = payload.get("adapter_tar_gz_b64")
    if not blob:
        raise RuntimeError("resume adapter payload missing adapter_tar_gz_b64")
    target = os.path.join(dest_dir, "resume_adapter")
    os.makedirs(target, exist_ok=True)
    archive = os.path.join(dest_dir, "resume_adapter.tar.gz")
    with open(archive, "wb") as handle:
        handle.write(base64.b64decode(blob))
    with tarfile.open(archive, "r:gz") as tar:
        tar.extractall(target, filter="data")
    return target


class _BytesWriter:
    def __init__(self, buf):
        self.buf = buf

    def write(self, data):
        self.buf += data


def _multipart_post(url, token, fields, files):
    boundary = f"----dasha{uuid.uuid4().hex}"
    body = bytearray()
    for name, value in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
    for name, (filename, path, content_type) in files.items():
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; "
                 f"filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n").encode()
        with open(path, "rb") as handle:
            shutil.copyfileobj(handle, _BytesWriter(body))
        body += b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    request = urllib.request.Request(
        url, data=bytes(body), method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                 "Authorization": f"Bearer {token}",
                 "User-Agent": "dasha-compute-finetune/0.3"},
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {error.code}: {detail[:300]}") from error


def upload_adapter_dir(coordinator, token, job_id, adapter_dir):
    """Tar the adapters/ dir and upload it. Returns the coordinator's adapter_ref."""
    archive = os.path.join(os.path.dirname(adapter_dir), "adapters.tar.gz")
    with tarfile.open(archive, "w:gz") as tar:
        tar.add(adapter_dir, arcname="adapters")
    response = _multipart_post(
        f"{coordinator}/v1/providers/finetune/jobs/{job_id}/artifacts", token,
        {"kind": "adapter"}, {"adapter": ("adapters.tar.gz", archive, "application/gzip")},
    )
    return response.get("adapter_ref")


def _total_memory_gb():
    try:
        return round(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024 ** 3, 1)
    except (ValueError, OSError, AttributeError):
        return None


class EngineContext:
    """Per-job execution context handed to the engine backend."""

    def __init__(self, *, coordinator, token, job_id, workdir, train_path,
                 valid_path, adapter_dir, resume_dir=None, progress_callback=None,
                 max_wall_seconds=20 * 3600, max_rss_mb=None):
        self.coordinator = coordinator
        self.token = token
        self.job_id = job_id
        self.workdir = workdir
        self.train_path = train_path
        self.valid_path = valid_path
        self.adapter_dir = adapter_dir
        self.resume_dir = resume_dir
        self.progress_callback = progress_callback
        self.max_wall_seconds = max_wall_seconds
        self.max_rss_mb = max_rss_mb


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def run_job(coordinator, token, job, *, dry_run=False, progress_callback=None):
    """Execute one declarative fine-tune job. Returns the result payload.

    `job` carries {id, spec, spec_hash, engine?, expires_at?,
    resume_adapter_ref?}. The expected engine defaults to "mlx" when the
    server does not name one. An engine this kit cannot run is refused
    cleanly — status "refused", nothing is trained. (Server-side Phase 1
    should requeue refused jobs WITHOUT incrementing attempts.)
    With dry_run=True, validates everything and returns the exact command
    the backend would execute, without executing anything.
    """
    job = job if isinstance(job, dict) else {}
    job_id = str(job.get("id") or f"job_{uuid.uuid4().hex[:12]}")
    requested_engine = job.get("engine") or "mlx"
    try:
        backend = get_engine(requested_engine)
    except EngineMismatchError as error:
        return {"job_id": job_id, "status": "refused", "engine": requested_engine,
                "error": str(error), "iters_done": 0}
    spec = sanitize_spec(job.get("spec"), backend.BASE_MODELS)
    if not verify_spec_hash(spec, job.get("spec_hash")):
        raise SpecError("spec_hash mismatch — refusing to train")

    workdir = job_workdir(job_id)
    if dry_run:
        train_path = os.path.join(workdir, "train.jsonl")
        valid_path = os.path.join(workdir, "valid.jsonl")
        resume_dir = None
    else:
        train_path, valid_path = fetch_dataset(coordinator, token, spec["dataset_ref"], workdir)
        resume_dir = None
        if job.get("resume_adapter_ref"):
            resume_dir = fetch_resume_adapter(coordinator, token, job["resume_adapter_ref"], workdir)
    adapter_dir = os.path.join(workdir, "adapters")
    os.makedirs(adapter_dir, exist_ok=True)

    max_wall = 20 * 3600
    expires_at = job.get("expires_at")
    if isinstance(expires_at, (int, float)):
        import time
        max_wall = max(600, min(max_wall, int(expires_at - time.time() - 300)))
    max_rss_mb = int((finetune_memory_gb(_total_memory_gb()) or 8) * 1024)

    ctx = EngineContext(
        coordinator=coordinator, token=token, job_id=job_id, workdir=workdir,
        train_path=train_path, valid_path=valid_path, adapter_dir=adapter_dir,
        resume_dir=resume_dir, progress_callback=progress_callback,
        max_wall_seconds=max_wall, max_rss_mb=max_rss_mb,
    )
    config = backend.generate_config(spec, ctx)
    if dry_run:
        return {"job_id": job_id, "engine": backend.ENGINE_ID,
                "command": config["command"],
                "config": config.get("config_text"),
                "spec_hash": spec_hash(spec), "workdir": workdir}
    return backend.run(config, ctx)


def doctor():
    failures = 0
    print(f"finetune  engines: {', '.join(supported_engines()) or '(none available)'}")
    for engine_id in supported_engines():
        try:
            failures += get_engine(engine_id).doctor()
        except EngineMismatchError as error:
            failures += 1
            print(f"{engine_id} failed · {error}")
    mem = _total_memory_gb()
    headroom = finetune_memory_gb(mem)
    print(f"memory    {'ok · ' + str(headroom) + ' GB advertisable' if headroom else 'failed · cannot read memory'}")
    failures += 0 if headroom else 1
    cache = model_cache_dir()
    try:
        os.makedirs(cache, exist_ok=True)
        print(f"models    ok · cache {cache}")
    except OSError as error:
        failures += 1
        print(f"models    failed · {error}")
    return failures
