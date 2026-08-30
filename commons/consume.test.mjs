#!/usr/bin/env node
/**
 * Another Solana project can import schema + machine + loop + tape
 * without adapter.mjs. This file is that import graph.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBounty, apply } from './machine.mjs';
import { createOpenBounty, fundBounty, submitWork, selectWinner, payBounty } from './loop.mjs';
import { createSimulatedTx } from './tx.mjs';
import { tapeFromBounties } from './tape.mjs';
import { validateBounty, USDC_MINT } from './schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), 'utf8');

const example = JSON.parse(read('fixtures/example-community-bounty.json'));
assert.equal(validateBounty(example).ok, true);
assert.equal(example.source.community, 'example-community');
assert.equal(example.source.ref, 'https://example.com/bounties/7');
assert.doesNotMatch(JSON.stringify(example), /dasha/i);
assert.doesNotMatch(JSON.stringify(example), /getdasha|\$DASHA/i);
assert.equal(example.reward.mint, USDC_MINT);

{
  const canonical = [read('schema.mjs'), read('machine.mjs'), read('loop.mjs'), read('tape.mjs'), read('tx.mjs')].join('\n');
  assert.doesNotMatch(canonical, /\$DASHA|getdasha|dasha-bounties-feed/i);
}

{
  const consume = read('../docs/commons/CONSUME.md');
  assert.match(consume, /commons\/schema\.mjs/);
  assert.match(consume, /commons\/machine\.mjs/);
  assert.match(consume, /commons\/loop\.mjs/);
  assert.match(consume, /commons\/tape\.mjs/);
  assert.match(consume, /adapter\.mjs is optional|Skip that file/i);
  assert.doesNotMatch(consume, /plugin\.jup\.ag/);
}

const tx = createSimulatedTx();
let bounty = createOpenBounty({
  id: 'example-7',
  title: '25 USDC bounty',
  amount: '25',
  creator: example.creator,
  creatorWallet: example.creatorWallet,
  source: example.source,
});
assert.equal(bounty.source.community, 'example-community');
assert.doesNotMatch(JSON.stringify(bounty), /dasha/i);

const funded = await fundBounty(bounty, tx);
assert.equal(funded.ok, true, funded.detail || funded.error);
bounty = funded.bounty;
const submitted = submitWork(bounty, {
  schema: 'commons.submission/v1',
  id: 'sub-1',
  bountyId: bounty.id,
  submitter: { kind: 'github', id: 'bob', handle: 'bob', wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
  submittedAt: '2026-08-30T13:00:00.000Z',
  format: 'url',
  proof: { url: 'https://example.com/work' },
});
assert.equal(submitted.ok, true, submitted.detail || submitted.error);
bounty = submitted.bounty;
const selected = selectWinner(bounty, 'sub-1', {
  kind: 'github',
  id: 'bob',
  handle: 'bob',
  wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
});
assert.equal(selected.ok, true, selected.detail || selected.error);
bounty = selected.bounty;
const paid = await payBounty(bounty, tx);
assert.equal(paid.ok, true, paid.detail || paid.error);
bounty = paid.bounty;
assert.equal(bounty.state, 'paid');

const lines = tapeFromBounties([bounty]).map((row) => row.line);
assert.deepEqual(lines, [
  'ada created bounty #7',
  'ada funded bounty #7',
  'bob submitted work',
  'bounty #7 winner selected',
  'bounty #7 paid 25 USDC',
]);
assert.doesNotMatch(lines.join('\n'), /dasha/i);

{
  const draft = createBounty({
    id: 'example-8',
    title: '25 USDC bounty',
    creator: example.creator,
    creatorWallet: example.creatorWallet,
    reward: example.reward,
    createdAt: '2026-08-30T00:00:00.000Z',
    source: { kind: 'app', community: 'example-community', ref: null },
  });
  const opened = apply(draft, {
    schema: 'commons.event/v1',
    id: 'pub-8',
    type: 'publish',
    ts: '2026-08-30T00:00:01.000Z',
    bountyId: 'example-8',
    origin: 'app',
    idempotencyKey: 'publish:example-8',
    tx: null,
    source: { kind: 'app', community: 'example-community', ref: null },
    raw: null,
    payload: null,
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.bounty.state, 'open');
  assert.equal(opened.bounty.source.community, 'example-community');
}

console.log('commons-consume: PASS');
