# Grant evidence (this PR only)

Thesis: one layered system. `$DASHA` on getdasha.com is the reference community. Commons is the reusable slice. Pocket and standalone micro-bounties consume it. Not four grant products.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md). Live SoR is Worker **dasha-lobby**. This repo adds `commons/` (schemas, state machine, `dasha-bounties-feed/v1` adapter) without deploying www.

Trust model v1: creator funds → submit work → creator selects → winner paid. Today's board is declared-`payTo`, not escrow. The adapter says so.

## Completed in this PR

- In-repo production map (Worker vs desk, feeds, OAuth, Watch, open PRs).
- Token-agnostic bounty / submission / event / tx schemas + explicit state machine.
- Adapter: measured live `GET /bounties.json` (`listings: []`, pinned at `commons/fixtures/live-bounties.json`) consume/emit bit-identical. Empty listings is honest. 404s `/bounties/api` `/bounties/feed` `/api/bounties` `/bounties/feed.json` are not feeds. Pages seed and Watch `{ items }` still round-trip. No second URL.
- Tests: transitions, duplicate funding, double settlement, settlement retry, cancel/refund, malformed submit, expiry, stale feed, idempotent replay, legacy compat.
- Helius note (no integration). Pocket: separate repo. Faucet: inspect-only seam.
- Signed loop (this follow-up PR): `commons/loop.mjs` + simulated `Tx` port. Tests walk create→fund→submit→select→pay plus reject / sim fail / timeout / duplicate funding / double settlement / retry. Board “This device” is local only. Live `listings: []` stays honest.
- Activity Tape (follow-up): human kinds created/funded/submitted/selected/paid/cancelled from the commons event model. Duplicate webhook and idempotent ingest. Board Tape is not `/digest`. No Helius SDK.
- Consume path (follow-up): `docs/commons/CONSUME.md` + `example-community` fixture. Loop no longer imports the getdasha adapter. No monorepo.

## Not claimed

Wallet UI, live Worker mount, escrow, Helius, Pocket APK, faucet rewrite, Community Starter Kit, metrics, Colosseum demo video, "decentralized task liquidity."
