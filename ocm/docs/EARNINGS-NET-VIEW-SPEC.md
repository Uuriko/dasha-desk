# OCM console: net earnings view data spec

Status: spec for review. Nothing here changes the ledger, the gateway, or any billing path.

## Why

The P5 earnings view (owner dashboard, `ocm/gateway/console.mjs` `earningsSection`)
shows gross credits: completion tokens a machine produced, counted at the gateway.
A provider deciding whether to keep a Mac online needs the number after costs:
electricity and the hardware itself. Gross credits answer "how much did the network
count for me"; this view answers "what did it cost me to earn that".

Credits accrue as credits. They are not money and have no payout today; every
surface that shows an estimated value keeps the "not money" sentence. This view
is an estimate overlay, computed from provider-entered inputs and ledger rows —
it never writes to the ledger and never implies a payout.

## Rate card carried in

The standing rate card is **$0.05 per job + $0.01 per 1k completion tokens**,
with an optional **+10% bonus when paid in $dasha**. A provisional
$0.06 / $0.012 figure exists in dasha-local materials; it is an open question
for John, not a second rate card. Wherever the net view shows an estimated
value, the rate card and the discrepancy flag appear next to the number, the
same way the static provider calculator shows its fine print.

## Inputs

Two new input rows per machine, plus one account-level toggle:

1. **Electricity** — `$ / kWh` (per machine, prefilled from an account default).
   Combined with the machine's average load watts and served hours per day,
   the view estimates power cost for the month:

   `power_cost = (watts / 1000) × hours_per_day × 30 × electricity_per_kwh`

2. **Hardware amortization** — purchase price and amortization months (per machine).
   Straight-line, no interest, no resale value:

   `hardware_cost = purchase_price / amort_months`

3. **$dasha bonus toggle** — multiplies the estimated gross credit value by 1.10
   when on. Default off.

Watts default from the chip profile the host reports at connect time
(the same table the compute console's static calculator uses: M1/M2 ~24W,
M1 Pro/M2 Pro ~34W, M1 Max/M2 Max ~52W, M3 Pro/M4 Pro ~38W, M3 Max/M4 Max ~68W,
M2 Ultra/M3 Ultra ~110W); the provider can override per machine. Hours per day
defaults to the machine's recent served hours from the funnel data, overrideable.

Fine print shown with the view: no base reward, tax, downtime, network fees,
or hardware failure included. This is math, not a promise.

## Data contract

Preferences are per-account inputs, not ledger facts. They live in account
prefs storage (outside the ledger, editable from the owner dashboard, never
shared across accounts):

```json
{
  "account_id": "…",
  "earnings_costs": {
    "defaults": {
      "electricity_per_kwh": 0.28,
      "dasha_bonus": false
    },
    "machines": {
      "<agent_id>": {
        "electricity_per_kwh": 0.28,
        "watts": 68,
        "hours_per_day": 12,
        "hardware_purchase_price": 3999,
        "hardware_amort_months": 36,
        "dasha_bonus": true
      }
    }
  }
}
```

Validation: all numbers ≥ 0; `hardware_amort_months` ≥ 1; unknown machine ids
are ignored on render (they belong to another account or an old machine).

## Arithmetic

All figures are estimates rendered next to the ledger rows; the ledger rows
themselves (today / 7 days / all-time credited completion tokens, requests,
last served) do not change.

```text
estimated_gross = requests × 0.05 + (completion_tokens / 1000) × 0.01
                × (1.10 if dasha_bonus else 1.00)

power_cost      = (watts / 1000) × hours_per_day × 30 × electricity_per_kwh
hardware_cost   = hardware_purchase_price / hardware_amort_months

estimated_net   = estimated_gross − power_cost − hardware_cost
```

Worked example (one machine, 30-day view): 2,400 requests, 9,600,000 completion
tokens, watts 68, hours/day 12, electricity $0.28/kWh, hardware $3,999 over
36 months, $dasha bonus on. Intermediates are rounded for display; the
reference implementation keeps full precision.

```text
gross  = 2400 × 0.05 + (9,600,000 / 1000) × 0.01 = 120.00 + 96.00 = 216.00
       × 1.10 = 237.60
power  = 0.068 × 12 × 30 × 0.28 = 6.85
hw     = 3999 / 36 = 111.08
net    = 237.60 − 6.85 − 111.08 = 119.67
```

The reference implementation (`ocm/gateway/earnings-net.mjs`, pure arithmetic,
no I/O) exposes `estimateNet` and the pinned test (`ocm/tests/earnings-net.test.mjs`)
runs the worked example above plus edge cases (zero usage, zero cost inputs,
bonus off, amort months of 1).

## View changes

The owner dashboard keeps the existing Earnings section untouched and adds a
"Costs & net" block beneath it, rendered only when at least one machine has
cost inputs saved:

- One card per machine: estimated gross credit value, power cost, hardware
  amortization, estimated net — each labeled "est." and each with the rate
  card + discrepancy flag in the block footer.
- The input rows themselves: a compact table (machine · $/kWh · watts ·
  hrs/day · purchase $ · amort months · $dasha bonus) with inline editing,
  prefilled from defaults. This is the mock in `earnings-net-mock.html`.
- The "not money" sentence stays, extended by one clause: "Estimated values
  use the standing rate card and your own cost inputs; they are not money and
  have no payout today."

## Explicit non-goals

- No payout computation, no settlement, no wallet touch: `dasha_hosted_ask`
  stays dark and unbilled.
- No new gateway routes to serve the estimate: the owner dashboard already
  holds the ledger rows; costs come from account prefs in the same page.
- No cross-account rollups: the admin network view keeps gross-only network
  totals; cost inputs are private to each account.
- The discrepancy flag ($0.05/$0.01 standing vs $0.06/$0.012 provisional) is
  shown, not resolved, in this spec.
