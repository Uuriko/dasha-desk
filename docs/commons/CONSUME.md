# Consume Commons

One folder: `commons/`. Copy or vendor it. Not five packages. Not an npm workspace.

getdasha is a profile in `adapter.mjs`. Skip that file unless you speak `dasha-bounties-feed/v1`.

## Files

| Need | File |
| --- | --- |
| records | `commons/schema.mjs` |
| transitions | `commons/machine.mjs` |
| create → fund → submit → select → pay | `commons/loop.mjs` |
| human tape | `commons/tape.mjs` |
| signer port | `commons/tx.mjs` |

`adapter.mjs` is optional. `index.mjs` re-exports everything, including the getdasha adapter — import the leaf files if you want a clean graph.

This repo has no `exports` map. Import the `.mjs` paths.

## Copy-paste

```js
import { readFileSync } from 'node:fs';
import { createOpenBounty, fundBounty, submitWork, selectWinner, payBounty } from './commons/loop.mjs';
import { createSimulatedTx } from './commons/tx.mjs';
import { tapeFromBounties } from './commons/tape.mjs';
import { validateBounty } from './commons/schema.mjs';

const example = JSON.parse(readFileSync('./commons/fixtures/example-community-bounty.json', 'utf8'));
validateBounty(example); // { ok: true }
// example.source.community === 'example-community'
// JSON has no getdasha strings. Adapter was not imported.

const tx = createSimulatedTx();
let bounty = createOpenBounty({
  id: 'example-7',
  title: '25 USDC bounty',
  amount: '25',
  creator: example.creator,
  creatorWallet: example.creatorWallet,
  source: example.source,
});
bounty = (await fundBounty(bounty, tx)).bounty;
bounty = submitWork(bounty, {
  schema: 'commons.submission/v1',
  id: 'sub-1',
  bountyId: bounty.id,
  submitter: { kind: 'github', id: 'bob', handle: 'bob', wallet: null },
  submittedAt: new Date().toISOString(),
  format: 'url',
  proof: { url: 'https://example.com/work' },
}).bounty;
bounty = selectWinner(bounty, 'sub-1', { kind: 'github', id: 'bob', handle: 'bob', wallet: null }).bounty;
bounty = (await payBounty(bounty, tx)).bounty;

tapeFromBounties([bounty]).map((row) => row.line);
// ada created bounty #7
// ada funded bounty #7
// bob submitted work
// bounty #7 winner selected
// bounty #7 paid 25 USDC
```

`createSimulatedTx` is for tests. In production, pass a wallet that signs only after the user clicks Fund or Pay. Commons never holds keys.

## Trust

Creator funds. Workers submit. Creator selects. Winner is paid. No escrow unless you add it and document who holds the key.

## What you do not get from this folder

A Worker. A Helius SDK. A faucet. getdasha.com. Pocket is [Uuriko/dasha-pocket](https://github.com/Uuriko/dasha-pocket) — it vendors these leaf files.

A community that is not getdasha: [EXTERNAL.md](EXTERNAL.md) + `commons/fixtures/external-community-feed.json`.
