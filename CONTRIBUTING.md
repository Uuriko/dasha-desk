# Contributing to dasha desk

## Boundaries

- Keep the product static and dependency-free unless current evidence requires otherwise.
- Preserve the exact associated mint, one neutral Jupiter route, independent sources, and visible risk disclosure.
- Do not add wallet claims, forecasts, FOMO, raids, referrals, Telegram, invented quotes, or endorsement claims.
- Do not revive the permanently retired Thesis Card, receipts, or forecasting concepts.
- Report security-sensitive mistakes through [`SECURITY.md`](SECURITY.md), not a public issue with details.

## Make a change

1. Edit `src/body.html`, `src/styles.css`, `src/app.js`, and/or `config/dasha.json`.
2. Run the complete local gate:

```bash
node build.mjs --write
node build.mjs --check
node dasha-share.test.mjs
```

3. Open a focused pull request explaining the user-visible reason and verification result.

Do not hand-edit `src/app.html`, `index.html`, or `dist/index.html`; the build generates them.

Small fixes to accessibility, mobile behavior, source accuracy, mint/link validation, and clear risk communication are welcome. Product expansion needs observed user demand rather than speculative infrastructure.
