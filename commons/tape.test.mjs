#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIVE_EMPTY_FEED,
  consumeDashaFeed,
  emitDashaFeed,
  createOpenBounty,
  fundBounty,
  submitWork,
  selectWinner,
  payBounty,
  cancelBounty,
  createSimulatedTx,
  fakeSignature,
  ingestTape,
  eventFromWebhook,
  tapeFromBounties,
  eventsFromBounty,
  humanKind,
  makeEvent,
} from './index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const B = require('../bounties/board.js');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const CREATOR = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const WORKER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const SIG = fakeSignature('tape-fund');

function must(result) {
  assert.equal(result.ok, true, result.detail || result.error);
  return result.bounty;
}

async function demoLoop() {
  const tx = createSimulatedTx({
    signatures: { funding: fakeSignature('demo-fund'), settlement: fakeSignature('demo-pay') },
  });
  let b = createOpenBounty({
    id: 'demo-12',
    title: '25 USDC bounty',
    amount: '25',
    creator: { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: 'alice' },
    creatorWallet: CREATOR,
    createdAt: '2026-08-30T00:00:00.000Z',
  });
  b = must(await fundBounty(b, tx));
  b = must(
    submitWork(b, {
      schema: 'commons.submission/v1',
      id: 'sub-1',
      bountyId: b.id,
      submitter: { kind: 'wallet', id: WORKER, wallet: WORKER, handle: 'bob' },
      submittedAt: '2026-08-30T13:00:00.000Z',
      format: 'github_proof',
      proof: { url: 'https://github.com/Uuriko/dasha-desk/pull/19' },
    }),
  );
  b = must(selectWinner(b, 'sub-1', { kind: 'wallet', id: WORKER, wallet: WORKER, handle: 'bob' }));
  b = must(await payBounty(b, tx));
  return b;
}

{
  const b = await demoLoop();
  const entries = tapeFromBounties([b]);
  assert.deepEqual(
    entries.map((row) => row.kind),
    ['created', 'funded', 'submitted', 'selected', 'paid'],
  );
  assert.equal(entries[0].line, 'alice created bounty #12');
  assert.equal(entries[1].line, 'alice funded bounty #12');
  assert.equal(entries[2].line, 'bob submitted work');
  assert.equal(entries[3].line, 'bounty #12 winner selected');
  assert.equal(entries[4].line, 'bounty #12 paid 25 USDC');
  assert.ok(entries[1].tx);
  assert.ok(entries[4].tx);
  assert.equal(entries[0].origin, 'app');
  assert.equal(entries[0].chainObserved, false);
  assert.equal(entries[1].origin, 'chain');
  assert.equal(entries[1].chainObserved, true);
  assert.equal(entries[4].chainObserved, true);
  const html = B.renderTape(entries);
  assert.match(html, /alice created bounty #12/);
  assert.match(html, /bob submitted work/);
  assert.match(html, /bounty #12 paid 25 USDC/);
  assert.match(html, /data-origin="chain"/);
  assert.doesNotMatch(html, /holder status|Simp Points|plugin\.jup\.ag|decentralized|liquidity primitive/i);
}

{
  const hook = {
    id: 'wh-1',
    kind: 'funded',
    ts: '2026-08-30T12:00:00.000Z',
    bountyId: 'loop-12',
    idempotencyKey: `sig:${SIG}`,
    signature: SIG,
    origin: 'chain',
    actor: { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: 'alice' },
  };
  const bounty = { id: 'loop-12', reward: { amount: '25', symbol: 'USDC' }, creator: hook.actor };
  const first = ingestTape([], hook, bounty);
  assert.equal(first.ok, true);
  assert.equal(first.replayed, false);
  assert.equal(first.entries.length, 1);
  assert.equal(first.entries[0].kind, 'funded');
  assert.equal(first.entries[0].line, 'alice funded bounty #12');
  assert.equal(first.entries[0].chainObserved, true);
  const dup = ingestTape(first.entries, hook, bounty);
  assert.equal(dup.replayed, true);
  assert.equal(dup.entries.length, 1);
  const again = ingestTape(first.entries, { ...hook, id: 'wh-1-retry' }, bounty);
  assert.equal(again.replayed, true);
  assert.equal(again.entries.length, 1);
  assert.equal(again.entries[0].id, 'wh-1');
}

{
  const noise = [
    { id: 'n1', type: 'start_funding', ts: '2026-08-30T12:00:00.000Z', idempotencyKey: 'n1' },
    { id: 'n2', type: 'retry_settlement', ts: '2026-08-30T12:00:00.000Z', idempotencyKey: 'n2' },
    { id: 'n3', kind: 'slot', ts: '2026-08-30T12:00:00.000Z', idempotencyKey: 'n3' },
  ];
  const ignored = ingestTape([], noise, { id: 'loop-1' });
  assert.equal(ignored.entries.length, 0);
  assert.equal(eventFromWebhook(noise[0]), null);
  assert.equal(eventFromWebhook(noise[2]), null);
  assert.equal(humanKind(makeEvent({ id: 'x1', type: 'start_funding', ts: '2026-08-30T12:00:00.000Z', idempotencyKey: 'x1' })), null);
}

{
  const opened = createOpenBounty({
    id: 'loop-9',
    title: '25 USDC bounty',
    amount: '25',
    creator: { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: 'alice' },
    creatorWallet: CREATOR,
    createdAt: '2026-08-30T00:00:00.000Z',
  });
  const cancelled = must(cancelBounty(opened, 'changed mind'));
  const rows = tapeFromBounties([cancelled]);
  assert.deepEqual(
    rows.map((row) => row.kind),
    ['created', 'cancelled'],
  );
  assert.equal(rows[1].line, 'bounty #9 cancelled');
  const again = ingestTape(rows, eventsFromBounty(cancelled), cancelled);
  assert.equal(again.replayed, true);
  assert.equal(again.entries.length, 2);
}

{
  const live = JSON.parse(read('commons/fixtures/live-bounties.json'));
  assert.deepEqual(live, { ...LIVE_EMPTY_FEED, listings: [] });
  assert.equal(consumeDashaFeed(live).bounties.length, 0);
  assert.deepEqual(emitDashaFeed(consumeDashaFeed(live)), live);
  assert.equal(B.renderTape([]), '<p class="bb-empty" role="status">Nothing on the tape.</p>');
  const html = read('bounties/index.html');
  assert.match(html, /id="bb-tape"/);
  assert.match(html, /id="bb-tape-list"/);
  assert.doesNotMatch(html, /holder status|Simp Points|need no wallet|plugin\.jup\.ag/i);
  assert.doesNotMatch(html, /digest|price tape|Helius/i);
}

console.log('commons-tape: PASS');
