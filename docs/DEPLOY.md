# Deploy dasha desk

## Live

| Surface | URL |
|---------|-----|
| **Repo** | https://github.com/Uuriko/dasha-desk |
| **GitHub Pages** | https://uuriko.github.io/dasha-desk/ (after Actions/Pages enable) |
| **Standalone single-file** | https://files.catbox.moe/sm5mo0.html |
| **Webflow shell** | https://johns-awesome-project-39b1b5.webflow.io/dasha |

## Custom domain launch gate

`getdasha.com` is not launch-ready as of 2026-08-06:

- Webflow site `5f1458122ba25e70a3ff2bd0` reports `customDomains: []`;
- both `getdasha.com` and `www.getdasha.com` fail DNS resolution from the project host;
- the Webflow root page is still titled “John's Awesome Project”; Dasha currently lives at `/dasha`.

Cutover order:

1. Make the Dasha landing experience the Webflow root and keep every important surface reachable through ordinary links.
2. Add the custom domain in Webflow and copy the site-specific DNS records it returns; do not reuse remembered Webflow IP addresses.
3. Preserve unrelated MX/TXT records, verify ownership, publish, and confirm SSL.
4. Use `www.getdasha.com` as the sole canonical host and permanently redirect the apex, staging hostname, and duplicate paths.
5. Set absolute canonical/OG URLs, block staging indexing, enable the generated sitemap, and verify its routes.

Acceptance evidence: apex and `www` resolve; one redirects permanently to the other; the canonical root returns the Dasha page over HTTPS; certificate coverage is valid; `/robots.txt`, `/sitemap.xml`, canonical tags, OG image, and every internal link use the production host.

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

## GitHub Pages

Workflow: `.github/workflows/pages.yml` deploys the repo root on every push to `main`.

**Status:** Actions workflow is live on the repo; `configure-pages` fails until Pages is first enabled for the repo (Settings → Pages → Source: **GitHub Actions**). After that one enable, subsequent pushes publish to https://uuriko.github.io/dasha-desk/.

Until then, use **Webflow** (primary product surface) or **catbox** single-file.

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
