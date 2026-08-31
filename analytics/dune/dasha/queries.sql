-- $DASHA / dash_eats public Dune dashboard
-- Canonical mint: 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump
--
-- Each numbered section below is a STANDALONE DuneSQL query. Save it separately
-- in Dune so every visualization has a stable query id and definition.


-- =============================================================================
-- 01_metadata.sql
-- Identity preflight. Expected: exactly one row for the full canonical mint.
-- Stop and investigate if it is missing or the name/symbol/decimals are unexpected.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
)
SELECT
    t.token_mint_address,
    t.name,
    t.symbol,
    t.decimals,
    t.token_uri,
    t.metadata_program,
    t.token_version,
    t.init_tx,
    t.created_at
FROM tokens_solana.fungible AS t
CROSS JOIN params AS p
WHERE t.token_mint_address = p.mint;


-- =============================================================================
-- 02_headline_dex_metrics.sql
-- Exact-mint trading cards. Dune's dex_solana.trades is a trade-LEG table.
-- These are on-chain DEX metrics, not getdasha.com product users or revenue.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
),
token_trades AS (
    SELECT
        d.block_time,
        d.tx_id,
        d.trader_id,
        COALESCE(CAST(d.amount_usd AS DOUBLE), 0e0) AS amount_usd,
        CASE
            WHEN d.token_bought_mint_address = p.mint THEN 'buy'
            ELSE 'sell'
        END AS direction
    FROM dex_solana.trades AS d
    CROSS JOIN params AS p
    WHERE d.block_month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '30' DAY)
      AND d.block_time >= NOW() - INTERVAL '30' DAY
      AND (
          d.token_bought_mint_address = p.mint
          OR d.token_sold_mint_address = p.mint
      )
)
SELECT
    COALESCE(SUM(CASE
        WHEN block_time >= NOW() - INTERVAL '7' DAY THEN amount_usd
        ELSE 0e0
    END), 0e0) AS dex_volume_7d_usd,
    COALESCE(SUM(amount_usd), 0e0) AS dex_volume_30d_usd,
    COUNT(DISTINCT CASE
        WHEN block_time >= NOW() - INTERVAL '7' DAY THEN tx_id
    END) AS dex_transactions_7d,
    COUNT(DISTINCT tx_id) AS dex_transactions_30d,
    COUNT(DISTINCT CASE
        WHEN block_time >= NOW() - INTERVAL '7' DAY THEN trader_id
    END) AS dex_traders_7d,
    COUNT(DISTINCT trader_id) AS dex_traders_30d,
    COUNT(DISTINCT CASE
        WHEN block_time >= NOW() - INTERVAL '7' DAY
         AND direction = 'buy' THEN tx_id
    END) AS buy_transactions_7d,
    COUNT(DISTINCT CASE
        WHEN block_time >= NOW() - INTERVAL '7' DAY
         AND direction = 'sell' THEN tx_id
    END) AS sell_transactions_7d,
    MAX(block_time) AS latest_dex_trade_at
FROM token_trades;


-- =============================================================================
-- 03_daily_dex_activity.sql
-- Stacked daily chart by buy/sell, venue, and Dune trade_source.
-- Do not rename trade_source values; preserve Dune's current labels.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
)
SELECT
    d.block_date AS day,
    CASE
        WHEN d.token_bought_mint_address = p.mint THEN 'buy'
        ELSE 'sell'
    END AS direction,
    d.project,
    COALESCE(d.trade_source, 'unknown') AS trade_source,
    COUNT(*) AS dex_trade_legs,
    COUNT(DISTINCT d.tx_id) AS dex_transactions,
    COUNT(DISTINCT d.trader_id) AS active_traders,
    SUM(COALESCE(CAST(d.amount_usd AS DOUBLE), 0e0)) AS volume_usd,
    SUM(CASE
        WHEN d.token_bought_mint_address = p.mint
            THEN COALESCE(d.token_bought_amount, 0e0)
        ELSE COALESCE(d.token_sold_amount, 0e0)
    END) AS dasha_amount
FROM dex_solana.trades AS d
CROSS JOIN params AS p
WHERE d.block_month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '30' DAY)
  AND d.block_time >= NOW() - INTERVAL '30' DAY
  AND (
      d.token_bought_mint_address = p.mint
      OR d.token_sold_mint_address = p.mint
  )
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3, 4;


-- =============================================================================
-- 04_jupiter_activity.sql
-- High-level Jupiter intent swaps. Keep this panel separate from all-DEX volume;
-- Jupiter rows and DEX execution legs are different grains and must not be added.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
),
jupiter_swaps AS (
    SELECT
        CAST(j.block_time AS DATE) AS day,
        j.block_time,
        j.tx_id,
        j.log_index,
        j.tx_signer,
        j.amm_name,
        j.jup_version,
        CASE
            WHEN j.output_mint = p.mint THEN 'buy'
            ELSE 'sell'
        END AS direction,
        CASE
            WHEN j.output_mint = p.mint
                THEN CAST(j.output_amount AS DOUBLE) / POWER(10e0, j.output_decimals)
            ELSE CAST(j.input_amount AS DOUBLE) / POWER(10e0, j.input_decimals)
        END AS dasha_amount,
        COALESCE(j.output_usd, j.input_usd, 0e0) AS amount_usd
    FROM jupiter_solana.aggregator_swaps AS j
    CROSS JOIN params AS p
    WHERE j.block_month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '30' DAY)
      AND j.block_time >= NOW() - INTERVAL '30' DAY
      AND (j.input_mint = p.mint OR j.output_mint = p.mint)
)
SELECT
    day,
    direction,
    COALESCE(amm_name, 'unknown') AS amm_name,
    jup_version,
    COUNT(DISTINCT CONCAT(tx_id, ':', CAST(COALESCE(log_index, -1) AS VARCHAR))) AS jupiter_swaps,
    COUNT(DISTINCT tx_signer) AS active_signers,
    SUM(amount_usd) AS volume_usd,
    SUM(dasha_amount) AS dasha_amount,
    MAX(block_time) AS latest_swap_at
FROM jupiter_swaps
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3, 4;


-- =============================================================================
-- 05_transfer_activity.sql
-- Standard exact-mint transfer instructions. "Active signers" and participant
-- owners are on-chain actors; neither is a website DAU/MAU measurement.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
),
transfers AS (
    SELECT
        t.block_date,
        t.block_time,
        t.tx_id,
        t.tx_signer,
        t.from_owner,
        t.to_owner,
        COALESCE(t.amount_display, 0e0) AS amount_display
    FROM tokens_solana.transfers AS t
    CROSS JOIN params AS p
    WHERE t.block_time >= NOW() - INTERVAL '30' DAY
      AND t.token_mint_address = p.mint
      AND LOWER(t.action) LIKE 'transfer%'
),
owner_events AS (
    SELECT block_date, from_owner AS owner
    FROM transfers
    WHERE from_owner IS NOT NULL AND from_owner <> ''

    UNION ALL

    SELECT block_date, to_owner AS owner
    FROM transfers
    WHERE to_owner IS NOT NULL AND to_owner <> ''
),
daily_transfers AS (
    SELECT
        block_date AS day,
        COUNT(*) AS transfer_instructions,
        COUNT(DISTINCT tx_id) AS transfer_transactions,
        COUNT(DISTINCT tx_signer) AS active_signers,
        SUM(amount_display) AS gross_token_movement,
        MAX(block_time) AS latest_transfer_at
    FROM transfers
    GROUP BY 1
),
daily_owners AS (
    SELECT
        block_date AS day,
        COUNT(DISTINCT owner) AS participant_owners
    FROM owner_events
    GROUP BY 1
)
SELECT
    t.day,
    t.transfer_instructions,
    t.transfer_transactions,
    t.active_signers,
    COALESCE(o.participant_owners, 0) AS participant_owners,
    t.gross_token_movement,
    t.latest_transfer_at
FROM daily_transfers AS t
LEFT JOIN daily_owners AS o USING (day)
ORDER BY t.day;


-- =============================================================================
-- 06_holder_snapshot.sql
-- Current owner-aggregated positive balances. Raw concentration includes liquidity,
-- treasury, program, exchange, and burn-like accounts until explicitly classified.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
),
owner_balances AS (
    SELECT
        COALESCE(NULLIF(b.token_balance_owner, ''), b.address) AS holder,
        SUM(CAST(b.token_balance AS DOUBLE)) AS balance
    FROM solana_utils.latest_balances AS b
    CROSS JOIN params AS p
    WHERE b.token_mint_address = p.mint
      AND b.token_balance > CAST(0 AS DECIMAL(38, 18))
    GROUP BY 1
),
ranked AS (
    SELECT
        holder,
        balance,
        ROW_NUMBER() OVER (ORDER BY balance DESC, holder) AS holder_rank,
        SUM(balance) OVER () AS observed_supply
    FROM owner_balances
    WHERE balance > 0e0
)
SELECT
    COUNT(*) AS positive_balance_owners,
    MAX(observed_supply) AS observed_supply,
    MAX(balance) AS largest_owner_balance,
    100e0 * SUM(CASE WHEN holder_rank <= 1 THEN balance ELSE 0e0 END)
        / NULLIF(MAX(observed_supply), 0e0) AS top_1_share_pct,
    100e0 * SUM(CASE WHEN holder_rank <= 10 THEN balance ELSE 0e0 END)
        / NULLIF(MAX(observed_supply), 0e0) AS top_10_share_pct,
    100e0 * SUM(CASE WHEN holder_rank <= 100 THEN balance ELSE 0e0 END)
        / NULLIF(MAX(observed_supply), 0e0) AS top_100_share_pct,
    APPROX_PERCENTILE(balance, 0.5) AS median_positive_balance
FROM ranked;


-- =============================================================================
-- 07_top_holders.sql
-- Review and label these owners before publishing an adjusted concentration view.
-- Never exclude an address merely because its balance is large.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
),
owner_balances AS (
    SELECT
        COALESCE(NULLIF(b.token_balance_owner, ''), b.address) AS holder,
        SUM(CAST(b.token_balance AS DOUBLE)) AS balance,
        MAX(b.updated_at) AS latest_balance_update
    FROM solana_utils.latest_balances AS b
    CROSS JOIN params AS p
    WHERE b.token_mint_address = p.mint
      AND b.token_balance > CAST(0 AS DECIMAL(38, 18))
    GROUP BY 1
),
ranked AS (
    SELECT
        ROW_NUMBER() OVER (ORDER BY balance DESC, holder) AS holder_rank,
        holder,
        balance,
        SUM(balance) OVER () AS observed_supply,
        latest_balance_update
    FROM owner_balances
    WHERE balance > 0e0
)
SELECT
    holder_rank,
    holder,
    balance,
    100e0 * balance / NULLIF(observed_supply, 0e0) AS observed_supply_share_pct,
    latest_balance_update,
    CAST(NULL AS VARCHAR) AS classification,
    CAST(NULL AS VARCHAR) AS evidence_url
FROM ranked
WHERE holder_rank <= 100
ORDER BY holder_rank;


-- =============================================================================
-- 08_holder_history.sql
-- Dune-derived daily positive-balance owner estimate. This can be expensive; retain
-- the month and mint filters, and begin with 90 days before increasing the range.
-- =============================================================================
WITH params AS (
    SELECT '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump' AS mint
),
owner_daily AS (
    SELECT
        CAST(b.day AS DATE) AS day,
        COALESCE(NULLIF(b.token_balance_owner, ''), b.address) AS holder,
        SUM(CAST(b.token_balance AS DOUBLE)) AS balance
    FROM solana_utils.daily_balances AS b
    CROSS JOIN params AS p
    WHERE b.month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '90' DAY)
      AND b.day >= NOW() - INTERVAL '90' DAY
      AND b.token_mint_address = p.mint
    GROUP BY 1, 2
)
SELECT
    day,
    COUNT_IF(balance > 0e0) AS positive_balance_owners,
    SUM(CASE WHEN balance > 0e0 THEN balance ELSE 0e0 END) AS observed_supply
FROM owner_daily
GROUP BY 1
ORDER BY day;


-- =============================================================================
-- 09_price_history.sql
-- Exact-mint hybrid Dune price. If this returns no rows or the latest timestamp is
-- stale, omit the panel. Never fall back to symbol = 'DASHA'.
-- =============================================================================
WITH params AS (
    SELECT FROM_BASE58('53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump') AS mint_bytes
),
hourly AS (
    SELECT
        p.timestamp,
        p.price,
        p.volume,
        p.source,
        p.symbol,
        p.decimals
    FROM prices.hour AS p
    CROSS JOIN params AS x
    WHERE p.blockchain = 'solana'
      AND p.contract_address = x.mint_bytes
      AND p.timestamp >= NOW() - INTERVAL '30' DAY
)
SELECT
    timestamp,
    price,
    volume,
    source,
    symbol,
    decimals,
    MAX_BY(price, timestamp) OVER () AS latest_price,
    MAX(timestamp) OVER () AS latest_price_timestamp
FROM hourly
ORDER BY timestamp;
