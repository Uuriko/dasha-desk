# Commons architecture (inspected 2026-08-30)

Short map of production truth, this repo, and the first Commons slice. Not a novel.

## Canonical production source

Live [www.getdasha.com](https://www.getdasha.com/) is Cloudflare Worker **dasha-lobby** (www + lobby). This GitHub repo is pastes, docs, Watch, Compute source, and now Commons schemas. It is **not** the live runtime.

Do not `wrangler deploy` from here. Do not Designer-publish. GitHub Pages is a mirror.

**Live Worker is ahead of this repo** for `/bounties`, `/faucet`, `/digest`, sitemap, and OAuth. A green Verify here does not mean www matches `bounties/`.

## Bounty source of truth

| Surface | What it actually is (2026-08-30) |
| --- | --- |
| `https://www.getdasha.com/bounties` | Worker HTML (`x-dasha-edge: bounties`). H1 Bounties. Copy: "USDC on Solana. We don’t hold it." Body: "No funded bounties right now." **Does not load** this repo's `board.js`. |
| `https://www.getdasha.com/bounties.json` | Worker JSON (`x-dasha-edge: bounties-feed`). `schema: dasha-bounties-feed/v1`, `listings: []`. |
| `bounties/feed.json` + root `bounties.json` | Same v1 schema. Two **unfunded** seed rows (`payTo: null`, `payoutStatus: "not_implemented"`). Pages still publishes them. Live Worker correctly shows none. |
| `bounties/board.js` | Client board: GitHub issues `[bounty]` / `bounty-project`, localStorage, `#l=` share, Demigod extra feed. `canList` requires `payTo`. Pay opens a Solana Pay URL (user wallet), not an in-app connect. |
| GitHub issue workflow | `.github/ISSUE_TEMPLATE/bounty-project.yml`. Write path is `issues/new`. Zero open `bounty-project` issues today. |
| Watch fixture | Was `{ schema, items: [] }`. Live uses `listings`. Watch counted `items` only — now counts `listings` then `items`. |

**Hypothesis held:** the live Worker bounty page is a read-only listing ("We don't hold it"). This repo already had `dasha-bounties-feed/v1`. Commons **adapts** that feed. It does not fork a second board.

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

## Conflicting PRs (open 2026-08-30)

| PR | Overlap |
| --- | --- |
| [#43 accepted-work ledger](https://github.com/Uuriko/dasha-desk/pull/43) | Complementary. Maintainer-accepted GitHub PRs + reward **state**, not bounty settlement. Different schema (`dasha-accepted-work/v1`). Do not merge the two records. |
| [#44 OCM](https://github.com/Uuriko/dasha-desk/pull/44) | Isolated under `ocm/`. No bounty files. |

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

Out of this PR: live Worker deploy, wallet create→fund→submit→select→pay UI, Community Starter Kit, Helius integration, Pocket app, faucet rewrite.

## Pocket (#45)

**Separate repo.** This tree is static pastes, Watch, Compute source, and schemas. Solana Mobile (MWA + Seed Vault) needs Android Gradle, Play signing, and Seeker hardware. Putting that toolchain in dasha-desk would drag mobile CI onto every mint/docs PR. A workspace package is still the same repo tax. Ship `Uuriko/dasha-pocket` (or similar) that vendors or depends on `commons/` and reads the public feed. Do not wrap getdasha.com in a WebView.

## Faucet / rewards seam (inspect only)

Live jar: `/faucet` + `https://lobby.getdasha.com/faucet` + `/faucet/tape`.

Observed 2026-08-30: `configured: true`, `funded: true`, 100 `$DASHA` (mint `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`), `cooldownDays: 1`, `dailyCap: 48`, `hourlyCap: 12`, `minXAgeDays: 7`, `autoPaused: false`, `signer: true`, treasury `DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb`. Tape rows: `sig`, `amountUi`, `at`, `from`.

This is already a **rate-limited small-distribution primitive** (caps, cooldown, identity age, public fill tape). Commons can later describe that as `commons.drop/v1`. Do **not** rewrite the live faucet from this repo. Trust difference: the Worker signs the drop (operator key). Bounty v1 should stay user-signed.

## Future (named, not built)

Multiple winners, judges, voting, oracles, milestones, refunds as a product, SOL/SPL/stablecoin beyond the reward record, HTTP API/SDK, embeddable cards, third-party communities. Keep the state names; add fields with a schema bump.
