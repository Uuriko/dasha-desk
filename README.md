# dasha desk

**Unofficial, open-source mint verification desk for `$dasha` on Solana.**

Verify the associated mint, inspect independent sources and risk, and use one neutral Jupiter buy route. No backend, wallet connection, referral links, or price promises.

> **Status:** early alpha. The source in this repository is current; the public Webflow embed may lag it.

| | |
|--|--|
| **Live desk** | https://www.getdasha.com/dasha |
| **Repo** | https://github.com/Uuriko/dasha-desk |
| **Associated mint** | `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump` |

## What it does

- displays the associated mint with copy and paste-to-check tools;
- links the public source post and independent Solana explorers;
- provides one Jupiter buy route and a separate chart link;
- creates a neutral fact pack with mint, source, chart, and risk context;
- keeps the risk disclosure visible: culture coins can go to zero.

The public association is not an endorsement by Dasha Nekrasova, Red Scare, or `@dash_eats`.

## Run locally

```bash
git clone https://github.com/Uuriko/dasha-desk.git
cd dasha-desk
node build.mjs --check
python3 -m http.server 8766
# open http://127.0.0.1:8766/
```

There is no install step. The app is static HTML, CSS, and JavaScript.

## Source and verification

Edit [`src/body.html`](src/body.html), [`src/styles.css`](src/styles.css), [`src/app.js`](src/app.js), or [`config/dasha.json`](config/dasha.json), then regenerate and verify:

```bash
node build.mjs --write
node build.mjs --check
node dasha-share.test.mjs
```

Generated files are [`src/app.html`](src/app.html) for Webflow, [`index.html`](index.html) for static hosting, and [`dist/index.html`](dist/index.html) for a self-contained build. Do not edit them by hand.

## Product boundaries

This project deliberately does not include wallet custody, claims, forecasts, FOMO copy, raid kits, referrals, Telegram, a backend, or accounts. The Thesis Card, receipts, and forecasting concepts are permanently retired and are not part of Dasha.

See [`docs/PRODUCT.md`](docs/PRODUCT.md) for the product contract, [`CONTRIBUTING.md`](CONTRIBUTING.md) before proposing a change, and [`docs/DEPLOY.md`](docs/DEPLOY.md) for deployment surfaces.

## Security and trust

Wrong mints, substituted buy links, hostile external data, and impersonation are security issues. Follow [`SECURITY.md`](SECURITY.md) and do not publish exploit details in an issue.

Always verify the mint independently before swapping. This software is not financial, legal, or tax advice.

## License

[MIT](LICENSE) covers project code and original documentation. Third-party media is not automatically MIT-licensed; see [`assets/ATTRIBUTION.md`](assets/ATTRIBUTION.md).
