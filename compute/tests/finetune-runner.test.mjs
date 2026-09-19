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

function python(expression, env = {}) {
  const harness = `
import json, sys
sys.path.insert(0, ${JSON.stringify(providerDir)})
import finetune_runner as fr
mlx = fr.get_engine("mlx")
bases = mlx.BASE_MODELS
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

const specJson = () => JSON.stringify(VALID_SPEC);
const sanitized = () => `fr.sanitize_spec(${specJson()}, bases)`;

test("spec -> job.yaml is deterministic and carries the fixed fields", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "dasha-finetune-yaml-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const gen = () => `mlx.generate_config(${sanitized()}, fr.EngineContext(coordinator="http://127.0.0.1:1", token="t", job_id="j", workdir=${JSON.stringify(dir)}, train_path=${JSON.stringify(join(dir, "train.jsonl"))}, valid_path=${JSON.stringify(join(dir, "valid.jsonl"))}, adapter_dir=${JSON.stringify(join(dir, "adapters"))}))["config_text"]`;
  const first = python(gen());
  const second = python(gen());
  assert.equal(first, second);
  for (const line of [
    "train: true",
    "grad_checkpoint: true",
    "mask_prompt: true",
    "optimizer: \"adamw\"",
    "steps_per_report: 10",
    "steps_per_eval: 100",
    "num_layers: 16",
    "fine_tune_type: \"lora\"",
    "iters: 750",
    "seed: 0",
    "save_every: 100",
  ]) {
    assert.ok(first.includes(line), `yaml missing fixed field: ${line}`);
  }
});

test("sanitize_spec rejects out-of-range values and strips unknown fields", async () => {
  const bad = { ...VALID_SPEC, iters: 10 };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(bad)}, bases)`), /outside/);
  const badEnum = { ...VALID_SPEC, lora_rank: 32 };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(badEnum)}, bases)`), /not in/);
  const badModel = { ...VALID_SPEC, base_model: "evil-model" };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(badModel)}, bases)`), /allowlist/);
  const badRef = { ...VALID_SPEC, dataset_ref: "../../etc/passwd" };
  assert.throws(() => python(`fr.sanitize_spec(${JSON.stringify(badRef)}, bases)`), /malformed/);
  const withExtra = { ...VALID_SPEC, evil: "rm -rf /", yaml: "train: false" };
  const cleaned = python(`fr.sanitize_spec(${JSON.stringify(withExtra)}, bases)`);
  assert.ok(!("evil" in cleaned) && !("yaml" in cleaned));
  assert.deepEqual(Object.keys(cleaned).sort(), Object.keys(VALID_SPEC).sort());
});

test("spec_hash verification rejects tampered specs", async () => {
  const spec = python(sanitized());
  const hash = python(`fr.spec_hash(${sanitized()})`);
  assert.equal(python(`fr.verify_spec_hash(${JSON.stringify(spec)}, ${JSON.stringify(hash)})`), true);
  const tampered = { ...spec, iters: 5000 };
  assert.equal(python(`fr.verify_spec_hash(${JSON.stringify(tampered)}, ${JSON.stringify(hash)})`), false);
  assert.equal(python(`fr.verify_spec_hash(${JSON.stringify(spec)}, "deadbeef")`), false);
});

test("the runner can only ever execute the fixed trainer command", async () => {
  const hostileJob = {
    id: "job_hostile",
    spec: VALID_SPEC,
    spec_hash: python(`fr.spec_hash(${sanitized()})`),
    engine: "mlx",
    // hostile fields a malicious coordinator payload might smuggle in
    cmd: "rm -rf /",
    command: ["evil"],
    shell: true,
    yaml: "train: false",
    config: { model: "evil" },
    "python -m mlx_lm": "lora",
  };
  const dir = await mkdtemp(join(tmpdir(), "dasha-finetune-dry-"));
  try {
    const out = python(
      `fr.run_job("http://127.0.0.1:1", "token", json.loads(${JSON.stringify(JSON.stringify(hostileJob))}), dry_run=True)`,
      { DASHA_FINETUNE_WORKDIR: dir },
    );
    const command = out.command;
    assert.equal(out.engine, "mlx");
    assert.equal(command.length, 6);
    assert.ok(command[0].endsWith("python3") || command[0].endsWith("python"));
    assert.deepEqual(command.slice(1, 5), ["-m", "mlx_lm", "lora", "-c"]);
    assert.equal(command[5], join(out.workdir, "job.yaml"));
    assert.ok(!command.join(" ").includes("rm -rf"), "client input leaked into the command");
    assert.ok(out.config.includes("train: true"), "generated yaml must keep fixed fields");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("engine mismatch refuses the job cleanly without training", async () => {
  const job = {
    id: "job_tpu",
    spec: VALID_SPEC,
    spec_hash: python(`fr.spec_hash(${sanitized()})`),
    engine: "tpu",
  };
  const dir = await mkdtemp(join(tmpdir(), "dasha-finetune-refuse-"));
  try {
    const out = python(
      `fr.run_job("http://127.0.0.1:1", "token", json.loads(${JSON.stringify(JSON.stringify(job))}), dry_run=True)`,
      { DASHA_FINETUNE_WORKDIR: dir },
    );
    assert.equal(out.status, "refused");
    assert.equal(out.engine, "tpu");
    assert.equal(out.iters_done, 0);
    assert.ok(out.error.includes("tpu"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  assert.throws(() => python(`fr.get_engine("tpu")`), /not supported/);
});

test("engine registry exposes the mlx seam for a future cuda backend", async () => {
  // cuda registers but is_ready() gates on a real GPU; on this CPU-only
  // machine only mlx is advertised. (See finetune-runner-cuda.test.mjs for
  // the cuda-ready path via DASHA_CUDA_FAKE_PROBE.)
  assert.deepEqual(python("fr.supported_engines()"), ["mlx"]);
  assert.equal(python("mlx.ENGINE_ID"), "mlx");
  for (const method of ["generate_config", "run", "report_telemetry", "doctor"]) {
    assert.equal(python(`callable(getattr(mlx, ${JSON.stringify(method)}))`), true);
  }
});

test("finetune_memory_gb subtracts the OS reserve", async () => {
  assert.equal(python("fr.finetune_memory_gb(32)"), 28.0);
  assert.equal(python("fr.finetune_memory_gb(8)"), 4.0);
  assert.equal(python("fr.finetune_memory_gb(3)"), null);
  assert.equal(python("fr.finetune_memory_gb('nope')"), null);
  assert.equal(python("fr.finetune_memory_gb(24, reserve_gb=2.0)"), 22.0);
});

test("finetune lane advertises engine-typed capability in the poll payload", async () => {
  const harness = `
import json, sys
sys.path.insert(0, ${JSON.stringify(providerDir)})
import finetune_runner as fr
engines = fr.supported_engines()
headroom = fr.finetune_memory_gb(36.0)
import agent
assert agent.DASHA_BACKEND in ("ollama", "finetune")
print(json.dumps({"finetune_engines": engines, "finetune_memory_gb": headroom}))
`;
  const result = spawnSync("python3", ["-c", harness], {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { finetune_engines: ["mlx"], finetune_memory_gb: 32.0 });
});
