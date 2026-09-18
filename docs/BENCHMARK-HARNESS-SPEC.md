# Provider benchmark harness spec (TASKS item 11)

Status: spec + schema shipped. Implementation of the v2 measurement protocol in
`provider/agent.py --benchmark` is a follow-up (code change, not this doc).

## Problem

`dasha-compute benchmark` writes an ad-hoc `benchmark.json` (v1): one prompt,
decode-only throughput per model, no prefill rate, no time-to-first-token, no
context length, no power draw, no chip identifier beyond `platform.machine()`,
and no record of which backend served the model. That is not enough to compare
providers, verify the model catalog
(`docs/APPLE-SILICON-MODEL-CATALOG.md`), or decide the MLX-vs-Ollama lane
(task 9) on evidence.

## Schema v2

Machine-readable contract: `compute/schemas/benchmark.schema.json`
(JSON Schema draft 2020-12, registered in `compute/release-files.json`).
Validate any report with:

```bash
node compute/scripts/validate-benchmark.mjs "$APP_DIR/benchmark.json"
# or: dasha-compute benchmark --json | node compute/scripts/validate-benchmark.mjs -
```

### Top-level fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | integer const `2` | yes | Absent means v1 (legacy, does not validate) |
| `measured_at` | integer | yes | ms epoch when the run finished (v1 continuity) |
| `harness` | object | no | Run metadata: `name`, `benchmark_tokens`, `repeats` |
| `hardware` | object | yes | `chip` (e.g. `Apple M4`), `memory_gb`, `os` (e.g. `macOS 15.6.1`), optional `python` |
| `results` | array | yes | ≥1 per-model entries, order not significant |

### Per-model fields (`results[]`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `model` | string | yes | Public Dasha model id, e.g. `qwen3-8b` |
| `backend_model` | string | yes | Backend-local tag measured, e.g. `qwen3:8b` or `mlx-community/Qwen3-8B-4bit`. Renamed from v1 `ollama_model` |
| `backend` | enum `ollama` \| `mlx` | yes | Which serving backend the measurement ran against |
| `context_length` | integer ≥ 1 | yes | Context window the model was configured with |
| `prefill_tokens_per_second` | number > 0 | yes | Prompt-processing rate |
| `decode_tokens_per_second` | number > 0 | yes | Token-generation rate |
| `ttft_ms` | number ≥ 0 | yes | Time to first token on a streaming request |
| `watts_avg` | number > 0 | no | Average package power during decode; omit when unavailable |
| `run` | object | no | `prompt_tokens`, `generated_tokens`, `repeats`; extra fields allowed |

Unknown properties are rejected at the top level, in `hardware`, and in
`results[]` (typos fail loudly); `harness` and `run` allow extra fields.

## `dasha-compute benchmark --json` output contract

`dasha-compute benchmark` already prints the report as JSON on stdout; `--json`
makes that the contract:

- **stdout** is exactly one JSON document conforming to the v2 schema. Nothing
  else may be printed to stdout (no banners, no progress lines).
- **stderr** carries human-readable progress (`ollama ok · qwen3-8b 68.2 tok/s`)
  and is the only place free-form text may go.
- **Exit code**: `0` when at least one model was measured; `1` when none were
  (Ollama down, no configured models installed) — same as today.
- `DASHA_BENCHMARK_TOKENS` (16–256, default 64) keeps its meaning: generated
  tokens per model. The value used must be echoed in `harness.benchmark_tokens`.
- The file at `DASHA_BENCHMARK_PATH` (`$APP_DIR/benchmark.json`) must contain
  the same document printed to stdout.

## Measurement protocol

One streaming request per model; a fixed prompt (the current one-paragraph
prompt is fine) with `temperature: 0` and `num_predict: DASHA_BENCHMARK_TOKENS`.

### Ollama backend

- Prefill: `prompt_eval_count / prompt_eval_duration` from `/api/chat` (seconds).
- Decode: `eval_count / eval_duration`.
- TTFT: time from request dispatch to the first streamed token.
- Context length: the value passed via `num_ctx` (default 8192 unless the model
  card declares otherwise).

### MLX backend (`mlx-lm` server)

- Prefill/decode: prompt and completion token counts from the
  OpenAI-compatible usage object; prefill wall time measured around the
  pre-first-token phase, decode around token streaming.
- TTFT: time from request dispatch to the first SSE data chunk.
- Same fixed prompt and token budget so backends are comparable.

### Power (optional)

On macOS, `sudo powermetrics --samplers cpu_power -n <samples>` during the
decode phase; record the mean as `watts_avg`. Requires sudo, so the harness
must work without it — omit the field rather than fabricate a value.

## v1 → v2 migration

- v1 files have no `schema_version`; treat absent as v1.
- `ollama_model` → `backend_model`; add `backend: "ollama"` explicitly.
- `hardware`: replace `system`/`machine`/`release` with `chip`/`os`
  (`chip` from `sysctl machdep.cpu.brand_string` on macOS); keep `memory_gb`.
- v1 `tokens_per_second` (decode-only) → `decode_tokens_per_second`; v1 rows
  have no prefill/TTFT/context data and cannot be upgraded — re-run.
- `measured_at` keeps its ms-epoch meaning, so `hardware()`'s
  `benchmarked_at` plumbing is untouched.

## Consumers

- Model catalog verification — every catalog PR attaches a v2 `benchmark.json`
  (`docs/APPLE-SILICON-MODEL-CATALOG.md`, `compute/ADD-A-MODEL.md`).
- Community benchmark leaderboard (task 31) — submission format is v2; the
  leaderboard ingests only validator-clean reports.
- MLX lane decision (tasks 9/10/14) — prefill/decode/TTFT per backend is the
  evidence the go/no-go needs.
- Doctor gap spec / funnel events — `benchmarked_at` freshness can gate
  "ready for jobs" signals later.

## Versioning

Bump `schema_version` for breaking changes (renames, type changes, new
required fields). Additive optional fields do not bump the version. The
validator always targets the checked-in schema; pin it per release via
`compute/release-files.json`.
