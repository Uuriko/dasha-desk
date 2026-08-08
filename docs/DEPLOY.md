# Deploy dasha desk

Production: [getdasha.com/dasha](https://www.getdasha.com/dasha)

## Build

Edit only `src/body.html`, `src/styles.css`, `src/app.js`, or `config/dasha.json`, then run:

```bash
node build.mjs --write
node build.mjs --check
node dasha-share.test.mjs
```

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

`.github/workflows/pages.yml` is ready to deploy the repository root from `main` when Pages is enabled. The repository currently has no Pages site; production does not depend on it.
