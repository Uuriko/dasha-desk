# Product: dasha desk

## One-liner

**dasha desk** is an open-source static mint desk for the Solana culture coin `$dasha`.

## Jobs

1. Show the associated mint — hard to fake, easy to copy
2. One neutral Jupiter buy route (no multi-CTA pressure)
3. Visible independent source links
4. Catch reply-guy CAs — paste checker
5. Optional neutral fact pack for X (mint + source)

## Other static surfaces in this repo

- **Studio** — local image tool, no account
- **dasha bounties / the board** (`/bounties/`) — anybody can list a GitHub issue/PR or a whole project and write their own bounty rules. Static JSON feed at `/bounties/feed.json` and `/bounties.json`. GitHub issues, this-device localStorage, and shareable JSON. Accepted outcomes need a GitHub proof URL. **Declared bounties, not escrow.** The board does not hold funds.

## Non-goals

- Wallet connect / claims
- Price predictions, FOMO, raid kits, referrals, Telegram
- Backend / accounts **on the desk** (the bounties page may use this-device localStorage and public GitHub issues; still no server of our own)
- Demigod / other products
- Thesis Card, receipts, forecasting (permanently scrapped)
- Escrow, custody, or constructed payout transactions for bounties


## Name

| Term | Meaning |
|------|---------|
| **dasha desk** | This open-source product |
| **$dasha** | The token (mint in config) |
| **@dash_eats** | Public X account referenced by quotes/links |
| **dasha bounties / the board** | Bulletin board for owner-written issue and project bounties |

## Version

- **0.1** — single-file static app + config snapshot + MIT

## Product boundary

Dasha Desk is the live coin/source/community landing product. Thesis, receipt and forecasting products are permanently retired and are not part of Dasha. The bounties board is a separate static page: owners write their own rules for a GitHub item or a project; listings come from a JSON feed, open GitHub issues, localStorage, and shareable JSON. Outcomes must link a GitHub PR, issue, or comment. No payout execution.
