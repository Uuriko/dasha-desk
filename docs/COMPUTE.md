# Start. Ask · Provide · Pay · Credits

Live Dasha Compute. Match the live page; do not invent Worker source here.

Checked 2026-09-04: [`/compute`](https://www.getdasha.com/compute) **200**, title **Dasha Compute — ask the Macs**, H1 **Start.** Doors **Ask · Provide · Pay · Credits**. Gate **Log in** / **You**. After Ask, Hosted. Provide is the Mac community kit. Marketplace / Host stay quieter. [`/compute/ocm`](https://www.getdasha.com/compute/ocm) **200**, H1 **Open-Compute Marketplace**. [`/compute/ocm/provider`](https://www.getdasha.com/compute/ocm/provider) **200**, H1 **Run a provider**.

| Door | Live | Who | What happens |
| --- | --- | --- | --- |
| **Ask** | [getdasha.com/compute](https://www.getdasha.com/compute) | Anyone who logs in | After Start. Hosted gravity. Prompt → **Run**. No clone. |
| **Provide** | same page, **Provide** | Mac + Ollama | Mac community kit. **Register this Mac**. [`dasha-compute-open-alpha.tar.gz`](https://www.getdasha.com/dasha-compute-open-alpha.tar.gz) (`compute/` in this repo). Operators can read prompts. |
| **Pay** | same page, **Pay** | Anyone | Top up or sponsor. |
| **Credits** | same page, **Credits** | Anyone | Prepaid. |
| **Host** | [compute/ocm/provider](https://www.getdasha.com/compute/ocm/provider) | Apple Silicon | Quieter OCM path. Marketplace: [compute/ocm](https://www.getdasha.com/compute/ocm). Credits are not money. |

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
