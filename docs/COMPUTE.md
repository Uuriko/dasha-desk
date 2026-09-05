# Start. Ask / Provide

Live Dasha Compute. Match the live page; do not invent Worker source here.

Checked 2026-09-05: [`/compute`](https://www.getdasha.com/compute) **200**, title **Dasha Compute — ask the Macs**, H1 **Start.** Primary **Ask** / **Provide**. Quiet **Pay** / **Credits**. Gate **Sign in** / **You**. Provide: **Prefer MLX when you can · Ollama ≥0.33.1 · models on internal SSD.** Credits / Pay: **USDC or $dasha · no card yet.** [`/compute/ocm`](https://www.getdasha.com/compute/ocm) **200**, H1 **Open-Compute Marketplace**. [`/compute/ocm/provider`](https://www.getdasha.com/compute/ocm/provider) **200**, H1 **Run a provider**.

| Door | Live | Who | What happens |
| --- | --- | --- | --- |
| **Ask** | [getdasha.com/compute](https://www.getdasha.com/compute) | Anyone who signs in | After Start. Hosted **Run**. No clone. |
| **Provide** | same page, **Provide** | Mac | **Prefer MLX**. Register this Mac. Kit: [`dasha-compute-open-alpha.tar.gz`](https://www.getdasha.com/dasha-compute-open-alpha.tar.gz) (`compute/` here). Operators can read prompts. |
| **Pay** / **Credits** | same page, quiet | Anyone | USDC or `$dasha`. No card yet. Credits are prepaid, **not money**. |
| **Host** | [compute/ocm/provider](https://www.getdasha.com/compute/ocm/provider) | Apple Silicon | Quieter OCM path. Marketplace: [compute/ocm](https://www.getdasha.com/compute/ocm). |

## What lives in this repo

| Path | Job |
| --- | --- |
| [`compute/`](../compute/) | Community **open-alpha kit** (local coordinator + outbound Ollama provider). **Not** the live Worker. |
| [`ocm/`](../ocm/) | Open-Compute Marketplace source. **On `main`** via [#76](https://github.com/Uuriko/dasha-desk/pull/76) + [#131](https://github.com/Uuriko/dasha-desk/pull/131). Do not merge raw [#44](https://github.com/Uuriko/dasha-desk/pull/44); #44 was closed, not merged. |
| Cloudflare Worker | Live www + lobby + **Start.** **Not cloned** in this repository. |

## Alpha limits

- Experimental. Do not send secrets. Provider operators can read prompts.
- OCM credits count tokens served. They are **not money**, billing, payout, or on-chain settlement.
- Do not wrangler-deploy from here. Do not Designer-publish. Do not merge #44.

MIT. Kit: [`compute/README.md`](../compute/README.md). OCM: [`ocm/README.md`](../ocm/README.md).
