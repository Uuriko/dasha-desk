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

## Open-source Simp Points

The prepared `oss-s0` season recognizes merged work without rewarding activity spam. Simp Points are public recognition only—not money, an airdrop, token utility or a claim on `$dasha`.

| Maintainer-applied label | Points | Typical scope |
|---|---:|---|
| `impact:tiny` | 5 | Typo, dead link or trivial accessibility correction |
| `impact:small` | 15 | Focused fix, useful documentation or test correction |
| `impact:medium` | 40 | Meaningful feature, UX or trust improvement with tests |
| `impact:large` | 100 | Substantial cross-surface, accessibility, security or CI improvement |
| `impact:critical` | 200 | Safely disclosed fix for an active trust or security failure |

A scored contribution must be a non-draft pull request merged into `main`, carry exactly one impact label, and have at least one approval from a human other than its author. Operators, bots, direct pushes, unmerged work, self-approval, line counts, commit counts, stars and issues alone score zero. The caps are 300 points, eight merges per 28-day season and three merges in any rolling seven days. Spam or hostile trust changes receive `simp:no-score`.

Security-sensitive reports still begin privately through [`SECURITY.md`](SECURITY.md); points never justify public disclosure of an exploit.
