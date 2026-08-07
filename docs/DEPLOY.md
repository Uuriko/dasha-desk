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
- the Webflow root is a separate working **Dasha Labs** thesis-card tool, while the mint desk lives at `/dasha`;
- neither page emits `rel=canonical` or `og:url`, the root does not link to the desk, and the generated sitemap is unavailable.

Cutover order:

1. Preserve the current Dasha Labs tool at `/labs`, including its form behavior and metadata.
2. Make the mint desk the Webflow root from canonical `src/app.html`; add visible reciprocal links between `/` and `/labs`.
3. Permanently redirect legacy `/dasha` and `/dasha/` requests to `/`, preserving query strings.
4. Add the custom domain in Webflow and copy the site-specific DNS records it returns; do not reuse remembered Webflow IP addresses.
5. Preserve unrelated MX/TXT records, verify ownership, publish, and confirm SSL.
6. Use `www.getdasha.com` as the sole canonical host and permanently redirect the apex and staging hostname.
7. Set page-specific absolute canonical/OG URLs, block staging indexing, enable the generated sitemap, and list only `/` and `/labs`.

Acceptance evidence: apex and `www` resolve; one redirects permanently to the other; `/` serves the mint desk; `/labs` preserves the thesis tool; `/dasha` redirects permanently to `/`; both pages link to each other; certificate coverage is valid; `/robots.txt`, `/sitemap.xml`, canonical tags, OG images, and every internal link use the production host.

Run the live audit at any point:

```bash
node launch-check.mjs --prelaunch         # unavailable infrastructure is warning-only
node launch-check.mjs --prelaunch --json  # machine-readable receipt
node launch-check.mjs --launch            # production requirements are failures
```

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
