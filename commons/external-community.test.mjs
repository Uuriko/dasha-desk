#!/usr/bin/env node
/**
 * A community that is not $DASHA / getdasha can run one Commons bounty
 * from leaf imports only. Skip the getdasha adapter.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenBounty, fundBounty, submitWork, selectWinner, payBounty } from './loop.mjs';
import { createSimulatedTx, fakeSignature } from './tx.mjs';
import { tapeFromBounties } from './tape.mjs';
import { FEED_SCHEMA, USDC_MINT, validateBounty } from './schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), 'utf8');

assert.doesNotMatch(read('external-community.test.mjs'), /from ['"]\.\/adapter\.mjs['"]/);

const feed = JSON.parse(read('fixtures/external-community-feed.json'));
const feedJson = JSON.stringify(feed);
assert.equal(feed.schema, FEED_SCHEMA);
assert.equal(feed.community, 'harbor');
assert.equal(feed.bounties.length, 1);
assert.doesNotMatch(feedJson, /dasha|\$DASHA|getdasha|plugin\.jup\.ag|Simp Points/i);
assert.match(feed.note, /We don't hold it/);

const row = feed.bounties[0];
assert.equal(validateBounty(row).ok, true, JSON.stringify(validateBounty(row).errors));
assert.equal(row.source.community, 'harbor');
assert.equal(row.reward.mint, USDC_MINT);
assert.equal(row.reward.amount, '25');
assert.equal(row.funding.state, 'unfunded');
assert.equal(row.state, 'open');

{
  const empty = { ...feed, bounties: [] };
  assert.equal(empty.schema, FEED_SCHEMA);
  assert.deepEqual(empty.bounties, []);
}

{
  const live = JSON.parse(read('fixtures/live-bounties.json'));
  assert.equal(live.schema, 'dasha-bounties-feed/v1');
  assert.deepEqual(live.listings, []);
}

const WORKER = '2QmN8pL5sR9vT4wY1cB7nH3jF6dA0eG8uX2iZ5kP9';
const fundSig = fakeSignature('harbor-fund');
const paySig = fakeSignature('harbor-pay');

function work(bountyId = 'harbor-1') {
  return {
    schema: 'commons.submission/v1',
    id: 'harbor-sub-1',
    bountyId,
    submitter: { kind: 'github', id: 'koi', handle: 'koi', wallet: WORKER },
    submittedAt: '2026-08-30T14:00:00.000Z',
    format: 'url',
    proof: { url: 'https://harbor.example/work/1' },
  };
}

{
  const tx = createSimulatedTx({ signatures: { funding: fundSig, settlement: paySig } });
  let bounty = createOpenBounty({
    id: row.id,
    title: row.title,
    amount: row.reward.amount,
    creator: row.creator,
    creatorWallet: row.creatorWallet,
    source: row.source,
    createdAt: row.createdAt,
    deadline: row.deadline,
  });
  assert.equal(bounty.source.community, 'harbor');
  assert.doesNotMatch(JSON.stringify(bounty), /dasha|\$DASHA|getdasha/i);

  const funded = await fundBounty(bounty, tx);
  assert.equal(funded.ok, true, funded.detail || funded.error);
  bounty = funded.bounty;
  assert.equal(bounty.funding.state, 'funded');

  const submitted = submitWork(bounty, work());
  assert.equal(submitted.ok, true, submitted.detail || submitted.error);
  bounty = submitted.bounty;

  const selected = selectWinner(bounty, 'harbor-sub-1', {
    kind: 'github',
    id: 'koi',
    handle: 'koi',
    wallet: WORKER,
  });
  assert.equal(selected.ok, true, selected.detail || selected.error);
  bounty = selected.bounty;

  const paid = await payBounty(bounty, tx);
  assert.equal(paid.ok, true, paid.detail || paid.error);
  bounty = paid.bounty;
  assert.equal(bounty.state, 'paid');
  assert.equal(bounty.source.community, 'harbor');
  assert.doesNotMatch(JSON.stringify(bounty), /dasha|\$DASHA|getdasha/i);

  const tape = tapeFromBounties([bounty]);
  assert.deepEqual(tape.map((row) => row.kind), ['created', 'funded', 'submitted', 'selected', 'paid']);
  assert.deepEqual(tape.map((row) => row.line), [
    'mina created bounty #1',
    'mina funded bounty #1',
    'koi submitted work',
    'bounty #1 winner selected',
    'bounty #1 paid 25 USDC',
  ]);
  assert.doesNotMatch(tape.map((row) => row.line).join('\n'), /dasha/i);
}

{
  const tx = createSimulatedTx({ signature: fundSig });
  let bounty = createOpenBounty({
    id: 'harbor-dup',
    title: row.title,
    amount: '25',
    creator: row.creator,
    creatorWallet: row.creatorWallet,
    source: row.source,
  });
  bounty = (await fundBounty(bounty, tx)).bounty;
  const again = await fundBounty(bounty, tx);
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  const other = await fundBounty(bounty, createSimulatedTx({ signature: fakeSignature('harbor-other') }));
  assert.equal(other.ok, false);
  assert.equal(other.error, 'duplicate_funding');
}

{
  const tx = createSimulatedTx({ signatures: { funding: fakeSignature('harbor-f2'), settlement: paySig } });
  let bounty = createOpenBounty({
    id: 'harbor-pay',
    title: row.title,
    amount: '25',
    creator: row.creator,
    creatorWallet: row.creatorWallet,
    source: row.source,
  });
  bounty = (await fundBounty(bounty, tx)).bounty;
  bounty = submitWork(bounty, work('harbor-pay')).bounty;
  bounty = selectWinner(bounty, 'harbor-sub-1', {
    kind: 'github',
    id: 'koi',
    handle: 'koi',
    wallet: WORKER,
  }).bounty;
  bounty = (await payBounty(bounty, tx)).bounty;
  const again = await payBounty(bounty, tx);
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  const other = await payBounty(bounty, createSimulatedTx({ signature: fakeSignature('harbor-pay-other') }));
  assert.equal(other.ok, false);
  assert.equal(other.error, 'double_settlement');
}

{
  const external = read('../docs/commons/EXTERNAL.md');
  assert.match(external, /CONSUME\.md/);
  assert.match(external, /commons\.bounty-feed\/v1/);
  assert.match(external, /harbor|external-community-feed/);
  assert.match(external, /No Worker|no Worker/i);
  assert.doesNotMatch(external, /plugin\.jup\.ag/);
  assert.doesNotMatch(external, /wrangler deploy|a live Harbor|live external community exists/i);
}

console.log('commons-external-community: PASS');
