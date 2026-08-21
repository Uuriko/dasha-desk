# Deploy dasha desk

Production: [getdasha.com/dasha](https://www.getdasha.com/dasha)

## Watch production — Worker source of record (2026-08-21)

`node watch.mjs` reads **visitors' HTML**. Verify reads this repo. Verify is green on `14033779`; Watch is red because the live Cloudflare Worker drifted.

**SoR for www routing, pretty URLs, OAuth starts, sitemap, `/bounties.json`, and lobby client bytes is `Uuriko/demigod-ops` worker-tree / dasha-2.** This repository has no Worker. Do not invent one here. Do not `wrangler deploy` from here. Do not weaken `watch.mjs` to hide a live bug.

`node watch.mjs --json` on 2026-08-21 (follow redirects):

| FAIL | Why |
|------|-----|
| `/studio`: CC0 gone | `GET /studio` **without** follow is `308 Location: https://www.getdasha.com/`. Watch follows and scores Home, which has no dedication. |
| `/studio`: likeness carve-out gone | Same 308. Repo `studio/loader.html` still has both lines. |
| `home` / `lobby` / `studio` pin `x-connect.js` `sha384-pF9pJa2E4m1ec…` but the asset serves `sha384-q6VZkHCxl9FIn…` | Live `https://lobby.getdasha.com/client/x-connect.js` is a 15-byte stub (`/* x-connect */`). Pages still pin the old hash, so the browser refuses the script. **This repo does not pin `x-connect.js`.** |

Warnings (do not fail the job): Simp board still on live Home; `/desk` 308s to `/` instead of `/dasha`; live `/lobby` is the Forum shell (`x-dasha-edge: lobby-page`), not the Simp paste.

### Worker work this repo cannot ship

1. **Stop 308ing product routes to Home.** `GET` without follow, 2026-08-21: `/studio`, `/dasha`, `/desk`, `/privacy` → `308 https://www.getdasha.com/`. Serve `/studio` and `/dasha` as 200 (Webflow paste or Worker HTML that still carries CC0 + likeness + mint). `/desk` should 301/302 to `/dasha`, not to `/`. `/privacy` should 200 with the privacy paste.
2. **Fix `x-connect.js` SRI atomically.** Either restore the bytes that match `sha384-pF9pJa2E4m1ec3sbkjve5zpRsWdDNj6/rTNDT+KrPBM3Z3AaciDDfANfMfmqzbjY`, or deploy a real client and rewrite every pin in the same change, or remove the `<script>` if X-connect is retired. Pinning the 15-byte stub would silence Watch and still ship a dead script.
3. **Pretty URLs + sitemap.** Live `sitemap.xml` (`x-dasha-edge: sitemap`) lists `/`, `/simp`, `/lobby`, `/forum`, `/bounties`, `/how-to-buy`, `/chess`, … and omits `/studio`, `/dasha`, `/privacy`. Add those once they 200 again.
4. **`/oauth/x/start` and `/oauth/github/start` must not 404 on www.** Today `www.getdasha.com/oauth/{github,x}/start` is `404` (`x-dasha-edge: html-404`). `lobby.getdasha.com/oauth/x/start` is 200 (Connect X). `lobby.getdasha.com/oauth/github/start` is 200 honest HTML (“GitHub linking is not on yet”, status `configured: false`). The board in this repo already uses the lobby host. Worker should 302 www `/oauth/*` to lobby, or serve the same handlers. Do not 404.
5. **`/bounties/feed.json`** still 404s. Live feed is `/bounties.json` (`x-dasha-edge: bounties-feed`, CORS `*`, `schema: dasha-bounties-feed/v1`, “We don't hold it.”). Optional alias; do not invent the Worker here.

### Hunt notes (not Watch FAILs)

- Acid / hot on live surfaces: `#070608` / `#dfff00` / `#ff3b81`. No Demigod hire copy. No retired thesis/conviction/forecasting products.
- Live `/bounties` (`x-dasha-edge: bounties`) is a Worker stub with “USDC on Solana. We don’t hold it.” GitHub-required + X-optional UI is in `bounties/app.html`; the Worker page does not mount it.
- Live Home still hosts Simp (warning). Dead/stub Home links the Worker owns: `/login` (142-byte “Login”), `/simp` (157-byte stub). `/chess`, `/forum`, `/how-to-buy`, `/bounties` 200. Repo `home/index.html` correctly links `/studio` and `/dasha` — those pretty URLs are what the Worker must restore.
- Feeds/clients that matter send `Access-Control-Allow-Origin: *` (`/bounties.json`, Pages feeds, `simp-board.js`, `x-connect.js`).
- Apex `getdasha.com` already 301s to www. `HEAD /how-to-buy` is 200 today.

Watch is done when it exits 0 against production. That requires the Worker change above. This repo can only keep pastes honest.

## Build

Edit only `src/body.html`, `src/styles.css`, `src/app.js`, or `config/dasha.json`, then run:

```bash
node build.mjs --write
npm ci
npm test
```

`npm test` checks generated-file drift, sharing, public documentation, mint consistency and browser
resilience. Do not publish a partial test sequence as equivalent to this gate.

Generated surfaces:

| File | Use |
|------|-----|
| `src/app.html` | Inline Webflow embed |
| `index.html` | Repository / static-host page |
| `dist/index.html` | Self-contained single file |

Do not hand-edit generated files.

## Preview

```bash
python3 -m http.server 8766
# http://127.0.0.1:8766/           desk (repo root)
# http://127.0.0.1:8766/home/
# http://127.0.0.1:8766/lobby/
# http://127.0.0.1:8766/bounties/
# http://127.0.0.1:8766/privacy/
# http://127.0.0.1:8766/studio/
# http://127.0.0.1:8766/404.html
```

## Webflow

Paste `src/app.html` into the `/dasha` HTML embed. Webflow owns production metadata and publishing; the embed owns the Desk markup, styles, and behavior.

Paste `home/index.html` into `/` — live ticker, one H1, one Studio CTA, mint + buy, one culture still. Live `/` still has `#simp` / “Simp board.” (curled 2026-08-13 ~20:19 ET). Quiz pills are already gone (0 hits). Do not ship Simp on Home — that is `/lobby`. Drop the site-wide `WebFont.load` of Exo / Bangers / Raleway. Favicon stays acid cherries.

Paste `lobby/index.html` into `/lobby` once the Worker stops serving the Forum shell there. Mount Simp here. Pin is live `simp-board.js` (hashed in that file from 2026-08-21 bytes: `sha384-UTvrCJlUnlRpT2IJpsLh7/PCpHxqEqdqeM2OX5eNrDdBWVBpesms1soa7Usd5jyG`). Do not iframe. Pasting the 2026-08-14 pin (`sha384-3yeE9T…`) would refuse the current script.

Paste `studio/loader.html` into `/studio` (or the self-contained `studio/index.html`) **after** the Worker stops 308ing `/studio` to `/`. Drop `.dgnav`. Do not leave the thin loader pointed at a lobby script the browser will refuse.

**Studio SRI (do not invent a hash):**

| Pin | src | integrity |
| --- | --- | --- |
| In-repo Pages embed (`studio/loader.html`, `studio/README.md`) | `https://uuriko.github.io/dasha-desk/studio/embed-f585862e4a23.js` | `sha384-d3dEbIusqMDABXzoLw3eNLTtAtnTCZlLu94yfzeHNQnRetwa+XxyI7zQxTmgZP+M` |
| Live lobby `studio.js` (not stored in this repo; hashed 2026-08-21 from live bytes so a Webflow pin can match later) | `https://lobby.getdasha.com/client/studio.js` | `sha384-x6tEQWfTy8VSFXTSyFUQKgqa2IQdLEXmPCo4rplH6KRn3/0F7yElQBVJ6F/VabMk` |

This repo’s loader pins the Pages embed, not lobby `studio.js`. Live pages also pin `https://lobby.getdasha.com/client/x-connect.js` at `sha384-pF9pJa2E4m1ec…` while the Worker serves a 15-byte stub — that pin does not exist in this repo.

Paste `bounties/app.html` into `/bounties` as an HTML embed. Do not iframe GitHub Pages. `node bounties/embed-build.mjs` regenerates the fragment.

`/bounties` on www is 200 (`x-dasha-edge: bounties`) — a Worker stub with USDC + “We don’t hold it.”, not the in-repo board and not a Pages iframe. Live `https://www.getdasha.com/bounties.json` is 200 (`x-dasha-edge: bounties-feed`, listings schema, CORS `*`) — not a Webflow page-JSON trap. `https://www.getdasha.com/bounties/feed.json` still 404s. This repo has no Worker that can change those paths. Do not invent one here.

Paste `privacy/index.html` into a real `/privacy` page **after** the Worker stops 308ing `/privacy` to `/`. Live `/privacy` is `308 → /` (curled 2026-08-21).

Paste `desk/index.html` into `/desk` (or set a 301 `/desk` → `/dasha`). Live `/desk` is `308 → /`. Live `/dasha` is also `308 → /` — Desk is not reachable on www until the Worker is fixed.

**404 is two jobs.** `404.html` in this repo is the GitHub Pages miss page. Unknown www paths are already real HTTP 404s (`x-dasha-edge: html-404`, ink/acid branded “Not this page.”). Replacing that host 404 is a **separate** paste of `404.html` only if the Worker stops owning it. Apex `getdasha.com` already 301s to www. This PR does not publish either.

Live `https://www.getdasha.com/sitemap.xml` is served by a Cloudflare edge worker (`x-dasha-edge: sitemap`), not by a file in this repository. Adding a sitemap here would not update www.

## GitHub Pages

`.github/workflows/pages.yml` deploys the repository root from `main` to [uuriko.github.io/dasha-desk](https://uuriko.github.io/dasha-desk/). The custom production URL remains canonical.
