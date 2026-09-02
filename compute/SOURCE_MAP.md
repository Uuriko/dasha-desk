# Dasha Compute source map

This directory is the canonical public source for the Dasha Compute open alpha.

## Published surfaces

| Surface | Public location | Source |
|---|---|---|
| Product | [getdasha.com/compute](https://www.getdasha.com/compute) | [`console/app/`](console/app/) |
| Project index | [uuriko.github.io/dasha-desk/compute](https://uuriko.github.io/dasha-desk/compute/) | [`index.html`](index.html) |
| Source browser | [GitHub](https://github.com/Uuriko/dasha-desk/tree/main/compute) | this directory |
| Source archive | [download](https://www.getdasha.com/dasha-compute-open-alpha.tar.gz) | [`release-files.json`](release-files.json) + [`scripts/build-release.mjs`](scripts/build-release.mjs) |
| OpenAI-shaped API | `https://lobby.getdasha.com/compute/api/v1` | [`coordinator/server.mjs`](coordinator/server.mjs) documents the public protocol |

## Repository layout

| Path | Purpose |
|---|---|
| [`console/`](console/) | React/CSS product interface and API-route examples |
| [`coordinator/`](coordinator/) | Dependency-free coordinator and OpenAI-shaped HTTP protocol (`unsupported-v1.mjs` is the auth-first table for embeddings/completions/responses) |
| [`provider/`](provider/) | Python/Ollama provider agent plus macOS service commands |
| [`examples/`](examples/) | Small client examples |
| [`tests/`](tests/) | End-to-end protocol, streaming, installer, provider and release tests |
| [`scripts/`](scripts/) | Deterministic source-archive builder |
| [`install.sh`](install.sh) | macOS provider installation entry point |
| [`release-files.json`](release-files.json) | Explicit list of every file shipped in the source archive |

## Request flow

```text
OpenAI client
    │  POST /v1/chat/completions
    ▼
coordinator
    │  provider polls outbound
    ▼
provider/agent.py
    │  local Ollama request
    ▼
open model
    │  complete response or SSE chunks
    └──────────────────────────────► client
```

## Release flow

```text
release-files.json
    ▼
scripts/build-release.mjs
    ├── dasha-compute-open-alpha.tar.gz
    ├── dasha-compute-open-alpha.tar.gz.sha256
    └── release.json
            ▼
GitHub Compute release workflow + build provenance
```

The project is MIT licensed. Model weights retain their own licenses.
