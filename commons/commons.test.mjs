#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOUNTY_SCHEMA,
  EVENT_SCHEMA,
  FEED_SCHEMA,
  LEGACY_FEED_SCHEMA,
  SCHEMA_VERSION,
  STATES,
  USDC_MINT,
  apply,
  canTransition,
  LIVE_EMPTY_FEED,
  LIVE_FEED_NOT_FOUND,
  LIVE_FEED_URL,
  consumeDashaFeed,
  createBounty,
  dedupeEvents,
  emitDashaFeed,
  fromLegacyFeed,
  fromLegacyListing,
  isCommonsBounty,
  isStaleFeed,
  makeEvent,
  renderEvent,
  toLegacyFeed,
  toLegacyListing,
  validateBounty,
  validateSubmission,
} from './index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const B = require('../bounties/board.js');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const SIG_A = '1111111111111111111111111111111111111111111111111111111111111111';
const SIG_B = '2222222222222222222222222222222222222222222222222222222222222222';
const SIG_C = '3333333333333333333333333333333333333333333333333333333333333333';
const PAYOUT = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';

const creator = { kind: 'wallet', id: PAYOUT, wallet: PAYOUT, handle: null };
const worker = { kind: 'github', id: 'ada', handle: 'ada', wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' };

function ev(type, extra = {}, i = ev.n++) {
  return makeEvent({
    id: `evt-${type}-${i}`,
    type,
    ts: extra.ts || '2026-08-30T12:00:00.000Z',
    origin: extra.origin || (extra.tx ? 'chain' : 'app'),
    idempotencyKey: extra.idempotencyKey || `key-${type}-${i}`,
    tx: extra.tx || null,
    payload: extra.payload || null,
    bountyId: extra.bountyId || 'bounty-1',
  });
}
ev.n = 1;

function draft(extra = {}) {
  return createBounty({
    id: extra.id || 'bounty-1',
    title: extra.title || '25 USDC bounty',
    description: extra.description || 'Fix the docs screenshot',
    creator,
    creatorWallet: PAYOUT,
    reward: { asset: 'spl', symbol: 'USDC', mint: USDC_MINT, amount: '25', chain: 'solana' },
    createdAt: '2026-08-30T00:00:00.000Z',
    deadline: extra.deadline || '2026-09-30T00:00:00.000Z',
    rules: { eligibility: 'anyone with GitHub', submissionFormat: 'github_proof', text: 'PR or comment' },
    source: { kind: 'app', community: null, ref: null },
    ...extra.create,
  });
}

function must(result) {
  assert.equal(result.ok, true, result.detail ? JSON.stringify(result.detail) : result.error);
  return result.bounty;
}

function submissionOpen() {
  let b = draft();
  b = must(apply(b, ev('publish')));
  b = must(apply(b, ev('start_funding')));
  b = must(
    apply(b, ev('observe_funding', { tx: { signature: SIG_A, chain: 'solana', purpose: 'funding' }, payload: { openSubmissions: true } })),
  );
  return b;
}

function work() {
  return {
    schema: 'commons.submission/v1',
    id: 'sub-1',
    bountyId: 'bounty-1',
    submitter: worker,
    submittedAt: '2026-08-30T13:00:00.000Z',
    format: 'github_proof',
    proof: { url: 'https://github.com/Uuriko/dasha-desk/pull/19' },
    status: 'received',
  };
}

assert.deepEqual(STATES, [
  'draft',
  'open',
  'funding_pending',
  'funded',
  'submission_open',
  'selection_pending',
  'selected',
  'settlement_pending',
  'paid',
  'cancelled',
  'refund_pending',
  'refunded',
  'failed',
]);

{
  const b = draft();
  assert.equal(validateBounty(b).ok, true);
  assert.equal(b.schema, BOUNTY_SCHEMA);
  assert.equal(b.schemaVersion, SCHEMA_VERSION);
  assert.doesNotMatch(JSON.stringify(b), /dasha/i);
  assert.equal(b.source.community, null);
}

{
  let b = draft();
  b = must(apply(b, ev('publish')));
  assert.equal(b.state, 'open');
  b = must(apply(b, ev('start_funding')));
  assert.equal(b.state, 'funding_pending');
  b = must(apply(b, ev('observe_funding', { tx: { signature: SIG_A, chain: 'solana', purpose: 'funding' } })));
  assert.equal(b.state, 'funded');
  assert.equal(b.funding.state, 'funded');
  assert.equal(b.funding.tx.signature, SIG_A);
  b = must(apply(b, ev('open_submissions')));
  assert.equal(b.state, 'submission_open');
  b = must(apply(b, ev('submit', { payload: { submission: work() } })));
  assert.equal(b.submissions.length, 1);
  b = must(apply(b, ev('close_submissions')));
  assert.equal(b.state, 'selection_pending');
  b = must(apply(b, ev('select_winner', { payload: { winners: [{ submissionId: 'sub-1', identity: worker }] } })));
  assert.equal(b.state, 'selected');
  assert.equal(b.winners[0].submissionId, 'sub-1');
  b = must(apply(b, ev('start_settlement')));
  assert.equal(b.state, 'settlement_pending');
  b = must(apply(b, ev('observe_settlement', { tx: { signature: SIG_B, chain: 'solana', purpose: 'settlement' } })));
  assert.equal(b.state, 'paid');
  assert.equal(b.settlement.tx.signature, SIG_B);
  assert.equal(b.history.length, 2);
}

{
  const b = draft();
  const bad = apply(b, ev('observe_settlement', { tx: { signature: SIG_B, chain: 'solana', purpose: 'settlement' } }));
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'invalid_transition');
  assert.equal(canTransition('paid', 'cancel'), false);
  assert.equal(apply(b, ev('select_winner', { payload: { winners: [{ submissionId: 'nope' }] } })).error, 'invalid_transition');
}

{
  let b = draft();
  b = must(apply(b, ev('publish')));
  b = must(apply(b, ev('start_funding')));
  const first = ev('observe_funding', { tx: { signature: SIG_A, chain: 'solana', purpose: 'funding' }, idempotencyKey: 'fund-1' });
  b = must(apply(b, first));
  const dupSame = apply(b, ev('observe_funding', { tx: { signature: SIG_A, chain: 'solana', purpose: 'funding' }, idempotencyKey: 'fund-1' }));
  assert.equal(dupSame.ok, true);
  assert.equal(dupSame.replayed, true);
  assert.equal(dupSame.bounty.state, 'funded');
  const dupOther = apply(b, ev('observe_funding', { tx: { signature: SIG_B, chain: 'solana', purpose: 'funding' } }));
  assert.equal(dupOther.ok, false);
  assert.equal(dupOther.error, 'duplicate_funding');
}

{
  let b = submissionOpen();
  b = must(apply(b, ev('submit', { payload: { submission: work() } })));
  b = must(apply(b, ev('close_submissions')));
  b = must(apply(b, ev('select_winner', { payload: { winners: [{ submissionId: 'sub-1', identity: worker }] } })));
  b = must(apply(b, ev('start_settlement')));
  const pay = ev('observe_settlement', { tx: { signature: SIG_B, chain: 'solana', purpose: 'settlement' }, idempotencyKey: 'pay-1' });
  b = must(apply(b, pay));
  const retrySame = apply(b, ev('observe_settlement', { tx: { signature: SIG_B, chain: 'solana', purpose: 'settlement' }, idempotencyKey: 'pay-1' }));
  assert.equal(retrySame.ok, true);
  assert.equal(retrySame.replayed, true);
  const otherSig = apply(b, ev('observe_settlement', { tx: { signature: SIG_C, chain: 'solana', purpose: 'settlement' } }));
  assert.equal(otherSig.ok, false);
  assert.equal(otherSig.error, 'double_settlement');
}

{
  let b = submissionOpen();
  b = must(apply(b, ev('submit', { payload: { submission: work() } })));
  b = must(apply(b, ev('close_submissions')));
  b = must(apply(b, ev('select_winner', { payload: { winners: [{ submissionId: 'sub-1', identity: worker }] } })));
  b = must(apply(b, ev('start_settlement')));
  b = must(apply(b, ev('fail')));
  assert.equal(b.state, 'failed');
  assert.equal(b.settlement.state, 'failed');
  b = must(apply(b, ev('retry_settlement')));
  assert.equal(b.state, 'settlement_pending');
  b = must(apply(b, ev('observe_settlement', { tx: { signature: SIG_B, chain: 'solana', purpose: 'settlement' } })));
  assert.equal(b.state, 'paid');
}

{
  let b = draft();
  b = must(apply(b, ev('publish')));
  b = must(apply(b, ev('cancel', { payload: { reason: 'changed mind' } })));
  assert.equal(b.state, 'cancelled');
  assert.equal(b.cancellation.reason, 'changed mind');
  assert.equal(apply(b, ev('request_refund')).error, 'invalid_transition');
}

{
  let b = submissionOpen();
  b = must(apply(b, ev('cancel', { payload: { reason: 'no good work' } })));
  assert.equal(b.state, 'refund_pending');
  assert.equal(b.refund.reason, 'no good work');
  b = must(apply(b, ev('observe_refund', { tx: { signature: SIG_C, chain: 'solana', purpose: 'refund' } })));
  assert.equal(b.state, 'refunded');
  assert.equal(b.refund.tx.signature, SIG_C);
}

{
  const b = submissionOpen();
  const empty = apply(b, ev('submit', { payload: { submission: { id: 'x' } } }));
  assert.equal(empty.ok, false);
  assert.equal(empty.error, 'malformed_submission');
  const badUrl = apply(
    b,
    ev('submit', {
      payload: {
        submission: {
          id: 'sub-bad',
          submitter: worker,
          submittedAt: '2026-08-30T13:00:00.000Z',
          format: 'github_proof',
          proof: { url: 'https://example.com/not-github' },
        },
      },
    }),
  );
  assert.equal(badUrl.ok, false);
  assert.equal(badUrl.error, 'malformed_submission');
  assert.equal(validateSubmission({ id: 'nope' }).ok, false);
}

{
  const expired = draft({ deadline: '2026-08-01T00:00:00.000Z' });
  let b = must(apply(expired, ev('publish')));
  b = must(apply(b, ev('start_funding')));
  b = must(
    apply(b, ev('observe_funding', { tx: { signature: SIG_A, chain: 'solana', purpose: 'funding' }, payload: { openSubmissions: true } })),
  );
  const late = apply(b, ev('submit', { payload: { submission: work() } }), new Date('2026-08-30T00:00:00.000Z'));
  assert.equal(late.error, 'expired');
  const closed = apply(b, ev('expire'), new Date('2026-08-30T00:00:00.000Z'));
  assert.equal(closed.ok, true);
  assert.equal(closed.bounty.state, 'refund_pending');
  assert.equal(closed.bounty.cancellation.reason, 'expired');
}

{
  let b = draft({ deadline: '2026-08-01T00:00:00.000Z' });
  b = must(apply(b, ev('publish')));
  const expiredOpen = apply(b, ev('expire'), new Date('2026-08-30T00:00:00.000Z'));
  assert.equal(expiredOpen.bounty.state, 'cancelled');
}

{
  const fresh = isStaleFeed({ generatedAt: '2026-08-30T11:00:00.000Z' }, new Date('2026-08-30T12:00:00.000Z'));
  assert.equal(fresh.stale, false);
  const stale = isStaleFeed({ generatedAt: '2026-08-29T00:00:00.000Z' }, new Date('2026-08-30T12:00:00.000Z'));
  assert.equal(stale.stale, true);
  const unknown = isStaleFeed({ schema: LEGACY_FEED_SCHEMA, listings: [] });
  assert.equal(unknown.stale, false);
  assert.equal(unknown.unknown, true);
}

{
  const first = ev('publish', { idempotencyKey: 'pub-1' });
  let b = must(apply(draft(), first));
  const again = apply(b, first);
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  assert.equal(again.bounty.state, 'open');
}

{
  const feed = JSON.parse(read('bounties/feed.json'));
  const rootFeed = JSON.parse(read('bounties.json'));
  const seed = JSON.parse(read('config/bounties.seed.json'));
  const live = JSON.parse(read('commons/fixtures/live-bounties.json'));
  const watchLegacy = { schema: LEGACY_FEED_SCHEMA, items: [] };
  const watchNow = JSON.parse(read('fixtures/watch/bounties.json'));
  assert.deepEqual(live, { ...LIVE_EMPTY_FEED, listings: [] });
  assert.deepEqual(live.listings, []);
  assert.equal(LIVE_FEED_URL, 'https://www.getdasha.com/bounties.json');
  assert.deepEqual(LIVE_FEED_NOT_FOUND, [
    'https://www.getdasha.com/bounties/api',
    'https://www.getdasha.com/bounties/feed',
    'https://www.getdasha.com/api/bounties',
    'https://www.getdasha.com/bounties/feed.json',
  ]);
  assert.ok(!('items' in live) && !('bounties' in live), 'live feed is listings-only; do not invent a second key');

  assert.deepEqual(feed, rootFeed);
  assert.deepEqual(feed.listings, seed.listings);

  const fromPages = consumeDashaFeed(feed);
  assert.equal(fromPages.schema, FEED_SCHEMA);
  assert.equal(fromPages.bounties.length, 2);
  assert.equal(fromPages.bounties[0].state, 'open');
  assert.equal(fromPages.bounties[0].funding.state, 'unfunded');
  assert.equal(fromPages.bounties[0].reward.symbol, 'USDC');
  assert.equal(fromPages.bounties[0].reward.mint, USDC_MINT);
  assert.equal(fromPages.bounties[0].source.community, 'getdasha');
  assert.equal(fromPages.bounties[0].source.feed, LEGACY_FEED_SCHEMA);
  assert.equal(fromPages.bounties[0].title, 'docs: add CONTRIBUTING screenshot of GitHub web edit flow');
  assert.doesNotMatch(fromPages.bounties[0].schema, /dasha/);

  const fromLive = consumeDashaFeed(live);
  assert.equal(fromLive.bounties.length, 0, 'empty listings is honest, not a parse failure');
  assert.deepEqual(emitDashaFeed(fromLive), live);
  assert.equal(emitDashaFeed(fromLive).schema, LEGACY_FEED_SCHEMA);
  assert.ok(!('items' in emitDashaFeed(fromLive)));
  assert.ok(!('bounties' in emitDashaFeed(fromLive)));

  const fromItems = fromLegacyFeed(watchLegacy);
  assert.equal(fromItems.bounties.length, 0);
  assert.equal(fromItems.source.schema, LEGACY_FEED_SCHEMA);
  assert.equal(consumeDashaFeed(watchNow).bounties.length, 0);

  const back = toLegacyFeed(fromPages);
  assert.equal(back.schema, LEGACY_FEED_SCHEMA);
  assert.equal(back.listings.length, 2);
  assert.equal(back.listings[0].name, feed.listings[0].name);
  assert.equal(back.listings[0].itemUrl, feed.listings[0].itemUrl);
  assert.equal(back.listings[0].amount, 25);
  assert.equal(back.listings[0].currency, 'USDC');
  assert.equal(back.listings[0].payTo, null);
  assert.equal(back.listings[0].payoutStatus, 'not_implemented');
  assert.equal(back.listings[1].kind, 'project');

  const boardFromCommons = B.listingsFromSeed({ bounties: fromPages.bounties });
  assert.equal(boardFromCommons.length, 0, 'board reads listings, not Commons bounties, on this PR');

  const boardFromItems = B.listingsFromSeed(watchLegacy);
  assert.deepEqual(boardFromItems, []);
  const boardFromLive = B.listingsFromSeed(live);
  assert.deepEqual(boardFromLive, []);
  const boardFromSeed = B.listingsFromSeed(feed);
  assert.equal(boardFromSeed.length, 2);
}

{
  const funded = B.normalizeListing({
    itemUrl: 'https://github.com/Uuriko/dasha-desk/issues/8',
    amount: 25,
    payTo: PAYOUT,
  });
  const canonical = fromLegacyListing(funded);
  assert.equal(isCommonsBounty(canonical), true);
  assert.equal(canonical.state, 'open');
  assert.equal(canonical.funding.state, 'declared');
  assert.equal(canonical.creatorWallet, PAYOUT);
  assert.equal(canonical.reward.amount, '25');
  const legacy = toLegacyListing(canonical);
  const again = B.normalizeListing(legacy);
  assert.equal(again.payTo, PAYOUT);
  assert.equal(again.amount, 25);
  assert.equal(again.itemUrl, 'https://github.com/Uuriko/dasha-desk/issues/8');
  assert.notEqual(again.payoutStatus, 'not_implemented');
  assert.equal(B.toFeed([again]).schema, LEGACY_FEED_SCHEMA);
  assert.equal(B.toFeed([again]).listings[0].itemUrl, funded.itemUrl);
}

{
  const withOutcome = B.normalizeListing({
    itemUrl: 'https://github.com/Uuriko/dasha-desk/issues/8',
    amount: 25,
    payTo: PAYOUT,
    outcomes: [{ login: 'ada', url: 'https://github.com/Uuriko/dasha-desk/pull/19' }],
  });
  const canonical = fromLegacyListing(withOutcome);
  assert.equal(canonical.state, 'selected');
  assert.equal(canonical.winners.length, 1);
  assert.equal(canonical.settlement.state, 'none');
  const emitted = emitDashaFeed({ bounties: [canonical] });
  assert.equal(emitted.listings[0].outcomes[0].url, 'https://github.com/Uuriko/dasha-desk/pull/19');
  assert.equal(B.listingsFromSeed(emitted).length, 1);
}

{
  assert.equal(fromLegacyListing({}), null);
  assert.equal(fromLegacyListing(null), null);
  const junk = fromLegacyFeed({ listings: [{}, { repo: 'not a repo' }, { name: 'Zine' }] });
  assert.equal(junk.bounties.length, 1);
  assert.equal(junk.bounties[0].title, 'Zine');
}

{
  let b = submissionOpen();
  b = must(apply(b, ev('submit', { payload: { submission: work() } })));
  const line = renderEvent(
    { id: 'e', type: 'observe_settlement', ts: '2026-08-30T12:00:00.000Z', origin: 'chain', tx: { signature: SIG_B } },
    b,
  );
  assert.equal(line.title, 'Paid on Solana');
  assert.equal(line.chainObserved, true);
  const posted = renderEvent({ id: 'e2', type: 'publish', ts: '2026-08-30T12:00:00.000Z', origin: 'app' }, b);
  assert.match(posted.title, /25 USDC bounty/);
  assert.doesNotMatch(JSON.stringify(line), /decentralized|liquidity primitive|task market/i);
  const events = [
    { id: 'a', idempotencyKey: 'k', type: 'publish' },
    { id: 'b', idempotencyKey: 'k', type: 'publish' },
    { id: 'c', idempotencyKey: 'k2', type: 'cancel' },
  ];
  assert.deepEqual(
    dedupeEvents(events).map((e) => e.id),
    ['a', 'c'],
  );
}

{
  const event = makeEvent({
    id: 'tape-1',
    type: 'submit',
    ts: '2026-08-30T12:00:00.000Z',
    idempotencyKey: 'tape-1',
    origin: 'app',
  });
  assert.equal(event.schema, EVENT_SCHEMA);
  assert.equal(event.render.title, 'Work received');
}

console.log('commons: PASS');
