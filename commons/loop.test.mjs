#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_FEED_SCHEMA,
  LIVE_EMPTY_FEED,
  consumeDashaFeed,
  emitDashaFeed,
  visibleState,
  visibleCopy,
  createOpenBounty,
  fundBounty,
  payBounty,
  submitWork,
  selectWinner,
  cancelBounty,
  expireBounty,
  fundingTx,
  settlementTx,
} from './index.mjs';
import { createSimulatedTx, fakeSignature, TX_ERRORS } from './tx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const B = require('../bounties/board.js');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const CREATOR = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const WORKER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

function work(id = 'sub-1') {
  return {
    schema: 'commons.submission/v1',
    id,
    bountyId: 'loop-1',
    submitter: { kind: 'wallet', id: WORKER, wallet: WORKER, handle: 'ada' },
    submittedAt: '2026-08-30T13:00:00.000Z',
    format: 'github_proof',
    proof: { url: 'https://github.com/Uuriko/dasha-desk/pull/19' },
    status: 'received',
  };
}

function open(id = 'loop-1') {
  return createOpenBounty({
    id,
    title: '25 USDC bounty',
    amount: '25',
    creator: { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: null },
    creatorWallet: CREATOR,
    createdAt: '2026-08-30T00:00:00.000Z',
    deadline: '2026-09-30T00:00:00.000Z',
  });
}

function must(result) {
  assert.equal(result.ok, true, result.detail || result.error);
  return result.bounty;
}

{
  const b = open();
  assert.equal(visibleState(b), 'unfunded');
  assert.equal(visibleCopy(b).title, '25 USDC bounty');
  assert.equal(b.state, 'open');
  assert.equal(B.visibleState(b), 'unfunded');
}

{
  const tx = createSimulatedTx();
  let b = open();
  b = must(await fundBounty(b, tx));
  assert.equal(visibleState(b), 'funded');
  assert.equal(visibleCopy(b).title, 'Submit work');
  assert.ok(fundingTx(b));
  assert.match(fundingTx(b), /^[1-9A-HJ-NP-Za-km-z]{64}$/);
  b = must(submitWork(b, work()));
  assert.equal(b.submissions.length, 1);
  b = must(selectWinner(b, 'sub-1', { kind: 'wallet', id: WORKER, wallet: WORKER, handle: 'ada' }));
  assert.equal(visibleState(b), 'selected');
  assert.equal(visibleCopy(b).title, 'Winner selected');
  b = must(await payBounty(b, tx));
  assert.equal(visibleState(b), 'paid');
  assert.equal(visibleCopy(b).title, 'Paid on Solana');
  assert.ok(settlementTx(b));
  assert.notEqual(fundingTx(b), settlementTx(b));
  assert.equal(b.history.length, 2);
}

{
  const sig = fakeSignature('fund-once');
  const tx = createSimulatedTx({ signature: sig });
  let b = must(await fundBounty(open('loop-dup'), tx));
  const again = await fundBounty(b, tx);
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  assert.equal(visibleState(again.bounty), 'funded');
  assert.equal(fundingTx(again.bounty), sig);
  const other = await fundBounty(b, createSimulatedTx({ signature: fakeSignature('fund-other') }));
  assert.equal(other.ok, false);
  assert.equal(other.error, 'duplicate_funding');
}

{
  const paySig = fakeSignature('pay-once');
  const tx = createSimulatedTx({ signatures: { funding: fakeSignature('f1'), settlement: paySig } });
  let b = open('loop-pay');
  b = must(await fundBounty(b, tx));
  b = must(submitWork(b, work()));
  b = must(selectWinner(b, 'sub-1', { kind: 'wallet', id: WORKER, wallet: WORKER }));
  b = must(await payBounty(b, tx));
  const again = await payBounty(b, tx);
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  const other = await payBounty(b, createSimulatedTx({ signature: fakeSignature('pay-other') }));
  assert.equal(other.ok, false);
  assert.equal(other.error, 'double_settlement');
}

{
  const tx = createSimulatedTx({ signatures: { funding: fakeSignature('rf'), settlement: fakeSignature('rs') } });
  let b = open('loop-retry');
  b = must(await fundBounty(b, tx));
  b = must(submitWork(b, work()));
  b = must(selectWinner(b, 'sub-1', { kind: 'wallet', id: WORKER, wallet: WORKER }));
  const timed = await payBounty(b, createSimulatedTx({ signatures: { settlement: fakeSignature('rs') }, timeout: true }));
  assert.equal(timed.ok, false);
  assert.equal(timed.error, TX_ERRORS.confirmation_timeout);
  assert.equal(visibleState(timed.bounty), 'failed');
  const paid = await payBounty(timed.bounty, tx);
  assert.equal(paid.ok, true);
  assert.equal(visibleState(paid.bounty), 'paid');
}

{
  const rejected = await fundBounty(open('loop-reject'), createSimulatedTx({ reject: true }));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, TX_ERRORS.user_rejected);
  assert.equal(visibleState(rejected.bounty), 'failed');
  const recovered = await fundBounty(rejected.bounty, createSimulatedTx({ signature: fakeSignature('after-reject') }));
  assert.equal(recovered.ok, true);
  assert.equal(visibleState(recovered.bounty), 'funded');
}

{
  const sim = await fundBounty(open('loop-sim'), createSimulatedTx({ simulateFail: true }));
  assert.equal(sim.ok, false);
  assert.equal(sim.error, TX_ERRORS.simulation_failed);
  assert.equal(visibleState(sim.bounty), 'failed');
}

{
  const timed = await fundBounty(open('loop-to'), createSimulatedTx({ timeout: true }));
  assert.equal(timed.ok, false);
  assert.equal(timed.error, TX_ERRORS.confirmation_timeout);
}

{
  let requests = 0;
  const tx = createSimulatedTx({
    signature: fakeSignature('idem'),
    onRequest: () => {
      requests += 1;
    },
  });
  const first = await fundBounty(open('loop-idem'), tx);
  const second = await fundBounty(first.bounty, tx);
  assert.equal(second.replayed, true);
  assert.equal(fundingTx(second.bounty), fundingTx(first.bounty));
  assert.equal(requests, 1);
}

{
  let b = must(await fundBounty(open('loop-bad'), createSimulatedTx()));
  const bad = submitWork(b, { id: 'nope' });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'malformed_submission');
}

{
  const expired = createOpenBounty({
    id: 'loop-exp',
    title: '25 USDC bounty',
    amount: '25',
    creator: { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: null },
    creatorWallet: CREATOR,
    createdAt: '2026-07-01T00:00:00.000Z',
    deadline: '2026-08-01T00:00:00.000Z',
  });
  const funded = must(await fundBounty(expired, createSimulatedTx({ signature: fakeSignature('exp') })));
  const late = submitWork(funded, work(), new Date('2026-08-30T00:00:00.000Z'));
  assert.equal(late.error, 'expired');
  const closed = expireBounty(funded, new Date('2026-08-30T00:00:00.000Z'));
  assert.equal(closed.ok, true);
  assert.equal(visibleState(closed.bounty), 'cancelled');
}

{
  const cancelled = cancelBounty(open('loop-can'), 'changed mind');
  assert.equal(visibleState(cancelled.bounty), 'cancelled');
}

{
  const live = JSON.parse(read('commons/fixtures/live-bounties.json'));
  assert.deepEqual(live, { ...LIVE_EMPTY_FEED, listings: [] });
  assert.equal(consumeDashaFeed(live).bounties.length, 0);
  assert.deepEqual(emitDashaFeed(consumeDashaFeed(live)), live);
  assert.equal(B.toFeed([]).schema, LEGACY_FEED_SCHEMA);
  assert.deepEqual(B.toFeed([]).listings, []);
  assert.equal(B.visibleState(null), 'unfunded');
}

{
  const tx = createSimulatedTx({
    signatures: { funding: fakeSignature('ui-f'), settlement: fakeSignature('ui-p') },
  });
  let b = createOpenBounty({
    id: 'loop-ui',
    title: '25 USDC bounty',
    amount: 25,
    creatorWallet: CREATOR,
    creator: { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: null },
    createdAt: '2026-08-30T00:00:00.000Z',
  });
  const created = B.renderLoopCard(b);
  assert.match(created, /25 USDC bounty/);
  assert.match(created, /unfunded/);
  assert.match(created, />Fund</);
  assert.doesNotMatch(created, /holder status|Simp Points|need no wallet|plugin\.jup\.ag/i);
  assert.doesNotMatch(created, /decentralized|liquidity primitive/i);
  b = must(await fundBounty(b, tx));
  const fundedCard = B.renderLoopCard(b);
  assert.match(fundedCard, /Submit work/);
  assert.match(fundedCard, /data-state="funded"/);
  assert.doesNotMatch(fundedCard, />Fund</);
  b = must(submitWork(b, work()));
  b = must(selectWinner(b, 'sub-1', { kind: 'wallet', id: WORKER, wallet: WORKER, handle: 'ada' }));
  assert.match(B.renderLoopCard(b), /Winner selected/);
  assert.match(B.renderLoopCard(b), />Pay</);
  const timed = await payBounty(b, createSimulatedTx({ signatures: { settlement: fakeSignature('ui-p') }, timeout: true }));
  const failedCard = B.renderLoopCard(timed.bounty);
  assert.match(failedCard, />Pay</);
  assert.doesNotMatch(failedCard, />Fund</);
  b = must(await payBounty(timed.bounty, tx));
  const paidCard = B.renderLoopCard(b);
  assert.match(paidCard, /Paid on Solana/);
  assert.doesNotMatch(paidCard, />Pay</);
  assert.doesNotMatch(paidCard, />Fund</);
}

{
  const auto = await fundBounty(open('loop-auto'), {
    autoSign: true,
    requestSignature: async () => ({ signature: fakeSignature('nope') }),
    confirm: async (signature) => ({ signature }),
  });
  assert.equal(auto.ok, false);
  assert.equal(auto.error, 'auto_sign_forbidden');
}

{
  assert.equal(typeof B.LOOP_STORAGE_KEY, 'string');
  const html = read('bounties/index.html');
  assert.match(html, /id="bb-loop"/);
  assert.match(html, /id="bb-loop-start"/);
  assert.doesNotMatch(html, /holder status|Simp Points|need no wallet/i);
}

console.log('commons-loop: PASS');
