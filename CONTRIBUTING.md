# Contributing

This guide is for **open-source project contributors** (code, docs, ideas on GitHub).
It is not a payment, airdrop, bag check, or paid program.

There is nothing to join. Open a pull request and you are a contributor — no invite, no org access,
no application.

**Product context:** [getdasha.com open source](https://www.getdasha.com/#oss) · live desk [getdasha.com/dasha](https://www.getdasha.com/dasha)

**Start here:** [good first issues](https://github.com/Uuriko/dasha-desk/contribute) · pinned [Ideas welcome](https://github.com/Uuriko/dasha-desk/issues/7)

## No setup needed

For a typo, wording, a dead link, or any doc change, you never have to leave the browser:

1. Open the file on GitHub, click the **pencil**.
2. Edit it — GitHub forks the repo for you.
3. **Propose changes** → **Create pull request**.

No clone, no Node, no build.

## Claim a good first issue

1. Open [github.com/Uuriko/dasha-desk/contribute](https://github.com/Uuriko/dasha-desk/contribute).
2. Comment that you want it (e.g. “I’d like to take this”).
3. Open a PR that references the issue (`Closes #N`).

If you get stuck, comment on the issue with what you tried. If you drop it, leave a note so someone else can pick up.

## Make a code change

1. Branch from `main`.
2. Edit `src/` (or the relevant document). Do **not** hand-edit generated `index.html` / `dist/` / `src/app.html`.
3. Regenerate and check:

   ```bash
   node build.mjs --write
   npm ci
   npm test
   ```

4. Open a pull request that says what changed and how it was checked.

Good first contributions include keyboard and screen-reader fixes, clearer loading or error states, dead-link fixes, performance work, tests, and documentation.

For a larger idea, [open an issue](https://github.com/Uuriko/dasha-desk/issues/new/choose) with the smallest useful first slice — crypto infra, consumer UX, or creative tools are all fair game.

## What the `impact:` labels mean

Issues carry an `impact:` label, and it is not decoration. A merged pull request scores points on the
public [Simp Board](https://www.getdasha.com/#simp):

| Label | Points |
|---|---:|
| `impact:tiny` | 5 |
| `impact:small` | 15 |
| `impact:medium` | 40 |
| `impact:large` | 100 |
| `impact:critical` | 200 |

A PR scores when it is merged, is not a draft, targets an allowed base branch, and has an approving
review from **someone other than its author**. Bot accounts are rejected. There are caps — per
season, per rolling seven days, and on total points per season — so the board measures contribution
rather than volume, and so nobody can farm it by splitting one change into twenty.

**Points are recognition and nothing else.** They are not a payment, not a token allocation, not an
airdrop, not a claim on anything, and not a statement about anyone's worth. They are a number next to
a name on a public page. If you want the change more than the number, you have understood it
correctly.

The scoring rules live in `dasha-simp-oss-scorer.mjs` in the operator's repo and are covered by
tests. If a merged PR of yours is not scored and you think it should have been, say so on the issue.

## Guardrails

- No price predictions, targets, returns, or urgency.
- No fabricated holders, volume, endorsements, or quotes.
- No implied endorsement by a real person or use of their likeness to promote the token.
- No custody of funds or keys.
- Record rights before adding third-party media.
- Report security-sensitive findings privately through [SECURITY.md](SECURITY.md).

Be kind, attribute sources, and never commit secrets.
