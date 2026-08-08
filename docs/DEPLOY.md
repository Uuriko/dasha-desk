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
```

## Webflow

Paste `src/app.html` into the `/dasha` HTML embed. Webflow owns production metadata and publishing; the embed owns the Desk markup, styles, and behavior.

## GitHub Pages

`.github/workflows/pages.yml` deploys the repository root from `main` to [uuriko.github.io/dasha-desk](https://uuriko.github.io/dasha-desk/). The custom production URL remains canonical.
