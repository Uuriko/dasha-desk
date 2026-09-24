// Provider earnings math for the static Dasha Compute earnings calculator.
//
// Pure, dependency-free functions: no DOM, no network, no build step.
// Imported by compute/provider/earnings-calculator.html and exercised by
// compute/tests/provider-earnings.test.mjs.
//
// Everything here is an ESTIMATE, not a quote or a promise of income.
// Providers accrue credits; there are no live USDC or $Dasha payouts.

export const DAYS_PER_MONTH = 30;
export const HOURS_PER_DAY = 24;
export const SECONDS_PER_DAY = 86_400;

// Standing rate card: $0.05 per served job + $0.01 per 1k completion tokens.
export const STANDING_RATE_CARD = Object.freeze({
  name: "standing",
  perJobUsd: 0.05,
  perKCompletionTokensUsd: 0.01,
});

// Provisional code-side card currently under owner review — NOT in force.
export const PROVISIONAL_RATE_CARD = Object.freeze({
  name: "provisional (under owner review)",
  perJobUsd: 0.06,
  perKCompletionTokensUsd: 0.012,
});

// +10% when the provider opts to be paid out in $Dasha (credits, not cash).
export const DASHA_PAYOUT_BONUS_MULTIPLIER = 1.1;

// Apple Silicon tier presets. decodeTokPerSec values are ROUGH community-
// reported decode rates for ~8B 4-bit-quantized models on Ollama — clearly
// labeled as estimates, your mileage WILL vary with model, quant and load.
export const CHIP_TIERS = Object.freeze({
  M1: Object.freeze({
    label: "M1 (2020 · 8-core GPU)",
    decodeTokPerSec: 22,
    note: "Rough community-reported estimate for 8B 4-bit decode.",
  }),
  M2: Object.freeze({
    label: "M2 (2022 · 10-core GPU)",
    decodeTokPerSec: 32,
    note: "Rough community-reported estimate for 8B 4-bit decode.",
  }),
  M4: Object.freeze({
    label: "M4 (2024 · 10-core GPU)",
    decodeTokPerSec: 55,
    note: "Rough community-reported estimate for 8B 4-bit decode.",
  }),
});

// MLX backends are roughly ~1.6x faster on decode for supported models on
// recent Apple Silicon. Rough estimate, not measured per machine.
export const MLX_DECODE_SPEEDUP_ESTIMATE = 1.6;

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampShare(value) {
  return Math.min(1, Math.max(0, value));
}

function normalizeRateCard(rateCard) {
  const card = rateCard && typeof rateCard === "object" ? rateCard : STANDING_RATE_CARD;
  return {
    perJobUsd: Math.max(0, toFiniteNumber(card.perJobUsd)),
    perKCompletionTokensUsd: Math.max(0, toFiniteNumber(card.perKCompletionTokensUsd)),
  };
}

// Estimated revenue for one served job at the given rate card.
export function estimateJobRevenueUsd({ completionTokensPerJob = 0, rateCard = STANDING_RATE_CARD } = {}) {
  const card = normalizeRateCard(rateCard);
  const tokens = Math.max(0, toFiniteNumber(completionTokensPerJob));
  return card.perJobUsd + (tokens / 1000) * card.perKCompletionTokensUsd;
}

// Estimated earnings. jobsPerDay is the demand the provider expects to serve
// at 100% uptime; uptimeSharePct scales effective availability.
// Returns estimates in USD, never a promise of income.
export function estimateEarnings({
  jobsPerDay = 0,
  completionTokensPerJob = 0,
  uptimeSharePct = 100,
  rateCard = STANDING_RATE_CARD,
  dashaBonus = false,
} = {}) {
  const uptimeShare = clampShare(toFiniteNumber(uptimeSharePct) / 100);
  const effectiveJobsPerDay = Math.max(0, toFiniteNumber(jobsPerDay)) * uptimeShare;
  const perJobUsd = estimateJobRevenueUsd({ completionTokensPerJob, rateCard });
  const bonusMultiplier = dashaBonus ? DASHA_PAYOUT_BONUS_MULTIPLIER : 1;
  const grossPerDayUsd = effectiveJobsPerDay * perJobUsd * bonusMultiplier;
  const grossPerMonthUsd = grossPerDayUsd * DAYS_PER_MONTH;
  const activeHoursPerDay = HOURS_PER_DAY * uptimeShare;
  const effectiveUsdPerActiveHour =
    activeHoursPerDay > 0 ? grossPerDayUsd / activeHoursPerDay : 0;
  return {
    perJobUsd,
    effectiveJobsPerDay,
    grossPerDayUsd,
    grossPerMonthUsd,
    effectiveUsdPerActiveHour,
    activeHoursPerDay,
    dashaBonusApplied: Boolean(dashaBonus),
  };
}

// Estimated maximum jobs/day a Mac tier can serve, given throughput estimates
// and the provider's uptime share. MLX backends decode faster; the toggle
// applies a rough speedup estimate to show the throughput effect on capacity.
export function estimateCapacity({
  chipTier = "M4",
  mlxSpeedup = false,
  uptimeSharePct = 100,
  completionTokensPerJob = 0,
} = {}) {
  const tier = CHIP_TIERS[chipTier] ?? CHIP_TIERS.M4;
  const decodeTokPerSec =
    tier.decodeTokPerSec * (mlxSpeedup ? MLX_DECODE_SPEEDUP_ESTIMATE : 1);
  const uptimeShare = clampShare(toFiniteNumber(uptimeSharePct) / 100);
  const tokensPerJob = Math.max(0, toFiniteNumber(completionTokensPerJob));
  if (tokensPerJob <= 0 || decodeTokPerSec <= 0) return 0;
  const secondsAvailablePerDay = SECONDS_PER_DAY * uptimeShare;
  return (secondsAvailablePerDay * decodeTokPerSec) / tokensPerJob;
}

export function formatUsd(value) {
  const n = toFiniteNumber(value);
  return `$${n.toFixed(2)}`;
}

export function formatJobsPerDay(value) {
  const n = toFiniteNumber(value);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}
