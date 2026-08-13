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
# http://127.0.0.1:8766/
# http://127.0.0.1:8766/bounties/
# http://127.0.0.1:8766/studio/
```

## Webflow

Paste `src/app.html` into the `/dasha` HTML embed. Webflow owns production metadata and publishing; the embed owns the Desk markup, styles, and behavior.

`/bounties` on www.getdasha.com is also a Webflow page: an iframe of [uuriko.github.io/dasha-desk/bounties/](https://uuriko.github.io/dasha-desk/bounties/). Webflow occupies `https://www.getdasha.com/bounties.json` as that page’s JSON export (`pageId` matches `/bounties`, gzip body, not a listings feed). `https://www.getdasha.com/bounties/feed.json` 404s. This repo has no Cloudflare Worker, Pages Functions, or `_headers` that can override those paths without replacing the HTML page. Do not invent a worker here. Agents should GET [GitHub Pages feed.json](https://uuriko.github.io/dasha-desk/bounties/feed.json) or [raw GitHub](https://raw.githubusercontent.com/Uuriko/dasha-desk/main/bounties/feed.json).

Live `https://www.getdasha.com/sitemap.xml` is served by a Cloudflare edge worker (`x-dasha-edge: sitemap`), not by a file in this repository. Adding a sitemap here would not update www. The edge sitemap currently omits `/bounties`.

## GitHub Pages

`.github/workflows/pages.yml` deploys the repository root from `main` to [uuriko.github.io/dasha-desk](https://uuriko.github.io/dasha-desk/). The custom production URL remains canonical.
