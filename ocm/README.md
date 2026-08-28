# OCM — Open-Compute Marketplace

Working space for the product described in `open_compute_marketplace_summary.pdf`:
a decentralised inference network that turns idle Apple Silicon into an
OpenAI-compatible API.

**Status: scaffold only.** No AWS resources exist yet. No code runs yet.

## Why this is a separate directory

`dasha-desk` is a static-paste + docs + Watch repository for `www.getdasha.com`,
which is owned by the operator **dasha-lobby** Cloudflare Worker (see
[`../docs/DEPLOY.md`](../docs/DEPLOY.md)). Nothing in `ocm/` may change that.

Boundaries this directory keeps, deliberately:

| Boundary | Rule |
|---|---|
| Root `npm test` | `ocm/` adds nothing to the test chain in `package.json`. |
| `watch.mjs` | Asserts live `www.getdasha.com` routes and sitemap. OCM lives on its **own subdomain**, so it is invisible to Watch. |
| The Worker | No new `www` path, no new sitemap entry, no `wrangler` anything. |
| `compute/` | Untouched. It has its own release build, provenance chain and CI. See [`docs/OVERLAP.md`](docs/OVERLAP.md). |
| GitHub Pages | `pages.yml` uploads the repo root, so `ocm/` is mirrored to `uuriko.github.io/dasha-desk/ocm/`. Harmless — nothing links to it — but the repository is public, so **never commit a credential here**. |

## Relationship to `compute/`

`compute/` is a shipped open alpha of a *very* similar idea (community Macs,
OpenAI-shaped routing, Ollama). OCM is the same problem with different core
decisions: outbound WSS instead of HTTP polling, MLX instead of Ollama,
gateway-side metering and a ledger instead of no billing.

The merge question is **deferred on purpose**. `docs/OVERLAP.md` records what is
reusable and what is not, so the decision is made on evidence rather than now.

## Layout

```text
ocm/
  gateway/     OpenAI-compatible gateway: WS host registry, routing, streaming, metering
    ws.mjs       minimal RFC 6455 server framing (dependency-free)
    server.mjs   HTTP + WebSocket, host selection, failover, cancellation
    ledger.mjs   append-only usage log; balances are folded, never stored
  agent/       host agent — outbound WSS, backoff, runtime adapters
  tests/       end-to-end over a real socket with stub hosts
  scripts/     preflight, cost and credential helpers
  docs/        architecture, AWS account, DNS, overlap, decisions
  infra/       (later) IaC for gateway + ledger
```

## Run the core loop locally

Costs nothing and needs no AWS. Requires Node 22+, [uv](https://docs.astral.sh/uv/)
and [Ollama](https://ollama.com/).

```bash
# terminal 1 — gateway
OCM_HOST_TOKEN=dev-host OCM_API_KEY=ocm_dev node ocm/gateway/server.mjs

# terminal 2 — host agent (uv resolves its own isolated runtime)
OCM_HOST_TOKEN=dev-host OCM_MODEL_MAP="ocm-coder=codellama:latest" \
  uv run ocm/agent/agent.py

# terminal 3 — any OpenAI client, unmodified
export OPENAI_BASE_URL=http://127.0.0.1:8080/v1
export OPENAI_API_KEY=ocm_dev
```

```bash
uv run ocm/agent/agent.py --doctor      # is the local chain serving?
uv run ocm/agent/agent.py --benchmark   # local throughput
cd ocm && npm test                      # 9 end-to-end tests
```

`ocm/` keeps its own `package.json`, so the root `npm test` chain is untouched.

## What is proven, and what is not

Verified locally against `codellama:7b` through Ollama:

- A host holds an outbound socket; the gateway routes into it and streams back.
- Complete and SSE-streamed responses, OpenAI-shaped, through `[DONE]`.
- **The unmodified `openai` Python SDK works against the gateway** — model listing, completions and streaming. Compatibility is the distribution strategy (PDF §03), so this is the claim most worth testing early.
- Metering counts at the gateway and ignores what the host claims it used.
- A host failing before any byte reaches the client is retried elsewhere and earns nothing.

Not yet proven, and honestly out of reach here:

- **MLX / Metal.** This developer machine is an Intel i9, so MLX cannot run at all. Decision #3 needs the first `mac2-m2` host, where the first thing to check is whether Metal is reachable headless.
- **Socket stability across residential links** — needs real hosts, and is one of the two numbers §05 says actually matter.
- Anything on AWS. No resource has been created beyond an IAM user and a cost budget.

## Start here

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the PDF, distilled, with open questions kept open.
2. [`docs/AWS-ACCOUNT.md`](docs/AWS-ACCOUNT.md) — **where credentials come from**, and the cost facts that decide the shape of v1.
3. [`docs/DNS.md`](docs/DNS.md) — **the CNAME records to create**.
4. [`docs/OVERLAP.md`](docs/OVERLAP.md) — `compute/` reuse assessment.

## Local setup

```bash
cd ocm
direnv allow            # pins AWS_PROFILE/AWS_REGION to this directory only
./scripts/aws-preflight.sh
```

`direnv` is already installed. The profile is pinned in `ocm/.envrc`, not at the
repo root, so existing work in this repo never picks up the OCM account by accident.
