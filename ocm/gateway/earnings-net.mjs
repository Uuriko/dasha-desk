/**
 * Net-earnings estimate arithmetic for the OCM console owner dashboard.
 *
 * Pure functions, no I/O: the ledger rows (requests served, completion tokens)
 * come from `Ledger.earnings`; the cost inputs come from per-account prefs.
 * This module never writes to the ledger and never implies a payout — see
 * ocm/docs/EARNINGS-NET-VIEW-SPEC.md. Credits are not money.
 *
 * Standing rate card: $0.05 per job + $0.01 per 1k completion tokens,
 * optional +10% when paid in $dasha. The provisional $0.06/$0.012 figure is
 * an open question (flagged on every surface, never applied).
 */

export const RATE_CARD = Object.freeze({
  perJob: 0.05,
  per1kCompletionTokens: 0.01,
  dashaBonusMultiplier: 1.10,
  note: 'Standing rate card $0.05/job + $0.01/1k completion tokens (+10% $dasha toggle). ' +
    'Provisional $0.06/$0.012 figure is an open question, not applied.',
});

export const DAYS_PER_MONTH = 30;

/** Validate a machine's cost inputs; returns an array of problem strings (empty = valid). */
export function validateCostInputs(input = {}) {
  const problems = [];
  const num = (k) => {
    const v = input[k];
    if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
      problems.push(`${k} must be a finite number >= 0`);
    }
  };
  num('electricity_per_kwh');
  num('watts');
  num('hours_per_day');
  num('hardware_purchase_price');
  if (input.hardware_amort_months !== undefined &&
    !(Number.isInteger(input.hardware_amort_months) && input.hardware_amort_months >= 1)) {
    problems.push('hardware_amort_months must be an integer >= 1');
  }
  if (input.dasha_bonus !== undefined && typeof input.dasha_bonus !== 'boolean') {
    problems.push('dasha_bonus must be a boolean');
  }
  return problems;
}

/**
 * Estimated gross credit value from ledger rows and the standing rate card.
 * `usage` = { requests, completionTokens }. Never negative.
 */
export function estimateGross(usage = {}, { dashaBonus = false } = {}) {
  const requests = Math.max(0, usage.requests || 0);
  const tokens = Math.max(0, usage.completionTokens || 0);
  const gross = requests * RATE_CARD.perJob + (tokens / 1000) * RATE_CARD.per1kCompletionTokens;
  return gross * (dashaBonus ? RATE_CARD.dashaBonusMultiplier : 1);
}

/** Monthly power cost estimate. */
export function estimatePowerCost({ watts = 0, hoursPerDay = 0, electricityPerKwh = 0 } = {}) {
  return Math.max(0, (watts / 1000) * hoursPerDay * DAYS_PER_MONTH * electricityPerKwh);
}

/** Monthly straight-line hardware amortization. */
export function estimateHardwareCost({ purchasePrice = 0, amortMonths = 1 } = {}) {
  return Math.max(0, purchasePrice / Math.max(1, amortMonths));
}

/**
 * Full net estimate for one machine. `usage` = { requests, completionTokens };
 * `costs` = { electricity_per_kwh, watts, hours_per_day, hardware_purchase_price,
 * hardware_amort_months, dasha_bonus }.
 */
export function estimateNet(usage = {}, costs = {}) {
  const dashaBonus = costs.dasha_bonus === true;
  const gross = estimateGross(usage, { dashaBonus });
  const power = estimatePowerCost({
    watts: costs.watts || 0,
    hoursPerDay: costs.hours_per_day || 0,
    electricityPerKwh: costs.electricity_per_kwh || 0,
  });
  const hardware = estimateHardwareCost({
    purchasePrice: costs.hardware_purchase_price || 0,
    amortMonths: costs.hardware_amort_months || 1,
  });
  return { gross, power, hardware, net: gross - power - hardware };
}

/** Sum one-machine estimates across machines. */
export function estimateTotal(rows = []) {
  return rows.reduce((acc, r) => {
    const e = estimateNet(r.usage, r.costs);
    acc.gross += e.gross; acc.power += e.power; acc.hardware += e.hardware; acc.net += e.net;
    return acc;
  }, { gross: 0, power: 0, hardware: 0, net: 0 });
}
