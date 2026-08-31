# `$DASHA` Dune dashboard query pack

This directory turns issue #64 into a reproducible, exact-mint analytics packet for a public Dune dashboard.

## Canonical identity

- Chain: Solana
- Project: `dash_eats`
- Symbol: `$DASHA`
- Mint: `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`
- Canonical Raydium pair: `9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7`
- Website: https://www.getdasha.com/
- CoinGecko: https://www.coingecko.com/en/coins/dash-eats

Every query filters the full mint. Never substitute a symbol search, shortened address, or same-name asset.

## Data sources

The SQL uses Dune's current curated Solana tables:

- `tokens_solana.fungible`: exact-mint metadata
- `dex_solana.trades`: raw DEX trade legs across Solana venues
- `jupiter_solana.aggregator_swaps`: high-level Jupiter user-intent swaps
- `tokens_solana.transfers`: SPL transfer instructions and owners/signers
- `solana_utils.latest_balances`: current wallet/token balances
- `solana_utils.daily_balances`: historical end-of-day balances
- `prices.latest` and `prices.hour`: hybrid external/DEX-derived price observations

Documentation:

- https://docs.dune.com/data-catalog/curated/dex-trades/solana/solana-dex-trades
- https://docs.dune.com/data-catalog/curated/dex-trades/solana/jupiter-aggregator-trades
- https://docs.dune.com/data-catalog/curated/token-transfers/solana/solana-token-transfers
- https://docs.dune.com/data-catalog/curated/balances/solana-latest-balances
- https://docs.dune.com/data-catalog/curated/balances/solana-daily-balances
- https://docs.dune.com/data-catalog/curated/prices/overview
- https://docs.dune.com/data-catalog/curated/token-metadata/solana/token-metadata

## Metric contract

Use these labels on the dashboard. They avoid turning on-chain activity into unsupported product claims.

- **DEX volume:** USD value of Dune trade legs in which the exact mint was bought or sold. This is token trading volume, not getdasha.com revenue or product usage.
- **DEX traders:** distinct `trader_id` values on exact-mint DEX legs. This is not website MAU.
- **Jupiter swaps:** high-level Jupiter intent rows involving the exact mint. Keep this separate from the all-DEX table; do not add the two volumes together.
- **Active transfer signers:** distinct transaction signers on standard exact-mint transfer instructions. This may include trading, bots, treasury activity, and program-related transactions. It is not website DAU.
- **Participant owners:** distinct source/destination owners on standard transfers. Program- or pool-owned accounts can appear.
- **Positive-balance owners:** owner-aggregated rows with a current balance greater than zero. Treat this as a Dune-derived holder estimate, not an official registry count.
- **Concentration:** includes liquidity, treasury, program, exchange, and burn-like accounts until they are explicitly identified. Publish both raw concentration and a separately documented adjusted view if exclusions are later justified.
- **Price:** Dune hybrid pricing only where exact-mint coverage exists. Show source and timestamp. Never fill a missing price with a symbol match.
- **TVL:** `N/A — not a TVL protocol` unless a separately defined product contract actually custodies value. Token liquidity is not protocol TVL.

## Dashboard build sequence

1. Run `01_metadata.sql`. Stop if the exact mint returns no row or metadata is unexpected.
2. Run `02_headline_dex_metrics.sql` for 7-day and 30-day cards.
3. Run `03_daily_dex_activity.sql` for buy/sell activity and source mix.
4. Run `04_jupiter_activity.sql` as a separate Jupiter panel.
5. Run `05_transfer_activity.sql` for on-chain transfer signers and owners.
6. Run `06_holder_snapshot.sql` and `07_top_holders.sql`. Identify pool, treasury, exchange, and program accounts before interpreting concentration.
7. Run `08_holder_history.sql` for the historical holder estimate.
8. Run `09_price_history.sql`. If there are no rows or observations are stale, omit the panel rather than substitute a same-symbol token.

## Publication gate

- Put the full mint and canonical pair at the top of the dashboard.
- Show query update timestamps.
- Cross-check the latest 24-hour volume, holder estimate, and price direction against the exact-mint pages on Raydium/GeckoTerminal, CoinGecko, Solscan, and Jupiter before publishing.
- Explain any material discrepancy rather than choosing the larger number.
- Do not claim the dashboard is a Dune partnership or endorsement.
- Do not expose private wallet labels, user data, faucet signer secrets, or non-public treasury assumptions.
- Do not add faucet or bounty settlement panels until their exact public accounts/signatures are documented.

`queries.sql` contains nine standalone DuneSQL blocks. Paste and save each block as a separate Dune query so every chart has a stable query ID and an auditable definition.
