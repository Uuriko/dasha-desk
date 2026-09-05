# Live www vs this repository

**Dated:** 2026-09-05

**Evidence:** `curl -sSI --max-redirs 0` of the www routes below. `/compute` recurl 2026-09-05; other rows last curled 2026-09-04. Contract: [`ROUTES.md`](ROUTES.md), `watch.mjs`.

**Not claimed:** a deploy from this repo, a partnership, or that `compute/` or `ocm/` *are* the live Worker.

Live [www.getdasha.com](https://www.getdasha.com/) is the operator Cloudflare Worker **dasha-lobby** (www + lobby hosts). This repository does not contain that Worker. Do not invent one here. Do not `wrangler deploy` from here. Do not Designer-publish.

If another doc still says `/compute` is retired, this file and [`ROUTES.md`](ROUTES.md) win. That line was the 2026-08-25 intended contract; live `/compute` is a 200 product page.

## Surfaces

| Surface | State | Source of record | Curl 2026-09-04 (no follow) |
| --- | --- | --- | --- |
| www `/` | Live Worker | dasha-lobby; [`ROUTES.md`](ROUTES.md); `node watch.mjs` | 200 · title `$dasha` · H1 `It’s time $dasha.` |
| www `/how-to-buy` | Live Worker | same | 200 · title `How to buy $dasha` · H1 `How to buy $dasha` |
| www `/lobby` | Live Worker | same | 200 · title `$dasha Lobby` · H1 `Lobby` |
| www `/simp` | Live Worker | same | 200 · title `$dasha / Beat this` · H1 `Simp` |
| www `/bounties` | Live Worker | same | 200 · title `Bounties — $dasha` · H1 `Bounties` |
| www `/privacy` | Live Worker | same | 200 · title `Dasha privacy` · H1 `Privacy` |
| www `/compute` **Start.** | Live Worker | [getdasha.com/compute](https://www.getdasha.com/compute) | 200 · title `Dasha Compute — ask the Macs` · H1 `Start.` · Ask / Provide · quiet Pay / Credits · gate Sign in / You · Prefer MLX · USDC or $dasha |
| www `/compute/ocm` | Live Worker / OCM console | that URL | 200 · title `OCM console` · H1 `Open-Compute Marketplace` |
| www `/compute/ocm/provider` | Live Worker / OCM console | that URL | 200 · title `Run a provider` · H1 `Run a provider` |
| `compute/` in this repo | Experimental open-alpha kit | this tree; not the Worker | not a www route |
| `ocm/` in this repo | **On `main`** (MIT) | landed via [#76](https://github.com/Uuriko/dasha-desk/pull/76) (includes [#131](https://github.com/Uuriko/dasha-desk/pull/131)); raw [#44](https://github.com/Uuriko/dasha-desk/pull/44) closed, not merged | not a www route |
| www `/studio` | Retired 308 home | [`ROUTES.md`](ROUTES.md) | 308 · `Location: https://www.getdasha.com/` |
| `studio/` in this repo | Local / Pages only | [`studio/README.md`](../studio/README.md) | not a www product |

## Notes

- `compute/` is a browseable MIT open-alpha kit (local coordinator, provider, console, protocol tests). The live product is the Worker page at `/compute`. Experimental: provider operators can read prompts; do not send secrets.
- `ocm/` is on `main` under the repo MIT license. #76 is the merged lane. #131 was stacked into that lane. Do not merge raw #44 — it was closed for provenance, not as a second dump.
- www `/studio` is retired. The `studio/` folder is the local / GitHub Pages copy only.

No deploy, partnership, or payment is claimed here. Routes not listed above were not curled for this file.
