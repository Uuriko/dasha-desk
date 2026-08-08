# dasha desk

An open-source mint desk for `$dasha` on Solana.

[Live desk](https://www.getdasha.com/dasha) · [Website](https://www.getdasha.com) · [Meme Studio](https://www.getdasha.com/studio)

## What it does

- keeps the associated mint visible and easy to copy
- checks pasted addresses against that mint
- shows public market data with clear fallback states
- links to independent explorers, the chart, and one neutral Jupiter route
- works as static HTML, CSS, and JavaScript

This repository contains the Desk. The wider website and Studio are linked above for context.

## Run it

```bash
git clone https://github.com/Uuriko/dasha-desk.git
cd dasha-desk
python3 -m http.server 8766
# http://127.0.0.1:8766/
```

After changing a source file:

```bash
node build.mjs --write
node build.mjs --check
node dasha-share.test.mjs
```

Canonical sources:

- [`src/body.html`](src/body.html)
- [`src/styles.css`](src/styles.css)
- [`src/app.js`](src/app.js)
- [`config/dasha.json`](config/dasha.json)

`src/app.html`, `index.html`, and `dist/index.html` are generated. Do not edit them by hand.

## Contribute

Small fixes are welcome: accessibility, clearer error states, resilient public data, performance, docs, or less code.

- [Open an issue](https://github.com/Uuriko/dasha-desk/issues/new/choose)
- Read [CONTRIBUTING.md](CONTRIBUTING.md)
- See the small [roadmap](docs/ROADMAP.md)

## Trust

The Desk never asks for a wallet or private key. It makes no price predictions and does not custody funds. Third-party links and data can fail; the mint and source paths should remain usable when they do.

Code is [MIT licensed](LICENSE). Media and external data retain their original rights; see [asset attribution](assets/ATTRIBUTION.md). Association with public culture is not endorsement.
