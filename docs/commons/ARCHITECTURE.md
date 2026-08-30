# Commons architecture (measured 2026-08-30 ~12:00 AM PT)

Short map of production truth, this repo, and the first Commons slice. Not a novel.

## Canonical production source

Live [www.getdasha.com](https://www.getdasha.com/) is Cloudflare Worker **dasha-lobby** (www + lobby). This GitHub repo is pastes, docs, Watch, Compute source, and now Commons schemas. It is **not** the live runtime.

Do not `wrangler deploy` from here. Do not Designer-publish. GitHub Pages is a mirror.

**Live Worker is ahead of this repo** for `/bounties`, `/faucet`, `/digest`, sitemap, and OAuth. A green Verify here does not mean www matches `bounties/`.

## Bounty source of truth

Measured Sun 2026-08-30 ~12:00 AM PT. One feed. Empty `listings` is honest, not a bug.

| Surface | What it actually is |
| --- | --- |
| `GET /bounties` | **200**, `x-dasha-edge: bounties`, `text/html`. After style/script strip (measured Sun 2026-08-30 ~1:15 AM PT): `Bounties` / `USDC on Solana. We don’t hold it.` / `Pick a good first issue` / `No funded bounties right now.` / footer Home · How to buy · Privacy. No leftover Simp lecture. No `plugin.jup.ag`. **Does not load** this repo's `board.js`. Wallet not required. |
| `GET /bounties.json` | **200** `application/json`, `x-dasha-edge: bounties-feed`. Exact body pinned at `commons/fixtures/live-bounties.json`: `{ name, schema: dasha-bounties-feed/v1, note, url, listings: [] }`. |
| 404 (not feeds) | `/bounties/api` `/bounties/feed` `/api/bounties` `/bounties/feed.json`. Do not invent these. |
| `bounties/feed.json` + root `bounties.json` | Same v1 schema on Pages. Two **unfunded** seed rows (`payTo: null`, `payoutStatus: "not_implemented"`). Live Worker correctly shows none. |
| `bounties/board.js` | Client board paste. `canList` requires `payTo`. Pay opens a Solana Pay URL. Browse stays wallet-free. |
| GitHub issue workflow | `.github/ISSUE_TEMPLATE/bounty-project.yml`. Zero open `bounty-project` issues today. |
| Watch fixture | Live shape (`listings`). Counts `listings` then `items`. Page fixture uses recommended empty copy, not the leftover lecture. |

**Leftover lecture:** measured Sun 2026-08-30 ~1:15 AM PT, live `/bounties` no longer carries “Open-source contributions need no wallet, holder status, or Simp Points.” Worker already patched. Empty line is **No funded bounties right now.** Keep USDC + we don't hold it + the first-issue link. Do not paste the lecture back. This repo still does not wrangler-deploy.

**Hypothesis held:** live `/bounties` is a read-only listing. Commons **adapts** `dasha-bounties-feed/v1`. It does not fork a second board or a second URL.

## Trust model v1

Creator funds → participants submit work/proof → creator chooses winner → winner gets paid.

Today's getdasha board is weaker than that loop: **declared destination, not escrow**. A `payTo` is who receives USDC if someone clicks Pay. There is no funding tx, no submission object, no winner selection, no settlement observation. The adapter says `funding.state: "declared"` or `"unfunded"`. It does **not** pretend seed rows are funded.

If escrow appears later: document who holds the key, how refunds work, and every failure mode. v1 prefers user-signed settlement. This repo must not store private keys.

## Routes / Worker boundaries

Contract: [`docs/ROUTES.md`](../ROUTES.md). Watch: `watch.mjs`. Deploy: [`docs/DEPLOY.md`](../DEPLOY.md).

- `/bounties` 200 when listings exist (Watch still checks the page when the feed is reachable).
- `/bounties.json` is Worker-owned. Adding JSON here does not update www.
- `/digest` is the live `$dasha Tape` (price/liq). That is **not** the Commons Activity Tape.
- `/faucet` is Worker-owned (`x-dasha-edge: faucet`). Lobby API is the jar. See faucet seam below.
- `/oauth/github/status` → `{ configured: false, error: "not_configured" }`. Board CTA stays "GitHub soon".
- Desk (`src/app.js`) never connects a wallet. Keep it that way.

## Auth / session / wallet

| Who | Auth | Wallet |
| --- | --- | --- |
| Desk / Home / Privacy | none | none |
| Board (`board.js`) | GitHub required to list/claim/pay (lobby OAuth, **not configured**). X optional, same lobby session as Simp. | Pay uses `solana:` / Phantom browse. No Wallet Adapter on every page. |
| Live `/bounties` | none | none |
| Faucet | X age / rate limits on the Worker | Operator **signer: true** (Worker signs the drop) |

Read-only browsing stays. Wallet only when the user must sign or move funds.

## Generated files / CI / deploy

Edit sources, then generate:

- Desk: `src/body.html` + `src/styles.css` + `src/app.js` + `config/dasha.json` → `node build.mjs --write`
- Studio / bounties embeds: `studio/embed-build.mjs`, `bounties/embed-build.mjs`
- Do **not** hand-edit `index.html`, `dist/`, `src/app.html`, `bounties/app.html`, hashed Studio embeds

CI (`.github/workflows/verify.yml`): `npm ci --ignore-scripts` + `npm test` + Studio/bounties embed `--check`. `watch.yml` hits live www. `pages.yml` mirrors `main` to uuriko.github.io. Commons tests ride `npm test`.

## Conflicting PRs (checked 2026-08-30)

| PR | Status | Overlap |
| --- | --- | --- |
| [#33 Watch + live contract](https://github.com/Uuriko/dasha-desk/pull/33) | **Merged.** Already on `main`. We inherit it. Do not reopen. |
| [#32 Worker-first OSS](https://github.com/Uuriko/dasha-desk/pull/32) | **Closed, not merged.** Do not take its `worker/` tree. This repo still does not invent a Worker. |
| [#43 accepted-work ledger](https://github.com/Uuriko/dasha-desk/pull/43) | Open. Complementary. Maintainer-accepted GitHub PRs + reward **state**, not bounty settlement. Different schema. |
| [#44 OCM](https://github.com/Uuriko/dasha-desk/pull/44) | Open. Isolated under `ocm/`. No bounty files. |

#45 Pocket / #46 Commons / #47 micro-bounties are **one primitive**, not four products. This slice is Commons + the existing USDC feed.

Remote `bounty-github-cta-honesty` has no open PR against current main.

## Current production failures / drift

- Live `/bounties` is a stub. Repo `bounties/` is a fuller board that www does not mount.
- Pages feed still lists two unfunded seeds; live feed is empty. Honest, but easy to misread as "www is stale" in the wrong direction. **www is the SoR.**
- GitHub OAuth dark — list/claim/pay cannot complete on the board paste.
- `docs/ARCHITECTURE.md` Watch row still says "compute retired"; live `/compute` is a 200 product page (`docs/ROUTES.md` + `watch.mjs` are correct).
- `CHANGELOG.md` / `docs/DEPLOY.md` still talk as if `/compute` were 410. Worker won.
- Watch used to count `bounties.json` `items`; production uses `listings`.

## This slice

`commons/` is one reusable module (not five empty packages):

- schemas + state machine (token-agnostic)
- adapter so `dasha-bounties-feed/v1` consumes and emits Commons records
- Activity Tape event shape (not the live price digest)
- tests for transitions, idempotency, legacy feeds

`board.js` now ingests `listings`, `items`, or Commons `bounties` without changing published seed JSON or URLs.

Signed loop (PR #49): `commons/loop.mjs` + `commons/tx.mjs` walk create → fund → submit → select → pay. Wallet only on Fund/Pay after a click. Simulated signer for CI and `?demo=1`. Board “This device” is localStorage, not the live feed. Funding/settlement signatures are evidence, not custody. No escrow. No live listings written.

Activity Tape (PR #50): human kinds only — created, funded, submitted, selected, paid, cancelled — from the existing event model. Stable ids + idempotency. Chain-observed vs app-generated. Lives on `/bounties`, not `/digest`. Observers later call `eventFromWebhook`. No Helius SDK.

Consume (this follow-up): one folder. Import `schema.mjs` + `machine.mjs` + `loop.mjs` + `tape.mjs`. `adapter.mjs` is the getdasha profile and is optional. See [CONSUME.md](CONSUME.md). No npm workspace. No `exports` map — this repo does not have that pattern.

Out of this PR: live Worker deploy, Community Starter Kit, Helius integration, Pocket app, faucet rewrite, a real wallet adapter.

## Pocket (#45)

**Separate repo: [Uuriko/dasha-pocket](https://github.com/Uuriko/dasha-pocket).** This tree is static pastes, Watch, Compute source, and schemas. Solana Mobile (MWA + Seed Vault) needs Android Gradle, Play signing, and Seeker hardware. Putting that toolchain here would tax every mint/docs PR. Do not wrap getdasha.com in a WebView. See [POCKET.md](POCKET.md).

## Faucet / rewards seam (inspect only)

Live jar: `/faucet` + `https://lobby.getdasha.com/faucet` + `/faucet/tape`.

Observed 2026-08-30: `configured: true`, `funded: true`, 100 `$DASHA` (mint `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`), `cooldownDays: 1`, `dailyCap: 48`, `hourlyCap: 12`, `minXAgeDays: 7`, `autoPaused: false`, `signer: true`, treasury `DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb`. Tape rows: `sig`, `amountUi`, `at`, `from`.

This is already a **rate-limited small-distribution primitive** (caps, cooldown, identity age, public fill tape). Commons can later describe that as `commons.drop/v1`. Do **not** rewrite the live faucet from this repo. Trust difference: the Worker signs the drop (operator key). Bounty v1 should stay user-signed.

## Future (named, not built)

Multiple winners, judges, voting, oracles, milestones, refunds as a product, SOL/SPL/stablecoin beyond the reward record, HTTP API/SDK, embeddable cards, third-party communities. Keep the state names; add fields with a schema bump.
