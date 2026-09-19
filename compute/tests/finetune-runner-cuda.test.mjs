import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const providerDir = fileURLToPath(new URL("../provider/", import.meta.url));

const VALID_SPEC = {
  base_model: "qwen3-8b",
  dataset_ref: "ds_abc123",
  finetune_type: "lora",
  lora_rank: 8,
  lora_layers: 16,
  iters: 750,
  learning_rate: 1e-5,
  batch_size: 4,
  max_seq_length: 2048,
  grad_accumulation_steps: 8,
  eval_split: 0.1,
  replay_mix_ratio: 0.2,
  seed: 0,
  save_every: 100,
  privacy: "network",
};

const FAKE_GPU = {
  model: "NVIDIA GeForce RTX 4090",
  vram_gb: 24.0,
  cuda_version: "12.4",
  driver_version: "550.54",
  compute_capability: "8.9",
};
const FAKE_ENV = { DASHA_CUDA_FAKE_PROBE: JSON.stringify(FAKE_GPU) };

// doctor() prints human-readable lines; capture them away from the JSON channel.
function doctorFailures(env = {}) {
  const harness = `
import io, sys, json, contextlib
sys.path.insert(0, ${JSON.stringify(providerDir)})
import finetune_runner as fr
cuda = fr.get_engine("cuda")
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    failures = cuda.doctor()
print(json.dumps({"failures": failures, "output": buf.getvalue()}))
`;
  const result = spawnSync("python3", ["-c", harness], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", ...env },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error || ""));
  return JSON.parse(result.stdout);
}

function python(expression, env = {}) {
  const harness = `
import json, sys
sys.path.insert(0, ${JSON.stringify(providerDir)})
import finetune_runner as fr
cuda = fr.get_engine("cuda")
bases = cuda.BASE_MODELS
print(json.dumps((lambda: (${expression}))()))
`;
  const result = spawnSync("python3", ["-c", harness], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", ...env },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error || ""));
  return JSON.parse(result.stdout);
}

const specJson = (overrides = {}) => JSON.stringify({ ...VALID_SPEC, ...overrides });
const sanitized = (overrides = {}) => `fr.sanitize_spec(${specJson(overrides)}, bases)`;

test("cuda module imports without torch/unsloth and registers cleanly", async () => {
  assert.equal(python("cuda.ENGINE_ID"), "cuda");
  assert.equal(python("cuda.UNSLOTH_PIN"), "2026.2.1");
  assert.equal(python("cuda.VRAM_RESERVE_GB"), 2.0);
  for (const method of ["generate_config", "run", "report_telemetry", "doctor", "is_ready", "gpu_info"]) {
    assert.equal(python(`callable(getattr(cuda, ${JSON.stringify(method)}))`), true);
  }
  // No GPU on this machine: importable but not advertised.
  assert.equal(python("cuda.is_ready()"), false);
  assert.deepEqual(python("fr.supported_engines()"), ["mlx"]);
});

test("fake GPU probe gates is_ready() and doctor()", async () => {
  assert.equal(python("cuda.is_ready()", FAKE_ENV), true);
  const good = doctorFailures(FAKE_ENV);
  assert.equal(good.failures, 0);
  assert.ok(good.output.includes("RTX 4090"));
  assert.deepEqual(python("fr.supported_engines()", FAKE_ENV), ["mlx", "cuda"]);
  const gpu = python("cuda.gpu_info()", FAKE_ENV);
  assert.deepEqual(gpu, FAKE_GPU);

  const oldCard = { ...FAKE_GPU, compute_capability: "7.5" }; // Pascal: no bf16
  const oldEnv = { DASHA_CUDA_FAKE_PROBE: JSON.stringify(oldCard) };
  assert.equal(python("cuda.is_ready()", oldEnv), false);
  assert.ok(doctorFailures(oldEnv).failures > 0);
  assert.equal(python("cuda.gpu_info()", oldEnv), null);

  const oldCuda = { ...FAKE_GPU, cuda_version: "11.8" };
  const oldCudaEnv = { DASHA_CUDA_FAKE_PROBE: JSON.stringify(oldCuda) };
  assert.equal(python("cuda.is_ready()", oldCudaEnv), false);

  const noCc = { ...FAKE_GPU, compute_capability: null };
  assert.equal(python("cuda.is_ready()", { DASHA_CUDA_FAKE_PROBE: JSON.stringify(noCc) }), false);
});

test("spec -> train.py is deterministic and carries the fixed fields", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "dasha-cuda-gen-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const gen = () => `cuda.generate_config(${sanitized()}, fr.EngineContext(coordinator="http://127.0.0.1:1", token="t", job_id="j", workdir=${JSON.stringify(dir)}, train_path=${JSON.stringify(join(dir, "train.jsonl"))}, valid_path=${JSON.stringify(join(dir, "valid.jsonl"))}, adapter_dir=${JSON.stringify(join(dir, "adapters"))}))["config_text"]`;
  const first = python(gen(), FAKE_ENV);
  const second = python(gen(), FAKE_ENV);
  assert.equal(first, second);
  for (const line of [
    "load_in_4bit=True",
    "lora_dropout=0",
    'bias="none"',
    'use_gradient_checkpointing="unsloth"',
    'optim="paged_adamw_8bit"',
    'lr_scheduler_type="cosine"',
    "logging_steps=10",
    "eval_steps=100",
    "save_steps=SAVE_EVERY",
    "train_on_responses_only(",
    "model.save_pretrained(ADAPTER_DIR)",
    "tokenizer.save_pretrained(ADAPTER_DIR)",
    "resume_from_checkpoint=RESUME_FROM",
    "ITERS = 750",
    "SEED = 0",
    "LORA_RANK = 8",
    "USE_DORA = False",
  ]) {
    assert.ok(first.includes(line), `train.py missing fixed field: ${line}`);
  }
  // The allowlisted Unsloth 4-bit base, not a client string.
  assert.ok(first.includes('MODEL_REPO = \'unsloth/Qwen3-8B\''));
});

test("lora_layers maps deterministically to target modules", async () => {
  const mods = (layers) => python(
    `cuda.generate_config(${sanitized({ lora_layers: layers })}, fr.EngineContext(coordinator="x", token="t", job_id="j", workdir="/tmp/nope", train_path="/tmp/nope/t.jsonl", valid_path="/tmp/nope/v.jsonl", adapter_dir="/tmp/nope/a"))["config_text"].split("TARGET_MODULES = ")[1].split("\\n")[0]`,
    FAKE_ENV);
  assert.equal(mods(16), "['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']");
  assert.equal(mods(8), "['q_proj', 'k_proj', 'v_proj', 'o_proj']");
  assert.equal(mods(4), "['q_proj', 'v_proj']");
});

test("dora flips use_dora; lora leaves it off", async () => {
  const flag = (type) => python(
    `cuda.generate_config(${sanitized({ finetune_type: type })}, fr.EngineContext(coordinator="x", token="t", job_id="j", workdir="/tmp/nope", train_path="/tmp/nope/t.jsonl", valid_path="/tmp/nope/v.jsonl", adapter_dir="/tmp/nope/a"))["config_text"].split("USE_DORA = ")[1].split("\\n")[0]`,
    FAKE_ENV);
  assert.equal(flag("lora"), "False");
  assert.equal(flag("dora"), "True");
});

test("sanitize_spec clamp parity with the mlx lane", async () => {
  const bad = { ...VALID_SPEC, iters: 10 };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(bad)}, bases)`), /outside/);
  const badEnum = { ...VALID_SPEC, lora_rank: 32 };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(badEnum)}, bases)`), /not in/);
  const badModel = { ...VALID_SPEC, base_model: "evil-model" };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(badModel)}, bases)`), /allowlist/);
  const badRef = { ...VALID_SPEC, dataset_ref: "../../etc/passwd" };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(badRef)}, bases)`), /malformed/);
  const withExtra = { ...VALID_SPEC, evil: "rm -rf /", command: ["evil"] };
  const cleaned = python(`fr.sanitize_spec(${JSON.stringify(withExtra)}, bases)`);
  assert.ok(!("evil" in cleaned) && !("command" in cleaned));
  // cuda allowlist pins (base, quant, engine) triples incl. the 32b tier
  assert.ok(python("list(bases)").includes("qwen3-32b"));
  assert.equal(python("bases['qwen3-32b']['min_vram_gb']"), 32);
});

test("dry_run can only ever execute the fixed generated script", async () => {
  const hostileJob = {
    id: "job_hostile_cuda",
    spec: VALID_SPEC,
    spec_hash: python(`fr.spec_hash(${sanitized()})`),
    engine: "cuda",
    cmd: "rm -rf /",
    command: ["evil"],
    shell: true,
    train_py: "import os; os.system('evil')",
  };
  const dir = await mkdtemp(join(tmpdir(), "dasha-cuda-dry-"));
  try {
    const out = python(
      `fr.run_job("http://127.0.0.1:1", "token", json.loads(${JSON.stringify(JSON.stringify(hostileJob))}), dry_run=True)`,
      { ...FAKE_ENV, DASHA_FINETUNE_WORKDIR: dir },
    );
    assert.equal(out.engine, "cuda");
    const command = out.command;
    assert.equal(command.length, 2);
    assert.ok(command[0].endsWith("python3") || command[0].endsWith("python"));
    assert.equal(command[1], join(out.workdir, "train.py"));
    assert.ok(!out.config.includes("rm -rf"), "client input leaked into the script");
    assert.ok(!out.config.includes("os.system"), "client input leaked into the script");
    assert.ok(out.config.includes(`spec_hash: ${out.spec_hash}`), "script pins the verified spec hash");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("docker wrapping is opt-in and keeps absolute paths stable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dasha-cuda-docker-"));
  try {
    const gen = `cuda.generate_config(${sanitized()}, fr.EngineContext(coordinator="x", token="t", job_id="j", workdir=${JSON.stringify(dir)}, train_path=${JSON.stringify(join(dir, "t.jsonl"))}, valid_path=${JSON.stringify(join(dir, "v.jsonl"))}, adapter_dir=${JSON.stringify(join(dir, "a"))}))["command"]`;
    const hostCmd = python(gen, FAKE_ENV);
    assert.equal(hostCmd.length, 2); // no docker without the env var
    const dockerCmd = python(gen, { ...FAKE_ENV, DASHA_CUDA_DOCKER_IMAGE: "dasha-cuda-train@sha256:abc" });
    assert.equal(dockerCmd[0], "docker");
    assert.ok(dockerCmd.includes("--gpus"));
    assert.ok(dockerCmd.includes("--network"));
    assert.ok(dockerCmd.includes("none"));
    assert.ok(dockerCmd.includes("--cap-drop"));
    assert.ok(!dockerCmd.includes("--privileged"), "never privileged");
    const scriptArg = dockerCmd[dockerCmd.length - 1];
    assert.equal(scriptArg, join(dir, "train.py"));
    assert.ok(dockerCmd.includes(`${dir}:${dir}`), "workdir bind-mounted at the same path");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loss-line parsing matches TRL's {'loss': …} log shape", async () => {
  assert.equal(python(`cuda._parse_loss_line("{'loss': 2.134, 'grad_norm': 0.5}")`), 2.134);
  assert.equal(python(`cuda._parse_loss_line("some other log line")`), null);
  assert.equal(python(`cuda._parse_loss_line("")`), null);
});

test("VRAM reserve math for advertisement", async () => {
  assert.equal(python("fr.finetune_memory_gb(24.0, reserve_gb=cuda.VRAM_RESERVE_GB)"), 22.0);
  assert.equal(python("fr.finetune_memory_gb(8.0, reserve_gb=cuda.VRAM_RESERVE_GB)"), 6.0);
});
