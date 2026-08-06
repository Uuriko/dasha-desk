# dasha desk

**Open mint desk for `$dasha` on Solana.**

Static webapp: mint lock · @dash_eats quotes · live Dex numbers · CA checker · share pack · buy/chart links.

No backend. No wallet connect. No fake roadmap.

| | |
|--|--|
| **Repo** | https://github.com/Uuriko/dasha-desk |
| **Live (Pages)** | https://uuriko.github.io/dasha-desk/ |
| **Webflow shell** | https://johns-awesome-project-39b1b5.webflow.io/dasha |
| **Mint** | `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump` |

## Quick start

```bash
git clone https://github.com/Uuriko/dasha-desk.git
cd dasha-desk
python3 -m http.server 8766
# → http://127.0.0.1:8766/
```

## Features

| Feature | Description |
|---------|-------------|
| **Mint** | Official CA, one-click copy, QR |
| **Quotes** | Short @dash_eats lines (public posts) |
| **Numbers** | Price / mcap / liq / vol from Dexscreener public API |
| **Checker** | Paste any mint → match / no match |
| **Share** | Copy pack + draft on X |
| **Rails** | Jupiter, Dex, Solscan, Birdeye, Rugcheck, Phantom, TG |

## Config

Coin-facing data: [`config/dasha.json`](config/dasha.json)  
App body: [`src/app.html`](src/app.html) · full page: [`index.html`](index.html)

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md).

**GitHub Pages** from `main` (root).  
**Webflow:** embed `src/app.html` inline — do not iframe hosts with `X-Frame-Options: DENY`.

## License

[MIT](LICENSE)

**Not included:** claiming official endorsement by Dasha Nekrasova, Red Scare, or @dash_eats.

## Disclaimer

Culture coins can go to zero. This software is not financial, legal, or tax advice.

## Product

**dasha desk** — open-source mint desk. `$dasha` is the flagship config.
