# Contributing to dasha desk

## Ground rules

- Keep it **static** unless a feature truly needs a server.
- No wallet-connect claim flows.
- Don’t invent quotes. Attribute public posts only.
- Don’t claim official endorsement by Dasha / Red Scare / @dash_eats.

## How to help

Use Node.js 24 or newer. The project has no package dependencies and needs no install step.

1. Fork + branch.
2. Change `src/body.html`, `src/styles.css`, `src/app.js`, and/or `config/dasha.json`.
3. Run `npm run build` after source changes.
4. Run the same deterministic gate CI uses:

   ```bash
   npm test
   ```

   `npm run evidence:live` is a separate, opt-in network check; it is not required for ordinary pull requests.

5. Open a PR with a short reason, screenshots for visible changes, and the verification result.

Generated files (`src/app.html`, `index.html`, and `dist/index.html`) must match the canonical sources; do not hand-edit them.

## Useful contribution lanes

- accessibility, keyboard, mobile and browser defects;
- mint/source corrections backed by a primary URL;
- provider failure handling and hostile-URL hardening;
- build, test, release and attribution integrity.

New quotes and media need a source URL plus a redistribution license or explicit permission. A public post is evidence of publication, not permission to redistribute its media.

Report wrong-mint, link-substitution, impersonation, or other security-sensitive findings through [`SECURITY.md`](SECURITY.md).
