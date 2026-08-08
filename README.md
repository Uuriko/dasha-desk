# dasha

Open-source tools for `$dasha` on Solana — static, honest, remixable. Two of them live here.

**[studio/](studio/)** — the Meme Studio. Make an image in your browser: six looks, three formats,
PNG and animated GIF out. One self-contained HTML file, no account, no upload, works offline.
[Use it ↗](https://www.getdasha.com/studio)

**the desk** (this directory) — check the mint against independent explorers, then one neutral
Jupiter route. [Use it ↗](https://www.getdasha.com/dasha)

Neither connects a wallet or moves anything. Everything the Studio exports is public domain.

[GitHub Pages demo](https://uuriko.github.io/dasha-desk/) · [Website](https://www.getdasha.com) · [Site: open source](https://www.getdasha.com/#oss)

![Dasha desk — mint, sources, buy rails](assets/desk-demo.gif)

## Start contributing (open-source project)

This is **code and docs contribution** to the public MIT repo — not a payment, bag check, or paid program. Open a pull request and you are a project contributor. No invite.

**Fastest path (no clone):**

1. Open **[good first issues](https://github.com/Uuriko/dasha-desk/contribute)** (GitHub’s `/contribute` page).
2. Or fix a typo in the browser: open a file → pencil → **Propose changes** → PR.
3. Full guide: [CONTRIBUTING.md](CONTRIBUTING.md)

Also: [open an idea or bug](https://github.com/Uuriko/dasha-desk/issues/new/choose) · [ROADMAP.md](docs/ROADMAP.md)

CI runs build drift, share tests, and OSS doc checks on every PR.

## What it does

- keeps the associated mint visible and easy to copy
- checks pasted addresses against that mint
- remembers **last check on this device** (local only) and warns if the mint string changes
- shows public market data with clear offline fallbacks
- links explorers, chart, and one neutral Jupiter route
- ships as static HTML, CSS, and JavaScript (no wallet connect)

**Roadmap is community input** — open an issue and propose what to build next (infra, consumer, creative). Adding a new Studio look is the most self-contained change here; [studio/README.md](studio/README.md) walks through it.

## Run it

```bash
git clone https://github.com/Uuriko/dasha-desk.git
cd dasha-desk
python3 -m http.server 8766
# → http://127.0.0.1:8766/
```

After changing sources:

```bash
node build.mjs --write
node build.mjs --check
node dasha-share.test.mjs
node dasha-oss-docs.test.mjs
node dasha-mint-consistency.test.mjs
```

Runtime sources: [`src/body.html`](src/body.html) · [`src/styles.css`](src/styles.css) · [`src/app.js`](src/app.js) · [`config/dasha.json`](config/dasha.json)

`src/app.html`, `index.html`, and `dist/index.html` are **generated** — do not edit by hand.

## Trust

No wallet, no custody, no price promises. Third-party data can fail; mint and source paths stay usable. Association with public culture is **not endorsement**.

[MIT](LICENSE) for code · [asset attribution](assets/ATTRIBUTION.md) for media · [Code of conduct](CODE_OF_CONDUCT.md)
