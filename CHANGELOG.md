# Changelog

## v0.1.1 — unreleased (main)

- **Helius note:** measured WSS / DAS / Sender steer from support (2026-08-30). No SDK. No keys. See `docs/commons/HELIUS.md`.
- **External community:** hostable `commons.bounty-feed/v1` fixture (`harbor`) runs create → fund → submit → select → pay → tape with leaf imports only. Not a live community on www. See `docs/commons/EXTERNAL.md`.
- **Pocket spike:** [Uuriko/dasha-pocket](https://github.com/Uuriko/dasha-pocket) holds the Android seed. This repo documents the boundary (`docs/commons/POCKET.md`). Verify does not build Gradle.
- **Commons consume:** other Solana projects import `commons/` leaf files. Adapter is optional. See `docs/commons/CONSUME.md`.
- **Activity Tape:** created / funded / submitted / selected / paid / cancelled on `/bounties`. Commons events, not `/digest`. Dedupe by idempotency key. No Helius SDK.
- **Signed bounty loop:** create → fund → submit → select → pay on this-device board rows. Simulated tx port for CI. Wallet only on Fund/Pay. No escrow. Live feed unchanged.
- **Commons bounty schemas:** token-agnostic records + state machine in `commons/`, adapter for `dasha-bounties-feed/v1`. Existing seed JSON and `/bounties` URLs unchanged. Live Worker still owns www. See `docs/commons/ARCHITECTURE.md`.
- **Watch / Worker contract:** `watch.mjs` asserts live dasha-lobby, not a fantasy product. Studio/verse/learn/graph 308 home. `/dasha` `/desk` 308 `/how-to-buy`. `/privacy` 200 H1 Privacy. `/compute` retired. Chess `var API` must be the lobby host. Local `node watch.mjs --fixture`. Do not invent a Worker in this repo. Supersedes the Studio-live Watch contract.
- **This-week surfaces:** Home is ticker + stills (no Simp). Simp on `/lobby`. Native `/bounties` (List needs USDC + `payTo`). `/privacy`. `/desk` and `/dasha` go to `/how-to-buy`. In-repo `404.html` (host 404 is a separate paste). Live `/bounties.json` is the edge feed.
- **Desk on the five-token poster spine:** ink / paper / acid / hot / violet. Hard 4px offsets, acid CTAs, no lavender glass dashboard.
- **Home / Studio / Bounties paste:** Home is ticker + one H1 + one Studio CTA (no Simp board). Studio loader is paper on ink and pins the Pages embed. Bounties paste is `app.html`, not an iframe.
- **Leftover QA:** empty `payTo` hides Pay (em dash, not a dead button). README notes `/desk` 404s — desk is `/dasha`.
- **Honest bounty payTo:** published feed listings never ship `"payTo": ""`. No dest is `payTo: null` plus `payoutStatus: "not_implemented"`. We don't hold it.
- **dasha bounties / the board** at `/bounties`: sparse USDC-on-Solana board. GitHub required to list/claim/pay; X optional via lobby.getdasha.com (same popup as Simp Board). Feed `schema: dasha-bounties-feed/v1`. We don't hold it.
- **Honest GitHub CTA:** the board labels GitHub connect "GitHub soon" unless lobby `/oauth/github/status` reports `configured: true`. The crawlable link still hits the real start URL (which says the worker secrets are missing). Nav in the GitHub Pages iframe uses canonical getdasha.com URLs so Home/Studio are not 404s on uuriko.github.io.
- **Last-visit stamp** on the mint card: this browser only records when you last checked the associated mint and warns if the mint string differs from your previous visit (no server).
- **Desk market age:** relative age of the last *successful* Dex fetch, still counting if a later refresh fails.
- **Studio Surprise me** in `.go`: random look + format, caption from that look's line, never the look already selected.
- Contributor guide: claim good first issues; expanded verify commands.
- Home site (getdasha monorepo): mint paste-check on the token panel (shipped with site publish).

## v0.1.0 — 2026-08-08

- Community-ready desk: demo GIF, CI verify workflow, mint consistency test, OSS docs test.
- Good first issues + pinned Ideas welcome.
- Aria-labels on copy controls.
