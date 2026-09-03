# Dasha Compute · open alpha

**[Live product](https://www.getdasha.com/compute)** ·
**[Project index](https://uuriko.github.io/dasha-desk/compute/)** ·
**[Source map](SOURCE_MAP.md)** ·
**[Download source](https://www.getdasha.com/dasha-compute-open-alpha.tar.gz)**

An independently written, local-first proof of concept for routing OpenAI-shaped chat requests to community-run model providers. It is designed to become the compute surface at `getdasha.com/compute` without copying Darkbloom code, branding, prose or private protocols.

Version 0.3 supports both a local coordinator and the live getdasha.com community queue. The bundled local coordinator works as follows:

1. a client submits `POST /v1/chat/completions`;
2. the coordinator holds the job in volatile memory;
3. a provider polls outbound over HTTPS;
4. the provider calls its local Ollama model;
5. the result returns as a complete OpenAI-shaped response or streamed SSE chunks.

`console/` also includes the full React/CSS interface and the deliberately unavailable hosted-alpha routes, so the public artifact contains both sides of the product rather than only the daemon code.

It has real request routing, streaming and end-to-end tests. The live queue instead stores short-lived jobs in a Durable Object and adds account-bound registration, hashed revocable credentials, rate limits, and complete or SSE-streamed responses. Neither mode has billing, hardware attestation or operator-blind prompts. Do not send secrets. See `THREAT_MODEL.md`.

## Join the live community network

Log in at `https://www.getdasha.com/compute`. First paint is one step: **Use** or **Provide**. Use is one prompt and **Run**. Hosted is Workers AI. After the first successful run, Night, Build, status, and network open. Provide sizes the Mac and returns a one-time provider token. Write that token to a 0600 file. Do not put it on argv.

Dasha stores only the token hash; live provider tokens and developer keys are account-bound and owner-revocable. The live queue supports complete and SSE-streamed responses. Ordinary queued and leased prompts are stored in the Durable Object until completion, failure, cancellation or expiry; terminal paths clear or delete prompt text, while completed answers, errors or chunks receive a ten-minute expiry and are removed by a subsequent prune. Night Shift retains its assignment prompt and up to five artifacts until the task is deleted.

On macOS, the live Provide paste writes that token to a 0600 file and runs `./install.sh` without putting the token on argv. The installer verifies the complete connection, stores the provider token in Keychain, installs a persistent `launchd` service, and adds `~/bin/dasha-compute`. Manage it with:

```bash
dasha-compute status
dasha-compute doctor
dasha-compute benchmark
dasha-compute logs
dasha-compute restart
dasha-compute uninstall
```

## Run it

Prerequisites: Node 20+, Python 3.10+, and [Ollama](https://ollama.com/) on the provider machine.

```bash
curl -fLO https://www.getdasha.com/dasha-compute-open-alpha.tar.gz
tar -xzf dasha-compute-open-alpha.tar.gz
cd dasha-compute-open-alpha

# terminal 1 · coordinator
DASHA_API_KEY=consumer-secret \
DASHA_PROVIDER_KEY=provider-secret \
npm start

# terminal 2 · provider
ollama pull qwen3:8b
DASHA_PROVIDER_KEY=provider-secret \
DASHA_MODEL_MAP=qwen3-8b=qwen3:8b \
python3 provider/agent.py

# terminal 3 · client
DASHA_API_KEY=consumer-secret python3 examples/chat.py
```

The coordinator binds to `127.0.0.1` by default. Put it behind a real HTTPS reverse proxy before any remote test. Never expose the default keys.

Before joining a test, check the complete local chain:

```bash
python3 provider/agent.py --doctor
```

The doctor exits nonzero when the coordinator, Ollama, or any configured model is unavailable.

Measure actual model throughput with `python3 provider/agent.py --benchmark`. Set `DASHA_BENCHMARK_TOKENS` between 16 and 256 to trade speed for a longer calibrated run.

## Verify or build the source archive

The repository builds the download from an explicit source allowlist. Every archive
uses normalized paths, ownership, modes and timestamps; contains a
`SOURCE-MANIFEST.sha256` for its extracted files; and ships beside an external archive
checksum and deterministic `release.json`.

```bash
npm run release:build
(cd dist && shasum -a 256 -c dasha-compute-open-alpha.tar.gz.sha256)
tar -tzf dist/dasha-compute-open-alpha.tar.gz
```

Main-branch builds are also linked to GitHub build provenance. After downloading the
tarball from the **Compute release** workflow, verify that provenance with:

```bash
gh attestation verify dasha-compute-open-alpha.tar.gz --repo Uuriko/dasha-desk
```

Provenance connects bytes to a repository workflow and commit; it does not prove that
the software is secure. Review this source, `SECURITY.md`, and `THREAT_MODEL.md` before
running an alpha provider.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/healthz` | Process health |
| `GET` | `/v1/models` | OpenAI-shaped model list |
| `GET` | `/v1/network` | Aggregate provider and job counts |
| `POST` | `/v1/chat/completions` | Complete or SSE-streamed chat completion |
| `POST` | `/v1/providers/poll` | Provider heartbeat and job lease |
| `POST` | `/v1/providers/jobs/:id/result` | Provider result |
| `POST` | `/v1/providers/jobs/:id/chunk` | Provider stream delta or completion |

The live `https://lobby.getdasha.com/compute/api` queue also renews active leases at `POST /providers/jobs/:id/heartbeat`; cancellation clears the queued prompt immediately and is returned by that heartbeat.

## Live OpenAI-compatible API

After first success, **Build** shows the OpenAI base URL `https://lobby.getdasha.com/compute/api/v1`. Create a developer key there. The live gateway supports model discovery plus complete and SSE-streamed chat completions through online community providers. Hosted chat on the page is Workers AI, not this queue.

```bash
curl https://lobby.getdasha.com/compute/api/v1/chat/completions \
  -H "Authorization: Bearer $DASHA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-8b","messages":[{"role":"user","content":"hello"}]}'
```

## Deliberate differences

- The protocol is small, original and documented by the code itself.
- Providers poll with ordinary HTTPS so the first version is deployable almost anywhere.
- There is no claim that provider operators cannot inspect prompts.
- `$dasha` is not required for use or payment. A holder badge, queue access and community recognition can be layered on later without making a volatile token the accounting unit.
- Self-hosting and self-routing remain free.

## Local coordinator production path

The live queue already uses durable storage, hashed account-bound credentials and basic quotas. For the bundled dependency-free local coordinator:

1. Replace in-memory maps with Postgres and a durable queue.
2. Add per-user API-key hashing, quotas, idempotency and abuse controls.
3. Add hard Ollama request aborts and stream backpressure limits.
4. Sign model manifests and provider releases; publish reproducible build instructions.
5. Encrypt queued payloads to provider keys and extend this threat model for that design.
6. Commission a security review before any stronger privacy claim.
7. Add USDC/USD metering and compliant payouts only after demand exists.

## Test

```bash
npm test
```

The tests start isolated coordinators, simulate providers, verify both complete responses and OpenAI-compatible SSE chunks through `[DONE]`, and prove that two clean release builds have identical bytes and complete source manifests.

## License

MIT. Model weights keep their own licenses. The `$dasha` name and cultural references are not a grant of rights in any third-party person, likeness or brand.
