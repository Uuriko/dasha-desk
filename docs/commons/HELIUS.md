# Helius later (not in this PR)

No Helius SDK, webhook, or API key lands here. Commons talks to a `ChainObserver` port (`commons/schema.mjs`). A provider is injected later. Do not lock the module to Helius.

## Seams that are real

| Job | Why a provider helps | What we would call |
| --- | --- | --- |
| Funding / settlement / refund observation | v1 must not mark `paid` from an app click. Need the signature, destination, mint, and amount. | Enhanced transactions / parsed tx, or raw RPC `getTransaction` |
| Activity Tape | Human lines from wallet + bounty addresses without scraping RPC in the browser. Today the tape ingests commons events / `eventFromWebhook` (duplicate delivery is a no-op). Public RPC later is fine. | Webhooks or LaserStream on the bounty/treasury addresses |
| Solana Pay `reference` | Today's board already puts a reference on Pay URLs. A watcher can `findReference`. | Address / memo / reference subscribe |
| Submit path | **None.** User wallet signs. Helius must not become a proxy signer. | — |

Not a seam: DAS NFT APIs, priority-fee auctions, token-price APIs, "Helius inside the Desk."

## Traffic (order-of-magnitude, getdasha now)

Live feed: **zero** funded listings. Faucet tape: a handful of fills. Until the next PR ships create→pay, webhook volume is noise. Design for "one address per open bounty + one treasury" and a public RPC fallback, not a firehose.

## Idempotency / retries / fallback

- Dedupe on `signature` + `purpose` (already on the bounty `history` + event `idempotencyKey`).
- Observe path: retry the same signature; never invent a second funding/settlement event with a new id for the same sig.
- If Helius 5xx / quota: fall back to public or operator RPC. Failed observe leaves `funding_pending` / `settlement_pending`. It does not flip `paid`.
- Browser must not embed a Helius API key.

## Cost / what to ask Helius

Ask: webhook delivery guarantees, how they index Solana Pay references, parsed SPL transfer shape for USDC mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, retry/DLQ, and price at ~10–1k tx/day. Do not buy a plan to decorate this PR.

Operator (John) would create the Helius account. This repo will not.
