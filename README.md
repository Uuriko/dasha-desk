# dasha desk

Open-source mint desk for `$dasha` on Solana — static, honest, remixable.

[Live desk](https://www.getdasha.com/dasha) · [GitHub Pages demo](https://uuriko.github.io/dasha-desk/) · [Website](https://www.getdasha.com) · [Studio](https://www.getdasha.com/studio)

![Dasha desk — mint, sources, buy rails](assets/desk-demo.gif)

## What it does

- keeps the associated mint visible and easy to copy
- checks pasted addresses against that mint
- shows public market data with clear offline fallbacks
- links explorers, chart, and one neutral Jupiter route
- ships as static HTML, CSS, and JavaScript (no wallet connect)

This repo is the Desk. Home and Studio are linked for context. **Roadmap is community input** — open an issue and propose what to build next (infra, consumer, creative).

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
```

Runtime sources: [`src/body.html`](src/body.html) · [`src/styles.css`](src/styles.css) · [`src/app.js`](src/app.js) · [`config/dasha.json`](config/dasha.json)

`src/app.html`, `index.html`, and `dist/index.html` are **generated** — do not edit by hand.

## Contribute

Anyone can contribute. Start small or go ambitious.

- [Good first issues](https://github.com/Uuriko/dasha-desk/labels/good%20first%20issue)
- [Open an idea or bug](https://github.com/Uuriko/dasha-desk/issues/new/choose)
- [CONTRIBUTING.md](CONTRIBUTING.md) · [ROADMAP.md](docs/ROADMAP.md)

CI runs build drift, share tests, and OSS doc checks on every PR.

## Trust

No wallet, no custody, no price promises. Third-party data can fail; mint and source paths stay usable. Association with public culture is **not endorsement**.

[MIT](LICENSE) for code · [asset attribution](assets/ATTRIBUTION.md) for media
