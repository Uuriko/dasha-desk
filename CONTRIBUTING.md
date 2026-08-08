# Contributing

There is nothing to join. Open a pull request and you are a contributor — no invite, no org access,
no application.

## No setup needed

For a typo, wording, a dead link, or any doc change, you never have to leave the browser:

1. Open the file on GitHub, click the **pencil**.
2. Edit it — GitHub forks the repo for you.
3. **Propose changes** → **Create pull request**.

No clone, no Node, no build.

## Make a change

1. Branch from `main`.
2. Edit `src/` or `config/dasha.json`.
3. Regenerate and check the builds:

   ```bash
   node build.mjs --write
   node build.mjs --check
   node dasha-share.test.mjs
   ```

4. Open a pull request that says what changed and how it was checked.

Good first contributions include keyboard and screen-reader fixes, clearer loading or error states, dead-link fixes, performance work, and documentation corrections.

For a larger idea, [open an issue](https://github.com/Uuriko/dasha-desk/issues/new/choose) with the smallest useful first slice.

## Guardrails

- No price predictions, targets, returns, or urgency.
- No fabricated holders, volume, endorsements, or quotes.
- No implied endorsement by a real person or use of their likeness to promote the token.
- No custody of funds or keys.
- Record rights before adding third-party media.
- Report security-sensitive findings privately through [SECURITY.md](SECURITY.md).

Be kind, attribute sources, and never commit secrets.
