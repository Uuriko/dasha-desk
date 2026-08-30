# Grant evidence (this PR only)

Thesis: one layered system. `$DASHA` on getdasha.com is the reference community. Commons is the reusable slice. Pocket and standalone micro-bounties consume it. Not four grant products.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md). Live SoR is Worker **dasha-lobby**. This repo adds `commons/` (schemas, state machine, `dasha-bounties-feed/v1` adapter) without deploying www.

Trust model v1: creator funds → submit work → creator selects → winner paid. Today's board is declared-`payTo`, not escrow. The adapter says so.

## Completed in this PR

- In-repo production map (Worker vs desk, feeds, OAuth, Watch, open PRs).
- Token-agnostic bounty / submission / event / tx schemas + explicit state machine.
- Adapter: live `{ listings: [] }`, Pages seed, Watch `{ items }`, and Commons `{ bounties }` round-trip without changing published seed JSON or `/bounties` URLs.
- Tests: transitions, duplicate funding, double settlement, settlement retry, cancel/refund, malformed submit, expiry, stale feed, idempotent replay, legacy compat.
- Helius note (no integration). Pocket: separate repo. Faucet: inspect-only seam.

## Not claimed

Wallet UI, live Worker mount, escrow, Helius, Pocket APK, faucet rewrite, Community Starter Kit, metrics, Colosseum demo video, "decentralized task liquidity."
