# Commons

Token-agnostic bounty records, a testable state machine, and an adapter for the existing `dasha-bounties-feed/v1` USDC board.

`$DASHA` / getdasha.com is the reference community. This module does not require that brand.

## Trust model v1

Creator funds a bounty. Participants submit work. Creator chooses a winner. Winner gets paid.

No DAO. No disputes. No oracles. No reputation. No hidden custody. Prefer user-signed settlement. This code never stores keys.

The live getdasha board today is **declared, not escrow**: a listing with `payTo` is a destination, not proof that funds sat anywhere. The adapter marks that as `funding.state: "declared"`, not `funded`.

## Files

| File | Job |
| --- | --- |
| `schema.mjs` | bounty / submission / event / tx records |
| `machine.mjs` | state transitions |
| `adapter.mjs` | `dasha-bounties-feed/v1` ↔ Commons |
| `tape.mjs` | Activity Tape: human kinds + webhook ingest + board lines |
| `tx.mjs` | Signer port + simulated tx (no keys, no auto-sign) |
| `loop.mjs` | create → fund → submit → select → pay |
| `demo-loop.mjs` | `node commons/demo-loop.mjs` — local walk, no chain |

Consume from another project (no getdasha import): [`docs/commons/CONSUME.md`](../docs/commons/CONSUME.md). A community that is not getdasha: [`docs/commons/EXTERNAL.md`](../docs/commons/EXTERNAL.md). Architecture: [`docs/commons/ARCHITECTURE.md`](../docs/commons/ARCHITECTURE.md). Pocket (separate repo): [`docs/commons/POCKET.md`](../docs/commons/POCKET.md).
