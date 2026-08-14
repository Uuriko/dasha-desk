# Deploy dasha desk

Production: [getdasha.com/dasha](https://www.getdasha.com/dasha)

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

Paste `lobby/index.html` into `/lobby` (live is already 200). Mount Simp here. Pin is live `simp-board.js` (hashed in that file from 2026-08-14 bytes). Do not iframe.

Paste `studio/loader.html` into `/studio` (or the self-contained `studio/index.html`). Drop `.dgnav`. Do not leave the thin loader pointed at a lobby script the browser will refuse.

**Studio SRI (do not invent a hash):**

| Pin | src | integrity |
| --- | --- | --- |
| In-repo Pages embed (`studio/loader.html`, `studio/README.md`) | `https://uuriko.github.io/dasha-desk/studio/embed-2315460c555a.js` | `sha384-N0Vm3A+TxwHEMMhSrLyA8DUAcm3ggzoPeuqzJpeFrpMGtwXV0oK2dVyW+GEieNZk` |
| Live lobby `studio.js` (not stored in this repo; hashed 2026-08-14 from live bytes so a Webflow pin can match later) | `https://lobby.getdasha.com/client/studio.js` | `sha384-rwyBrN9MFswysun8gGdKfRSOByQyA3zYhRxZvaBlcw6abIyHL9k5UVb4cfFaiuQL` |

This repo’s loader pins the Pages embed, not lobby `studio.js`.

Paste `bounties/app.html` into `/bounties` as an HTML embed. Do not iframe GitHub Pages. `node bounties/embed-build.mjs` regenerates the fragment.

`/bounties` on www is 200 and still a Webflow iframe of [uuriko.github.io/dasha-desk/bounties/](https://uuriko.github.io/dasha-desk/bounties/) — replace that iframe with the paste. Live `https://www.getdasha.com/bounties.json` is 200 (`x-dasha-edge: bounties-feed`, listings schema) — not a Webflow page-JSON trap. `https://www.getdasha.com/bounties/feed.json` still 404s. This repo has no Worker that can change those paths. Do not invent one here.

Paste `privacy/index.html` into a real `/privacy` page. Live `/privacy` is a host 404.

Paste `desk/index.html` into `/desk` (or set a Webflow 301 `/desk` → `/dasha`). Live `/desk` is a host 404. `/dasha` is 200.

**404 is two jobs.** `404.html` in this repo is the GitHub Pages miss page. Unknown www paths are already real HTTP 404s (generic Webflow “Page not found”). Replacing that host 404 is a **separate Webflow 404-page paste** of `404.html`. Apex `getdasha.com` already 301s to www. This PR does not publish either.

Live `https://www.getdasha.com/sitemap.xml` is served by a Cloudflare edge worker (`x-dasha-edge: sitemap`), not by a file in this repository. Adding a sitemap here would not update www.

## GitHub Pages

`.github/workflows/pages.yml` deploys the repository root from `main` to [uuriko.github.io/dasha-desk](https://uuriko.github.io/dasha-desk/). The custom production URL remains canonical.
