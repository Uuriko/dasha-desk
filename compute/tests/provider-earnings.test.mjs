import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CHIP_TIERS,
  DASHA_PAYOUT_BONUS_MULTIPLIER,
  DAYS_PER_MONTH,
  MLX_DECODE_SPEEDUP_ESTIMATE,
  PROVISIONAL_RATE_CARD,
  STANDING_RATE_CARD,
  estimateCapacity,
  estimateEarnings,
  estimateJobRevenueUsd,
  formatUsd,
} from "../provider/earnings-calculator.mjs";

const approx = (actual, expected, epsilon = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} ≈ ${expected}`,
  );

test("standing card: 100 jobs/day x 2k tokens = $5.00 + $2.00 = $7.00/day", () => {
  const result = estimateEarnings({
    jobsPerDay: 100,
    completionTokensPerJob: 2000,
    uptimeSharePct: 100,
    rateCard: STANDING_RATE_CARD,
    dashaBonus: false,
  });
  approx(result.perJobUsd, 0.07);
  approx(result.grossPerDayUsd, 7.0);
  approx(result.grossPerMonthUsd, 7.0 * DAYS_PER_MONTH);
});

test("per-job revenue splits the job fee and the token fee", () => {
  approx(
    estimateJobRevenueUsd({ completionTokensPerJob: 2000, rateCard: STANDING_RATE_CARD }),
    0.05 + 2 * 0.01,
  );
  approx(
    estimateJobRevenueUsd({ completionTokensPerJob: 500, rateCard: STANDING_RATE_CARD }),
    0.05 + 0.5 * 0.01,
  );
});

test("+$dasha bonus toggle multiplies gross by 1.1", () => {
  assert.equal(DASHA_PAYOUT_BONUS_MULTIPLIER, 1.1);
  const plain = estimateEarnings({
    jobsPerDay: 100, completionTokensPerJob: 2000, uptimeSharePct: 100,
  });
  const boosted = estimateEarnings({
    jobsPerDay: 100, completionTokensPerJob: 2000, uptimeSharePct: 100, dashaBonus: true,
  });
  approx(boosted.grossPerDayUsd, plain.grossPerDayUsd * 1.1);
  approx(boosted.grossPerDayUsd, 7.7);
});

test("rate card is parameterized: provisional $0.06/$0.012 changes the numbers", () => {
  assert.equal(PROVISIONAL_RATE_CARD.perJobUsd, 0.06);
  assert.equal(PROVISIONAL_RATE_CARD.perKCompletionTokensUsd, 0.012);
  const result = estimateEarnings({
    jobsPerDay: 100, completionTokensPerJob: 2000, uptimeSharePct: 100,
    rateCard: PROVISIONAL_RATE_CARD,
  });
  approx(result.grossPerDayUsd, 100 * (0.06 + 2 * 0.012)); // $8.40/day
  const custom = estimateEarnings({
    jobsPerDay: 10, completionTokensPerJob: 1000, uptimeSharePct: 100,
    rateCard: { perJobUsd: 0.1, perKCompletionTokensUsd: 0.02 },
  });
  approx(custom.grossPerDayUsd, 10 * (0.1 + 0.02)); // $1.20/day
});

test("uptime share scales effective jobs and active hours", () => {
  const full = estimateEarnings({ jobsPerDay: 100, completionTokensPerJob: 2000, uptimeSharePct: 100 });
  const half = estimateEarnings({ jobsPerDay: 100, completionTokensPerJob: 2000, uptimeSharePct: 50 });
  approx(half.grossPerDayUsd, full.grossPerDayUsd / 2);
  approx(half.activeHoursPerDay, 12);
  // 100% uptime: $7/day across 24 active hours.
  approx(full.effectiveUsdPerActiveHour, 7.0 / 24);
});

test("zero uptime yields zero earnings and a zero hourly rate, never NaN", () => {
  const result = estimateEarnings({ jobsPerDay: 100, completionTokensPerJob: 2000, uptimeSharePct: 0 });
  assert.equal(result.grossPerDayUsd, 0);
  assert.equal(result.grossPerMonthUsd, 0);
  assert.equal(result.effectiveUsdPerActiveHour, 0);
  assert.ok(!Number.isNaN(result.effectiveUsdPerActiveHour));
});

test("negative and non-numeric inputs are treated as zero", () => {
  const negative = estimateEarnings({ jobsPerDay: -5, completionTokensPerJob: -10 });
  assert.equal(negative.grossPerDayUsd, 0);
  const junk = estimateEarnings({ jobsPerDay: NaN, completionTokensPerJob: "oops" });
  assert.equal(junk.grossPerDayUsd, 0);
  assert.equal(estimateCapacity({ completionTokensPerJob: 0 }), 0);
});

test("capacity estimates throughput for each tier and the MLX speedup toggle", () => {
  for (const tier of Object.keys(CHIP_TIERS)) {
    const cap = estimateCapacity({ chipTier: tier, uptimeSharePct: 100, completionTokensPerJob: 2000 });
    const expected = (86400 * CHIP_TIERS[tier].decodeTokPerSec) / 2000;
    approx(cap, expected);
    assert.ok(cap > 0, `${tier} capacity should be positive`);
  }
  // M4 at 100% uptime and 2k tokens/job: 86400 * 55 / 2000 = 2376 jobs/day.
  approx(estimateCapacity({ chipTier: "M4", uptimeSharePct: 100, completionTokensPerJob: 2000 }), 2376);
  const plain = estimateCapacity({ chipTier: "M4", uptimeSharePct: 100, completionTokensPerJob: 2000 });
  const mlx = estimateCapacity({ chipTier: "M4", mlxSpeedup: true, uptimeSharePct: 100, completionTokensPerJob: 2000 });
  approx(mlx, plain * MLX_DECODE_SPEEDUP_ESTIMATE);
  // Unknown tier falls back to M4.
  approx(
    estimateCapacity({ chipTier: "M9", uptimeSharePct: 100, completionTokensPerJob: 2000 }),
    plain,
  );
});

test("rate card constants are frozen snapshots", () => {
  assert.ok(Object.isFrozen(STANDING_RATE_CARD));
  assert.equal(STANDING_RATE_CARD.perJobUsd, 0.05);
  assert.equal(STANDING_RATE_CARD.perKCompletionTokensUsd, 0.01);
});

test("formatUsd renders two-decimal USD", () => {
  assert.equal(formatUsd(7), "$7.00");
  assert.equal(formatUsd(7.7), "$7.70");
  assert.equal(formatUsd(0), "$0.00");
});

test("math module stays pure: no DOM or network access", async () => {
  const source = await readFile(
    fileURLToPath(new URL("../provider/earnings-calculator.mjs", import.meta.url)),
    "utf8",
  );
  for (const token of ["document.", "window.", "fetch(", "XMLHttpRequest", "localStorage"]) {
    assert.ok(!source.includes(token), `math module must not reference ${token}`);
  }
});
