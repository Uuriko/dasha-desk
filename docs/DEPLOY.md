# Deploy dasha desk

## Live

| Surface | URL |
|---------|-----|
| **Repo** | https://github.com/Uuriko/dasha-desk |
| **GitHub Pages** | Not live; the repository has not enabled Pages |
| **Standalone single-file** | https://files.catbox.moe/sm5mo0.html |
| **Webflow shell** | https://johns-awesome-project-39b1b5.webflow.io/dasha |

## Local

```bash
cd dasha-desk
python3 -m http.server 8766
# → http://127.0.0.1:8766/
```

## Build gate

Edit only `src/body.html`, `src/styles.css`, `src/app.js`, or `config/dasha.json`, then run:

```bash
node build.mjs --write
node build.mjs --check
```

Do not hand-edit `src/app.html`, `index.html`, or `dist/index.html`; they are generated deployment surfaces.

The standalone builds intentionally omit `og:image` and `twitter:image` until the current Dasha social card has a verified public HTTPS asset URL. They canonicalize to `https://www.getdasha.com/dasha`. Webflow owns the production social image metadata after its asset upload; never restore the retired Catbox casino image or invent a future URL.

## GitHub Pages

Workflow: `.github/workflows/pages.yml` verifies the generated files and browser behavior, then deploys the repo root on every push to `main`.

**Status:** Actions workflow is live on the repo; `configure-pages` fails until Pages is first enabled for the repo (Settings → Pages → Source: **GitHub Actions**). After that one enable, subsequent pushes publish to https://uuriko.github.io/dasha-desk/.

Until then, the public product surface is **Webflow**. `dist/index.html` remains available for a future static host.

## Single-file / zero-build host

`dist/index.html` is the generated self-contained build (CSS+JS inlined). Re-upload to any static host:

```bash
curl -sF "reqtype=fileupload" -F "fileToUpload=@dist/index.html" https://catbox.moe/user/api.php
```

## Webflow

Paste **`src/app.html`** into an **HtmlEmbed** (inline). Do **not** iframe catbox — `X-Frame-Options: DENY` blocks embeds. GitHub Pages also often denies framing; inline is the reliable path.

## Cloudflare Pages / Netlify

Connect `Uuriko/dasha-desk`, publish root, no build command.

## Research notes

Landing copy and media ledger: [`docs/X-RESEARCH-DASHA-2026-08-06.md`](X-RESEARCH-DASHA-2026-08-06.md).
