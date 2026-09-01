#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOUNTY_SCHEMA,
  EVENT_SCHEMA,
  FEED_SCHEMA,
  LEGACY_FEED_SCHEMA,
  LIVE_EMPTY_FEED,
  LIVE_FEED_NOT_FOUND,
  LIVE_FEED_URL,
  SCHEMA_VERSION,
  STATES,
  SUBMISSION_SCHEMA,
  TX_SCHEMA,
  USDC_MINT,
  apply,
  consumeDashaFeed,
  createBounty,
  dedupeEvents,
  emitDashaFeed,
  fromLegacyFeed,
  fromLegacyListing,
  isCanonicalAmount,
  isCommonsBounty,
  isDashaUsdcReward,
  isStaleFeed,
  makeEvent,
  renderEvent,
  toLegacyListing,
  validateBounty,
  validateEvent,
  validateLegacyListing,
  validateSubmission,
  validateTx,
} from './index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const CREATOR = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const VAULT = '8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const WORKER_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const OTHER_WALLET = '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const SIG_A = '1'.repeat(64);
const SIG_B = '2'.repeat(64);
const SIG_C = '3'.repeat(64);
const SIG_D = '4'.repeat(64);
const creator = { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: null };
const worker = { kind: 'github', id: 'ada', handle: 'ada', wallet: WORKER_WALLET };

function draft(extra = {}) {
  return createBounty({
    id: extra.id || 'bounty-1',
    title: extra.title || '25 USDC bounty',
    description: 'Fix the docs screenshot',
    creator,
    creatorWallet: CREATOR,
    fundingDestination: VAULT,
    settlementSource: VAULT,
    reward: extra.reward || { asset: 'spl', symbol: 'USDC', mint: USDC_MINT, amount: '25', chain: 'solana' },
    createdAt: '2026-08-30T00:00:00.000Z',
    deadline: extra.deadline === undefined ? '2026-09-30T00:00:00.000Z' : extra.deadline,
    rules: { eligibility: 'anyone with GitHub', submissionFormat: 'github_proof', text: 'PR or comment' },
    source: { kind: 'app', community: null, ref: null },
    ...extra.create,
  });
}

function transfer(purpose, signature, status = 'confirmed', extra = {}) {
  const endpoints = {
    funding: [CREATOR, VAULT],
    settlement: [VAULT, WORKER_WALLET],
    refund: [VAULT, CREATOR],
  };
  const [source, destination] = endpoints[purpose];
  const tx = {
    schema: TX_SCHEMA,
    signature,
    chain: 'solana',
    purpose,
    status,
    source,
    destination,
    asset: 'spl',
    symbol: 'USDC',
    mint: USDC_MINT,
    amount: '25',
    ...extra,
  };
  if (status === 'confirmed') {
    tx.success = true;
    tx.slot = 123456;
    tx.commitment = 'finalized';
    tx.observedBy = 'public-rpc';
  } else if (status === 'failed' || status === 'not_found') {
    tx.success = false;
    tx.observedBy = 'public-rpc';
  }
  return tx;
}

function event(type, extra = {}) {
  const i = event.n++;
  return makeEvent({
    id: extra.id || `evt-${type}-${i}`,
    type,
    bountyId: extra.bountyId || 'bounty-1',
    ts: extra.ts || `2026-08-30T12:${String(i % 60).padStart(2, '0')}:00.000Z`,
    origin: extra.origin || (type.startsWith('observe_') || type.startsWith('reconcile_') ? 'chain' : 'app'),
    idempotencyKey: extra.idempotencyKey || `key-${type}-${i}`,
    tx: extra.tx || null,
    payload: extra.payload || null,
  });
}
event.n = 1;

function submission(extra = {}) {
  return {
    schema: SUBMISSION_SCHEMA,
    id: extra.id || 'sub-1',
    bountyId: extra.bountyId || 'bounty-1',
    submitter: extra.submitter || worker,
    submittedAt: '2026-08-30T13:00:00.000Z',
    format: 'github_proof',
    proof: { url: extra.url || 'https://github.com/Uuriko/dasha-desk/pull/19' },
    status: 'received',
  };
}

function must(result) {
  assert.equal(result.ok, true, `${result.error || 'error'}: ${JSON.stringify(result.detail || '')}`);
  return result.bounty;
}

function funded({ open = true, candidate = true } = {}) {
  let b = draft();
  b = must(apply(b, event('publish')));
  const submitted = candidate ? transfer('funding', SIG_A, 'submitted') : null;
  b = must(apply(b, event('start_funding', { tx: submitted })));
  b = must(apply(b, event('observe_funding', {
    tx: transfer('funding', SIG_A),
    payload: { openSubmissions: open },
  })));
  return b;
}

function selected() {
  let b = funded();
  b = must(apply(b, event('submit', { payload: { submission: submission() } })));
  b = must(apply(b, event('close_submissions')));
  b = must(apply(b, event('select_winner', { payload: { winners: [{ submissionId: 'sub-1' }] } })));
  return b;
}

assert.deepEqual(STATES, [
  'draft', 'open', 'funding_pending', 'funded', 'submission_open', 'selection_pending',
  'selected', 'settlement_pending', 'paid', 'cancelled', 'refund_pending', 'refunded', 'failed',
]);

for (const value of ['1', '25', '0.1', '1.25', '999999999999999999', '0.000001']) {
  assert.equal(isCanonicalAmount(value), true, value);
}
for (const value of [0, 1, '', '0', '-1', '+1', '01', '1.0', '1.230', '1e3', 'Infinity', 'NaN', '0.0000000000000000001']) {
  assert.equal(isCanonicalAmount(value), false, String(value));
}
assert.equal(isCanonicalAmount('0.000001', 6), true);
assert.equal(isCanonicalAmount('0.0000001', 6), false);
for (const amount of ['oops', 'Infinity', '1e3', '01', '1.0', '0', '-1']) {
  assert.throws(() => draft({ reward: { asset: 'spl', symbol: 'USDC', mint: USDC_MINT, amount, chain: 'solana' } }));
}

{
  const b = draft();
  assert.equal(validateBounty(b).ok, true);
  assert.equal(b.schema, BOUNTY_SCHEMA);
  assert.equal(b.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(b.seenEventIds, []);
  assert.deepEqual(b.seenEvents, {});
}

{
  let b = draft();
  b = must(apply(b, event('publish')));
  const fundingCandidate = event('start_funding', { tx: transfer('funding', SIG_A, 'submitted') });
  b = must(apply(b, fundingCandidate));
  assert.equal(b.state, 'funding_pending');
  assert.equal(b.funding.tx.status, 'submitted');
  b = must(apply(b, event('observe_funding', { tx: transfer('funding', SIG_A), payload: { openSubmissions: true } })));
  assert.equal(b.state, 'submission_open');
  assert.equal(b.funding.tx.status, 'confirmed');
  b = must(apply(b, event('submit', { payload: { submission: submission() } })));
  b = must(apply(b, event('close_submissions')));
  b = must(apply(b, event('select_winner', { payload: { winners: [{ submissionId: 'sub-1' }] } })));
  assert.equal(b.winners.length, 1);
  assert.deepEqual(b.winners[0].identity, worker);
  b = must(apply(b, event('start_settlement', { tx: transfer('settlement', SIG_B, 'submitted') })));
  assert.equal(b.state, 'settlement_pending');
  b = must(apply(b, event('observe_settlement', { tx: transfer('settlement', SIG_B) })));
  assert.equal(b.state, 'paid');
  assert.equal(b.settlement.tx.status, 'confirmed');
  assert.equal(b.history.filter((tx) => tx.status === 'confirmed').length, 2);
}

{
  const b = draft();
  const mismatch = { ...event('publish'), bountyId: 'bounty-2' };
  assert.equal(validateEvent(mismatch).ok, true);
  assert.equal(apply(b, mismatch).error, 'bounty_mismatch');
  const open = funded();
  const badSubmission = submission({ bountyId: 'bounty-2' });
  assert.equal(validateSubmission(badSubmission).ok, true);
  assert.equal(apply(open, event('submit', { payload: { submission: badSubmission } })).error, 'bounty_mismatch');
}

{
  const first = event('publish', { idempotencyKey: 'publish-once' });
  const b = must(apply(draft(), first));
  const same = apply(b, first);
  assert.equal(same.ok, true);
  assert.equal(same.replayed, true);
  const conflict = { ...event('cancel'), idempotencyKey: 'publish-once' };
  assert.equal(apply(b, conflict).error, 'idempotency_conflict');
}

{
  let b = funded();
  const first = submission();
  b = must(apply(b, event('submit', { payload: { submission: first } })));
  const replay = apply(b, event('submit', { payload: { submission: first } }));
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  const changed = submission({ url: 'https://github.com/Uuriko/dasha-desk/pull/20' });
  assert.equal(apply(b, event('submit', { payload: { submission: changed } })).error, 'submission_conflict');
}

{
  let b = must(apply(draft(), event('publish')));
  b = must(apply(b, event('start_funding', { tx: transfer('funding', SIG_A, 'submitted') })));
  assert.throws(() => event('observe_funding', { origin: 'app', tx: transfer('funding', SIG_A) }));
  assert.throws(() => event('observe_funding', { tx: transfer('funding', SIG_A, 'submitted') }));
  assert.equal(apply(b, event('observe_funding', { tx: transfer('funding', SIG_A, 'confirmed', { amount: '24' }) })).error, 'transaction_mismatch');
  assert.equal(apply(b, event('observe_funding', { tx: transfer('funding', SIG_A, 'confirmed', { destination: OTHER_WALLET }) })).error, 'transaction_mismatch');
  assert.equal(apply(b, event('observe_funding', { tx: transfer('funding', SIG_A, 'confirmed', { mint: OTHER_WALLET }) })).error, 'transaction_mismatch');
  assert.equal(apply(b, event('observe_funding', { tx: transfer('settlement', SIG_A) })).error, 'wrong_transaction_purpose');
}

{
  let b = must(apply(draft(), event('publish')));
  b = must(apply(b, event('start_funding', { tx: transfer('funding', SIG_A, 'submitted') })));
  b = must(apply(b, event('fail')));
  assert.equal(b.state, 'failed');
  assert.equal(b.funding.state, 'reconcile_required');
  assert.equal(apply(b, event('retry_funding', { tx: transfer('funding', SIG_B, 'submitted') })).error, 'invalid_transition');
  assert.equal(apply(b, event('reconcile_funding', { tx: transfer('funding', SIG_B, 'not_found') })).error, 'candidate_transaction_mismatch');
  b = must(apply(b, event('reconcile_funding', { tx: transfer('funding', SIG_A, 'not_found') })));
  assert.equal(b.funding.state, 'failed');
  b = must(apply(b, event('retry_funding', { tx: transfer('funding', SIG_B, 'submitted') })));
  assert.equal(b.state, 'funding_pending');
  assert.equal(b.funding.tx.signature, SIG_B);
}

{
  let b = selected();
  b = must(apply(b, event('start_settlement', { tx: transfer('settlement', SIG_B, 'submitted') })));
  b = must(apply(b, event('fail')));
  assert.equal(b.settlement.state, 'reconcile_required');
  assert.equal(apply(b, event('retry_settlement', { tx: transfer('settlement', SIG_C, 'submitted') })).error, 'invalid_transition');
  b = must(apply(b, event('reconcile_settlement', { tx: transfer('settlement', SIG_B, 'not_found') })));
  b = must(apply(b, event('retry_settlement', { tx: transfer('settlement', SIG_C, 'submitted') })));
  b = must(apply(b, event('observe_settlement', { tx: transfer('settlement', SIG_C) })));
  assert.equal(b.state, 'paid');
}

{
  let b = funded({ open: false });
  b = must(apply(b, event('cancel', { payload: { reason: 'refund test' } })));
  b = must(apply(b, event('request_refund', { tx: transfer('refund', SIG_C, 'submitted') })));
  b = must(apply(b, event('fail')));
  assert.equal(b.refund.state, 'reconcile_required');
  assert.equal(apply(b, event('retry_refund', { tx: transfer('refund', SIG_D, 'submitted') })).error, 'invalid_transition');
  b = must(apply(b, event('reconcile_refund', { tx: transfer('refund', SIG_C, 'failed') })));
  b = must(apply(b, event('retry_refund', { tx: transfer('refund', SIG_D, 'submitted') })));
  b = must(apply(b, event('observe_refund', { tx: transfer('refund', SIG_D) })));
  assert.equal(b.state, 'refunded');
}

{
  let b = must(apply(draft(), event('publish')));
  b = must(apply(b, event('start_funding', { tx: transfer('funding', SIG_A, 'submitted') })));
  b = must(apply(b, event('cancel', { payload: { reason: 'stop' } })));
  assert.equal(b.state, 'failed');
  assert.equal(b.funding.state, 'reconcile_required');
  assert.equal(b.cancellation.state, 'requested');
  b = must(apply(b, event('observe_funding', { tx: transfer('funding', SIG_A) })));
  assert.equal(b.state, 'refund_pending');
  assert.equal(b.funding.state, 'funded');
}

{
  let b = funded();
  b = must(apply(b, event('submit', { payload: { submission: submission() } })));
  b = must(apply(b, event('close_submissions')));
  assert.equal(apply(b, event('select_winner', { payload: { winners: [] } })).error, 'invalid_event');
  assert.equal(apply(b, event('select_winner', { payload: { winners: [{ submissionId: 'sub-1' }, { submissionId: 'sub-1' }] } })).error, 'invalid_event');
  assert.equal(apply(b, event('select_winner', {
    payload: { winners: [{ submissionId: 'sub-1', identity: { ...worker, wallet: OTHER_WALLET } }] },
  })).error, 'winner_identity_mismatch');
  b = must(apply(b, event('select_winner', { payload: { winners: [{ submissionId: 'sub-1' }] } })));
  assert.deepEqual(b.winners[0].identity, worker);
}

{
  let b = funded({ open: false });
  b = must(apply(b, event('cancel', { payload: { reason: 'withdrawn' } })));
  assert.equal(b.state, 'refund_pending');
  b = must(apply(b, event('observe_refund', { tx: transfer('refund', SIG_C) })));
  assert.equal(b.state, 'refunded');
}

{
  let b = funded();
  b = must(apply(b, event('submit', { payload: { submission: submission() } })));
  const duplicate = structuredClone(b);
  duplicate.submissions.push(structuredClone(duplicate.submissions[0]));
  assert.equal(validateBounty(duplicate).ok, false);
  const mismatched = structuredClone(b);
  mismatched.submissions[0].bountyId = 'bounty-2';
  assert.equal(validateBounty(mismatched).ok, false);
  const falsePaid = structuredClone(b);
  falsePaid.state = 'paid';
  assert.equal(validateBounty(falsePaid).ok, false);
}

{
  const feed = JSON.parse(read('bounties/feed.json'));
  const rootFeed = JSON.parse(read('bounties.json'));
  const seed = JSON.parse(read('config/bounties.seed.json'));
  const live = JSON.parse(read('commons/fixtures/live-bounties.json'));
  assert.deepEqual(feed, rootFeed);
  assert.deepEqual(feed.listings, seed.listings);
  assert.deepEqual(live, { ...LIVE_EMPTY_FEED, listings: [] });
  assert.equal(LIVE_FEED_URL, 'https://www.getdasha.com/bounties.json');
  assert.equal(LIVE_FEED_NOT_FOUND.length, 4);
  const canonical = consumeDashaFeed(feed);
  assert.equal(canonical.schema, FEED_SCHEMA);
  assert.equal(canonical.bounties.length, 2);
  assert.equal(canonical.rejected.length, 0);
  assert.equal(canonical.bounties[0].funding.state, 'unfunded');
  assert.equal(isCommonsBounty(canonical.bounties[0]), true);
  assert.equal(isDashaUsdcReward(canonical.bounties[0].reward), true);
  assert.deepEqual(emitDashaFeed(consumeDashaFeed(live)), live);
  const complete = { ...feed.listings[0], payTo: CREATOR };
  const declared = fromLegacyListing(complete);
  assert.equal(declared.funding.state, 'declared');
  assert.equal(toLegacyListing(declared).payTo, CREATOR);
  const invalidRows = [
    { name: 'Zine' },
    { ...complete, amount: 'Infinity' },
    { ...complete, pool: { amount: 26, currency: 'USDC' } },
    { ...complete, pool: { amount: 25, currency: 'SOL' } },
    { ...complete, chain: 'ethereum' },
    { ...complete, currency: 'SOL' },
    { ...complete, tokenMint: OTHER_WALLET },
    { ...complete, createdAt: null },
    { ...complete, outcomes: [{ login: 'ada', url: 'https://github.com/Uuriko/dasha-desk/pull/19' }] },
  ];
  const rejected = fromLegacyFeed({ schema: LEGACY_FEED_SCHEMA, listings: invalidRows });
  assert.equal(rejected.bounties.length, 0);
  assert.equal(rejected.rejected.length, invalidRows.length);
  invalidRows.forEach((row) => assert.equal(validateLegacyListing(row).ok, false));
  const malformedCanonical = structuredClone(canonical.bounties[0]);
  malformedCanonical.reward.amount = 'oops';
  const strict = fromLegacyFeed({ listings: [malformedCanonical] });
  assert.equal(strict.bounties.length, 0);
  assert.equal(strict.rejected.length, 1);
  assert.equal(isCommonsBounty(malformedCanonical), false);
  const sol = draft({ reward: { asset: 'sol', symbol: 'SOL', mint: null, amount: '1', chain: 'solana' } });
  assert.equal(toLegacyListing(sol), null);
}

{
  const tx = transfer('funding', SIG_A);
  assert.equal(validateTx(tx).ok, true);
  assert.equal(validateTx({ ...tx, schema: undefined }).ok, false);
  const e = event('observe_funding', { tx });
  assert.equal(e.schema, EVENT_SCHEMA);
  assert.equal(validateEvent({ ...e, schema: undefined }).ok, false);
}

{
  const line = renderEvent(event('observe_settlement', { tx: transfer('settlement', SIG_D) }), selected());
  assert.equal(line.chainObserved, true);
  const fake = renderEvent({ id: 'fake', type: 'observe_settlement', origin: 'chain', tx: { signature: SIG_D } }, selected());
  assert.equal(fake.chainObserved, false);
  const events = [
    { id: 'a', idempotencyKey: 'k', type: 'publish' },
    { id: 'b', idempotencyKey: 'k', type: 'cancel' },
    { id: 'c', idempotencyKey: 'k2', type: 'cancel' },
  ];
  assert.deepEqual(dedupeEvents(events).map((row) => row.id), ['a', 'c']);
  assert.equal(isStaleFeed({ generatedAt: '2026-08-30T11:00:00.000Z' }, new Date('2026-08-30T12:00:00.000Z')).stale, false);
  assert.equal(isStaleFeed({ generatedAt: '2026-08-29T00:00:00.000Z' }, new Date('2026-08-30T12:00:00.000Z')).stale, true);
}

console.log('commons: PASS');
