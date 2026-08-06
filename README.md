# dasha desk

**Open mint desk for `$dasha` on Solana.**

Static webapp: candidate mint evidence · @dash_eats quotes · live Dex numbers · CA comparison · share pack · buy/chart links.

No backend. No wallet connect. No fake roadmap.

| | |
|--|--|
| **Repo** | https://github.com/Uuriko/dasha-desk |
| **Live (Pages)** | https://uuriko.github.io/dasha-desk/ |
| **Standalone** | https://files.catbox.moe/cm5fmq.html |
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
| **Mint** | Associated CA, one-click copy, QR |
| **Quotes** | Short @dash_eats lines (public posts) |
| **Numbers** | Price / mcap / liq / vol from Dexscreener public API |
| **Checker** | Paste any mint → match / no match |
| **Share** | Copy pack + draft on X |
| **Rails** | Jupiter, Dex, Solscan, Birdeye, Rugcheck, Phantom |

## Config

Coin-facing data: [`config/dasha.json`](config/dasha.json)  
App body: [`src/app.html`](src/app.html) · full page: [`index.html`](index.html)

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md).

**GitHub Pages** is enabled from `main` (root).  
**Webflow:** embed `src/app.html` inline — do not iframe third-party hosts that send `X-Frame-Options: DENY`.

## License

[MIT](LICENSE)

**Not included:** claiming official endorsement by Dasha Nekrasova, Red Scare, or @dash_eats. Quotes are public posts for the `$dasha` instance.

## Disclaimer

Culture coins can go to zero. This software is not financial, legal, or tax advice. Always verify mints independently.

## Product

**dasha desk** — open-source mint desk product. `$dasha` is the flagship config.
