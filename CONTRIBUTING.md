# Contributing to dasha desk

## Ground rules

- Keep it **static** unless a feature truly needs a server.
- No wallet-connect claim flows.
- Don’t invent quotes. Attribute public posts only.
- Don’t claim official endorsement by Dasha / Red Scare / @dash_eats.

## How to help

1. Fork + branch.
2. Change `src/body.html`, `src/styles.css`, `src/app.js`, and/or `config/dasha.json`.
3. Run `node build.mjs --write` after source changes.
4. Verify with:

   ```bash
   node build.mjs --check
   node dasha-share.test.mjs
   ```

5. Open a PR with a short reason, screenshots for visible changes, and the verification result.

Generated files (`src/app.html`, `index.html`, and `dist/index.html`) must match the canonical sources; do not hand-edit them.

## Useful contribution lanes

- accessibility, keyboard, mobile and browser defects;
- mint/source corrections backed by a primary URL;
- provider failure handling and hostile-URL hardening;
- build, test, release and attribution integrity.

New quotes and media need a source URL plus a redistribution license or explicit permission. A public post is evidence of publication, not permission to redistribute its media.

Report wrong-mint, link-substitution, impersonation, or other security-sensitive findings through [`SECURITY.md`](SECURITY.md).
