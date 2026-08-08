# Contributing

There is nothing to join. Open a pull request and you are a contributor — no invite, no org access,
no application.

**Roadmap is community input.** Browse [good first issues](https://github.com/Uuriko/dasha-desk/labels/good%20first%20issue) or the pinned [Ideas welcome](https://github.com/Uuriko/dasha-desk/issues/7) thread.

## No setup needed

For a typo, wording, a dead link, or any doc change, you never have to leave the browser:

1. Open the file on GitHub, click the **pencil**.
2. Edit it — GitHub forks the repo for you.
3. **Propose changes** → **Create pull request**.

No clone, no Node, no build.

## Claim a good first issue

1. Find an open issue with the `good first issue` label.
2. Comment that you want it (e.g. “I’d like to take this”).
3. Open a PR that references the issue (`Closes #N`).

If you get stuck, comment on the issue with what you tried. If you drop it, leave a note so someone else can pick up.

## Make a code change

1. Branch from `main`.
2. Edit `src/` (or the relevant document). Do **not** hand-edit generated `index.html` / `dist/` / `src/app.html`.
3. Regenerate and check:

   ```bash
   node build.mjs --write
   node build.mjs --check
   node dasha-share.test.mjs
   node dasha-oss-docs.test.mjs
   node dasha-mint-consistency.test.mjs
   ```

4. Open a pull request that says what changed and how it was checked.

Good first contributions include keyboard and screen-reader fixes, clearer loading or error states, dead-link fixes, performance work, tests, and documentation.

For a larger idea, [open an issue](https://github.com/Uuriko/dasha-desk/issues/new/choose) with the smallest useful first slice — crypto infra, consumer UX, or creative tools are all fair game.

## Guardrails

- No price predictions, targets, returns, or urgency.
- No fabricated holders, volume, endorsements, or quotes.
- No implied endorsement by a real person or use of their likeness to promote the token.
- No custody of funds or keys.
- Record rights before adding third-party media.
- Report security-sensitive findings privately through [SECURITY.md](SECURITY.md).

Be kind, attribute sources, and never commit secrets.
