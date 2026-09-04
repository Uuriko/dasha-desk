# Ask vs Provide vs Host

Live Dasha Compute is three jobs. Match these live pages; do not invent Worker source here.

Checked 2026-09-04: [`/compute`](https://www.getdasha.com/compute) **200**, title **Dasha Compute — ask the Macs**, H1 **Ask.** (Ask-first Hosted cold start; quiet Provide / Marketplace / Host). [`/compute/ocm`](https://www.getdasha.com/compute/ocm) **200**, H1 **Open-Compute Marketplace**. [`/compute/ocm/provider`](https://www.getdasha.com/compute/ocm/provider) **200**, H1 **Run a provider**.

| Job | Live | Who | What happens |
| --- | --- | --- | --- |
| **Ask** | [getdasha.com/compute](https://www.getdasha.com/compute) | Anyone who logs in | Cold start is Ask + Hosted. Prompt → engine (Hosted / Community / Mixture) → **Run**. No clone. |
| **Provide** | same page, **Provide** | Mac + Ollama | **Register this Mac**. Kit: [`dasha-compute-open-alpha.tar.gz`](https://www.getdasha.com/dasha-compute-open-alpha.tar.gz) (`compute/` in this repo). Community queue. Operators can read prompts. |
| **Host** | [compute/ocm/provider](https://www.getdasha.com/compute/ocm/provider) | Apple Silicon | OCM provider agent. Marketplace: [compute/ocm](https://www.getdasha.com/compute/ocm). Credits are not money. |

## What lives in this repo

| Path | Job |
| --- | --- |
| [`compute/`](../compute/) | Community **open-alpha kit** (local coordinator + outbound Ollama provider). **Not** the live Worker. |
| [`ocm/`](../ocm/) | Open-Compute Marketplace source. **On `main`** via [#76](https://github.com/Uuriko/dasha-desk/pull/76) + [#131](https://github.com/Uuriko/dasha-desk/pull/131). Do not merge raw [#44](https://github.com/Uuriko/dasha-desk/pull/44); #44 was closed, not merged. |
| Cloudflare Worker | Live www + lobby + Ask / Provide / Hosted. **Not cloned** in this repository. |

## Alpha limits

- Experimental. Do not send secrets. Provider operators can read prompts.
- OCM credits count tokens served. They are **not money**, billing, payout, or on-chain settlement.
- Do not wrangler-deploy from here. Do not Designer-publish. Do not merge #44.

MIT. Kit: [`compute/README.md`](../compute/README.md). OCM: [`ocm/README.md`](../ocm/README.md).
