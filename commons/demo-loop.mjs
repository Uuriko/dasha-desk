#!/usr/bin/env node
/**
 * Cheap local walk of create → fund → submit → select → pay.
 * Uses the simulated signer. No wallet. No live listings written.
 */
import { createSimulatedTx, fakeSignature } from './tx.mjs';
import { createOpenBounty, fundBounty, submitWork, selectWinner, payBounty, visibleCopy, fundingTx, settlementTx, tapeFromBounties } from './loop.mjs';

const CREATOR = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const WORKER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const tx = createSimulatedTx({
  signatures: { funding: fakeSignature('demo-fund'), settlement: fakeSignature('demo-pay') },
});

let b = createOpenBounty({
  id: 'demo-1',
  title: '25 USDC bounty',
  amount: '25',
  creator: { kind: 'wallet', id: CREATOR, wallet: CREATOR, handle: null },
  creatorWallet: CREATOR,
});
console.log('1 create', visibleCopy(b).title, visibleCopy(b).state);

b = (await fundBounty(b, tx)).bounty;
console.log('2 fund', visibleCopy(b).title, fundingTx(b).slice(0, 8) + '…');

b = (
  await Promise.resolve(
    submitWork(b, {
      schema: 'commons.submission/v1',
      id: 'sub-1',
      bountyId: b.id,
      submitter: { kind: 'wallet', id: WORKER, wallet: WORKER, handle: 'ada' },
      submittedAt: new Date().toISOString(),
      format: 'github_proof',
      proof: { url: 'https://github.com/Uuriko/dasha-desk/pull/19' },
    }),
  )
).bounty;
console.log('3 submit work', b.submissions.length, 'proof');

b = (await Promise.resolve(selectWinner(b, 'sub-1', { kind: 'wallet', id: WORKER, wallet: WORKER, handle: 'ada' }))).bounty;
console.log('4', visibleCopy(b).title);

b = (await payBounty(b, tx)).bounty;
console.log('5', visibleCopy(b).title, settlementTx(b).slice(0, 8) + '…');
tapeFromBounties([b]).forEach((row) => console.log('tape', row.line));
console.log('done. no escrow. we don\'t hold it.');
