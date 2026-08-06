# Deploy dasha desk

## Live

| Surface | URL |
|---------|-----|
| **Repo** | https://github.com/Uuriko/dasha-desk |
| **GitHub Pages** | https://uuriko.github.io/dasha-desk/ (after Actions/Pages enable) |
| **Standalone single-file** | https://files.catbox.moe/cm5fmq.html |
| **Webflow shell** | https://johns-awesome-project-39b1b5.webflow.io/dasha |

## Local

```bash
cd dasha-desk
python3 -m http.server 8766
# → http://127.0.0.1:8766/
```

## GitHub Pages

Workflow: `.github/workflows/pages.yml` deploys the repo root on every push to `main`.

**Status:** Actions workflow is live on the repo; `configure-pages` fails until Pages is first enabled for the repo (Settings → Pages → Source: **GitHub Actions**). After that one enable, subsequent pushes publish to https://uuriko.github.io/dasha-desk/.

Until then, use **Webflow** (primary product surface) or **catbox** single-file.

## Single-file / zero-build host

`dist/index.html` is a self-contained build (CSS+JS inlined). Re-upload to any static host:

```bash
curl -sF "reqtype=fileupload" -F "fileToUpload=@dist/index.html" https://catbox.moe/user/api.php
```

## Webflow

Paste **`src/app.html`** into an **HtmlEmbed** (inline). Do **not** iframe catbox — `X-Frame-Options: DENY` blocks embeds. GitHub Pages also often denies framing; inline is the reliable path.

## Cloudflare Pages / Netlify

Connect `Uuriko/dasha-desk`, publish root, no build command.
