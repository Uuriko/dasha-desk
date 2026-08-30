# Helius (measured, not integrated)

No Helius SDK, webhook subscription, or API key lands here. Commons talks to a `ChainObserver` port (`commons/schema.mjs`). A provider is injected later. Do not lock the module to Helius. Browser must not embed a key.

## Measured support reply

Sun 2026-08-30. Kehinde Yusuf at support@helius.xyz replied to potter@trydemigod.com on thread `$DASHA / getdasha.com + Helius`. Quote as measured. Do not invent products.

| What | Address |
| --- | --- |
| `$DASHA` mint | `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump` |
| Pair | `9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7` |
| USDC mint (they already named) | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

| Job | What they named |
| --- | --- |
| Tape / lobby live trades | Enhanced WebSockets `transactionSubscribe` with `$DASHA` mint + pool accounts in `accountInclude`. Prefer WSS over webhooks for a UI feed (webhooks fire after confirmation, better for backend triggers). |
| Wallet balances / history / activity | DAS `getAssetsByOwner` + Wallet API (balances, tx history, balance-at for snapshots). |
| Faucet / bounty / mint submissions | Sender (staked + Jito, no credits) + Priority Fee API. |
| Stack | WSS + DAS / Wallet API + Sender / Priority Fee. Webhooks for backend triggers only. |
| Credits | They named [Helius Startup Launchpad](https://www.helius.dev/startup-launchpad) (mentorship, investor intros, partner perks). John already asked. **Do not apply from this PR.** |

That Tape row is live trades (`/digest`, lobby) — not the Commons Activity Tape (created / funded / submitted / selected / paid / cancelled).

## Seams that stay

| Job | Why a provider helps | Measured call |
| --- | --- | --- |
| Live trade tape | UI feed of mint + pool txs. | Enhanced WSS `transactionSubscribe` (`accountInclude`). |
| Wallet balances / history | Snapshots without scraping RPC in the browser. | DAS `getAssetsByOwner` + Wallet API. |
| Faucet / bounty / mint send | Land a signed tx. | Sender + Priority Fee API. Operator faucet already signs (`signer: true`). Bounty v1 stays user-signed. |
| Funding / settlement / refund observation | v1 must not mark `paid` from an app click. Need the signature, destination, mint, and amount. | Webhooks for backend triggers only. Public / operator RPC remains a fallback. |
| Submit path | **None.** User wallet signs. Helius must not become a proxy signer. | — |

Not claimed: a Helius account in this repo, an SDK, "Helius inside the Desk."

## Traffic (order-of-magnitude, getdasha now)

Live bounty feed: **zero** funded listings. Faucet tape: a handful of fills. Design for mint + pool (live trade tape) and "one address per open bounty + one treasury" with a public RPC fallback, not a firehose.

## Idempotency / retries / fallback

- Dedupe on `signature` + `purpose` (already on the bounty `history` + event `idempotencyKey`).
- Observe path: retry the same signature; never invent a second funding/settlement event with a new id for the same sig.
- If Helius 5xx / quota: fall back to public or operator RPC. Failed observe leaves `funding_pending` / `settlement_pending`. It does not flip `paid`.
- Browser must not embed a Helius API key.

Operator (John) would create the Helius account. This repo will not.
