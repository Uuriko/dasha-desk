/**
 * Pins the net-earnings estimate arithmetic from
 * ocm/docs/EARNINGS-NET-VIEW-SPEC.md, including its worked example.
 *
 * These are estimates for display only: credits are not money, no payout
 * exists, and this module never touches the ledger. If the formula changes,
 * the spec's worked example must change with it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RATE_CARD,
  estimateGross,
  estimateHardwareCost,
  estimateNet,
  estimatePowerCost,
  estimateTotal,
  validateCostInputs,
} from '../gateway/earnings-net.mjs';

const approx = (got, want, msg) => assert.ok(Math.abs(got - want) < 0.01, `${msg}: got ${got}, want ${want}`);

test('rate card carries the standing numbers', () => {
  assert.equal(RATE_CARD.perJob, 0.05);
  assert.equal(RATE_CARD.per1kCompletionTokens, 0.01);
  assert.equal(RATE_CARD.dashaBonusMultiplier, 1.10);
  assert.match(RATE_CARD.note, /open question/);
});

test('worked example from the spec', () => {
  // 2,400 requests, 9.6M completion tokens, 68W, 12h/day, $0.28/kWh,
  // $3,999 hardware over 36 months, $dasha bonus on.
  const usage = { requests: 2400, completionTokens: 9_600_000 };
  const costs = {
    electricity_per_kwh: 0.28, watts: 68, hours_per_day: 12,
    hardware_purchase_price: 3999, hardware_amort_months: 36, dasha_bonus: true,
  };
  assert.deepEqual(validateCostInputs(costs), []);
  const { gross, power, hardware, net } = estimateNet(usage, costs);
  approx(gross, 237.60, 'gross');
  approx(power, 6.85, 'power');
  approx(hardware, 111.08, 'hardware');
  approx(net, 119.67, 'net');
});

test('bonus off removes the 10%', () => {
  const got = estimateGross({ requests: 100, completionTokens: 1_000_000 }, { dashaBonus: false });
  approx(got, 100 * 0.05 + 1000 * 0.01, 'no bonus');
  const bonused = estimateGross({ requests: 100, completionTokens: 1_000_000 }, { dashaBonus: true });
  approx(bonused, got * 1.10, 'bonus');
});

test('zero usage and zero costs give a clean zero net', () => {
  const e = estimateNet({ requests: 0, completionTokens: 0 }, {});
  assert.deepEqual(e, { gross: 0, power: 0, hardware: 0, net: 0 });
});

test('a machine can go negative: costs are not hidden', () => {
  const e = estimateNet({ requests: 10, completionTokens: 50_000 }, {
    electricity_per_kwh: 0.40, watts: 110, hours_per_day: 24,
    hardware_purchase_price: 6000, hardware_amort_months: 12,
  });
  assert.ok(e.net < 0, `net should be negative, got ${e.net}`);
});

test('power cost matches the spec formula', () => {
  approx(estimatePowerCost({ watts: 68, hoursPerDay: 12, electricityPerKwh: 0.28 }), 6.85, 'power');
});

test('hardware amortization is straight-line, months floor at 1', () => {
  approx(estimateHardwareCost({ purchasePrice: 3999, amortMonths: 36 }), 111.08, 'amort');
  approx(estimateHardwareCost({ purchasePrice: 3999, amortMonths: 0 }), 3999, 'floor');
});

test('invalid inputs are reported, never silently applied', () => {
  assert.deepEqual(validateCostInputs({ electricity_per_kwh: -1 }), ['electricity_per_kwh must be a finite number >= 0']);
  assert.deepEqual(validateCostInputs({ hardware_amort_months: 0 }), ['hardware_amort_months must be an integer >= 1']);
  assert.deepEqual(validateCostInputs({ hardware_amort_months: 12.5 }), ['hardware_amort_months must be an integer >= 1']);
  assert.deepEqual(validateCostInputs({ dasha_bonus: 'yes' }), ['dasha_bonus must be a boolean']);
  assert.deepEqual(validateCostInputs({}), []);
});

test('totals sum per-machine rows', () => {
  const total = estimateTotal([
    { usage: { requests: 100, completionTokens: 1_000_000 }, costs: { dasha_bonus: false } },
    { usage: { requests: 0, completionTokens: 0 }, costs: { watts: 68, hours_per_day: 12, electricity_per_kwh: 0.28 } },
  ]);
  approx(total.gross, 15, 'total gross');
  approx(total.power, 6.85, 'total power');
  approx(total.net, 15 - 6.85, 'total net');
});
