// benchmark-schema.test.mjs — TASKS item 11: the benchmark.json v2 schema and its
// validator accept well-formed reports and reject legacy/malformed ones.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadSchema, validateBenchmark } from "../scripts/validate-benchmark.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(HERE, "..", "schemas", "benchmark.schema.json");

function validReport() {
  return {
    schema_version: 2,
    measured_at: 1789824000000,
    harness: { name: "dasha-compute", benchmark_tokens: 64, repeats: 1 },
    hardware: { chip: "Apple M4", memory_gb: 16, os: "macOS 15.6.1", python: "3.11.9" },
    results: [
      {
        model: "qwen3-8b",
        backend_model: "qwen3:8b",
        backend: "ollama",
        context_length: 8192,
        prefill_tokens_per_second: 412.5,
        decode_tokens_per_second: 68.2,
        ttft_ms: 210.4,
        run: { prompt_tokens: 18, generated_tokens: 64, repeats: 1 },
      },
      {
        model: "gemma3-12b",
        backend_model: "mlx-community/gemma-3-12b-it-4bit",
        backend: "mlx",
        context_length: 8192,
        prefill_tokens_per_second: 388.1,
        decode_tokens_per_second: 74.9,
        ttft_ms: 188.0,
        watts_avg: 14.2,
      },
    ],
  };
}

/** The legacy v1 shape agent.py --benchmark writes today (decode-only, no schema_version). */
function legacyV1Report() {
  return {
    measured_at: 1789824000000,
    hardware: { system: "Darwin", machine: "arm64", release: "24.6.0", python: "3.11.9", memory_gb: 16.0 },
    results: [
      { model: "qwen3-8b", ollama_model: "qwen3:8b", tokens: 64, seconds: 1.021, tokens_per_second: 62.68 },
    ],
  };
}

test("schema file is well-formed and declares the v2 contract", async () => {
  const schema = await loadSchema(SCHEMA_PATH);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(schema.required, ["schema_version", "measured_at", "hardware", "results"]);
  assert.equal(schema.properties.schema_version.const, 2);
  assert.deepEqual(schema.properties.results.items, { $ref: "#/$defs/result" });
  assert.deepEqual(schema.$defs.result.required, [
    "model",
    "backend_model",
    "backend",
    "context_length",
    "prefill_tokens_per_second",
    "decode_tokens_per_second",
    "ttft_ms",
  ]);
  assert.deepEqual(schema.$defs.result.properties.backend.enum, ["ollama", "mlx"]);
});

test("a valid v2 report validates cleanly", async () => {
  const schema = await loadSchema(SCHEMA_PATH);
  assert.deepEqual(validateBenchmark(validReport(), schema), []);
});

test("the legacy v1 report fails validation (documents the migration gap)", async () => {
  const schema = await loadSchema(SCHEMA_PATH);
  const errors = validateBenchmark(legacyV1Report(), schema);
  assert.ok(errors.length > 0, "v1 report must not validate as v2");
  assert.ok(errors.some((error) => error.includes("schema_version")), "must flag missing schema_version");
  assert.ok(errors.some((error) => error.includes("chip")), "must flag missing hardware.chip");
});

test("validator rejects bad enums, ranges, missing and unknown fields", async () => {
  const schema = await loadSchema(SCHEMA_PATH);

  const badBackend = validReport();
  badBackend.results[0].backend = "llama.cpp";
  assert.ok(
    validateBenchmark(badBackend, schema).some((error) => error.includes("not one of")),
    "unknown backend must be rejected",
  );

  const negativeTtft = validReport();
  negativeTtft.results[0].ttft_ms = -5;
  assert.ok(
    validateBenchmark(negativeTtft, schema).some((error) => error.includes("ttft_ms")),
    "negative ttft_ms must be rejected",
  );

  const missingModel = validReport();
  delete missingModel.results[0].model;
  assert.ok(
    validateBenchmark(missingModel, schema).some((error) => error.includes("missing required property 'model'")),
    "missing model must be rejected",
  );

  const extraTopLevel = validReport();
  extraTopLevel.surprise = true;
  assert.ok(
    validateBenchmark(extraTopLevel, schema).some((error) => error.includes("unknown property 'surprise'")),
    "unknown top-level property must be rejected",
  );

  const emptyResults = validReport();
  emptyResults.results = [];
  assert.ok(
    validateBenchmark(emptyResults, schema).some((error) => error.includes("minItems")),
    "empty results must be rejected",
  );
});

test("CLI exits 0 on a valid report and 1 on an invalid one", async (context) => {
  const dir = await mkdtemp(path.join(tmpdir(), "benchmark-cli-"));
  const good = path.join(dir, "good.json");
  const bad = path.join(dir, "bad.json");
  await writeFile(good, JSON.stringify(validReport()));
  await writeFile(bad, JSON.stringify(legacyV1Report()));

  const run = (file) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        [path.join(HERE, "..", "scripts", "validate-benchmark.mjs"), file],
        (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr }),
      );
    });

  const valid = await run(good);
  assert.equal(valid.code, 0);
  assert.deepEqual(JSON.parse(valid.stdout), { valid: true, schema_version: 2 });

  const invalid = await run(bad);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /invalid: \d+ error\(s\)/);
});
