# Contributing to dasha desk

## Ground rules

- Keep it **static** unless a feature truly needs a server.
- No wallet-connect claim flows.
- Don’t invent quotes. Attribute public posts only.
- Don’t claim official endorsement by Dasha / Red Scare / @dash_eats.

## How to help

1. Fork + branch.
2. Change `src/body.html`, `src/styles.css`, `src/app.js`, and/or `config/dasha.json`.
3. Run `node build.mjs --write && node build.mjs --check`.
4. Open a PR with a short why and verification result.

## Ideas welcome

- Load `config/dasha.json` at runtime
- Better mobile layout
- Holder-count from public APIs
- Multi-theme CSS variables
- A repository-local browser interaction test with no duplicated application logic
