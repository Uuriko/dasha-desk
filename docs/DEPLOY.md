# Deploy dasha desk

Production is [www.getdasha.com](https://www.getdasha.com/), owned by Cloudflare Worker
**dasha-lobby** (www + lobby routes). Source ships from the operator Worker tree.

This repository is static pastes, docs, and Watch. It is **not** the live Worker.
Do not invent a Worker here. Do not `wrangler deploy` from here. Do not Designer-publish.

Live buy path: [getdasha.com/how-to-buy](https://www.getdasha.com/how-to-buy).
`/dasha` and `/desk` 308 there. `/studio` is retired (308 home). `/privacy` is a real 200 page.

The route map Watch asserts is [`ROUTES.md`](ROUTES.md).

## Build

Edit only `src/body.html`, `src/styles.css`, `src/app.js`, or `config/dasha.json`, then run:

```bash
node build.mjs --write
npm ci
npm test
```

`npm test` checks generated-file drift, sharing, public documentation, mint consistency,
browser resilience, and the local Watch contract (`node watch.mjs --fixture`). Do not
publish a partial test sequence as equivalent to this gate.

Generated surfaces:

| File | Use |
|------|-----|
| `src/app.html` | Inline embed for a host page |
| `index.html` | Repository / static-host page |
| `dist/index.html` | Self-contained single file |

Do not hand-edit generated files.

## Preview

```bash
python3 -m http.server 8766
# http://127.0.0.1:8766/           desk (repo root, not a live www product)
# http://127.0.0.1:8766/home/
# http://127.0.0.1:8766/lobby/
# http://127.0.0.1:8766/bounties/
# http://127.0.0.1:8766/privacy/
# http://127.0.0.1:8766/studio/    local/Pages Studio only — www /studio is retired
# http://127.0.0.1:8766/404.html
```

## Live contract (Worker, not this repo)

SoR for www routing, pretty URLs, OAuth starts, sitemap, `/bounties.json`, chess `var API`,
and lobby client bytes is the operator **dasha-lobby** Worker. `watch.mjs` reads visitors'
HTML. Verify reads this repo. A green Verify and a red Watch means the Worker drifted.

Do not weaken `watch.mjs` to hide a live bug. Change an expectation only when the
production contract itself changed (Studio retired, privacy is 200, desk/dasha → how-to-buy,
compute retired).

Mint stays `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`. Jupiter is `jup.ag` + mint.
Never `plugin.jup.ag`. Chess stays off Home.

`/privacy` must 200 with H1 Privacy. `/compute` is 410 or branded 404, noindex, and stays
out of the sitemap.

Live `https://www.getdasha.com/sitemap.xml` is Worker-owned (`x-dasha-edge: sitemap`).
Adding a sitemap file here would not update www.

## GitHub Pages

`.github/workflows/pages.yml` deploys the repository root from `main` to
[uuriko.github.io/dasha-desk](https://uuriko.github.io/dasha-desk/). Pages is a mirror.
www remains canonical.
