import assert from 'node:assert/strict';
import { inspectObservationReceipt, lintMintManifest, loadMintManifest } from './mint-manifest-lint.mjs';

const real = await loadMintManifest();
const errors = (input) => lintMintManifest(input).filter((item) => item.level === 'error').map((item) => item.code);
assert.deepEqual(errors(real), [], 'real Dasha manifest must have no errors');

function mutated(change) {
  const copy = structuredClone(real);
  change(copy);
  return errors(copy);
}

assert.ok(mutated((x) => (x.evidence.mint = '11111111111111111111111111111111')).includes('mint.evidence-drift'));
assert.ok(mutated((x) => (x.config.links.solscan = `https://solscan.io.evil.test/token/${x.config.mint}`)).includes('url.host'));
assert.ok(mutated((x) => (x.config.links.jupiter = x.config.links.jupiter.replace('https:', 'http:'))).includes('url.https'));
assert.ok(mutated((x) => (x.evidence.cluster = 'devnet')).includes('evidence.cluster'));
assert.ok(mutated((x) => (x.evidence.account.accountDataSha256 = '0'.repeat(64))).includes('evidence.hash'));
assert.ok(mutated((x) => (x.evidence.claims.find((c) => c.kind === 'association').source = 'https://x.com/example/status/1')).includes('association.source'));
assert.ok(mutated((x) => (x.evidence.account.mintAuthority = '11111111111111111111111111111111')).includes('evidence.layout-mint-authority'));
assert.ok(mutated((x) => delete x.config.quotes[0].url).includes('url.parse'));
assert.ok(mutated((x) => (x.config.quotes[0].url = 'https://x.com/other/status/2085405075686801789')).includes('quote.source-url'));
assert.ok(mutated((x) => delete x.config.quotes.find((quote) => quote.source === '@PerryALPHA').thirdParty).includes('quote.third-party'));
assert.ok(mutated((x) => (x.body += '<button data-share-quote="Unproven line">Copy</button>')).includes('quote.unconfigured'));
assert.ok(mutated((x) => (x.body = x.body.replace(x.config.quotes[0].url, 'https://x.com/other/status/1'))).includes('quote.source-link'));

const receipt = {
  schema: 'dasha.observation-receipt/1', mintEvidence: real.evidence, marketObservation: null,
  limitations: [
    'The RPC snapshot is not a cryptographic inclusion proof or token assessment.',
    'Market values are provider-reported observations, not independent corroboration.',
    'Association evidence is not an endorsement.',
  ],
};
const inspect = (value) => inspectObservationReceipt(JSON.stringify(value), real.config);
assert.deepEqual(inspect(receipt), { ok: true, sha256: inspect(receipt).sha256, findings: [], provenance: 'unverified', safety: 'not assessed' });
assert.ok(inspect({ ...receipt, schema: 'wrong' }).findings.includes('receipt.schema'));
assert.ok(inspect({ ...receipt, limitations: [] }).findings.includes('receipt.limitations'));
const badHash = structuredClone(receipt);
badHash.mintEvidence.account.accountDataSha256 = '0'.repeat(64);
assert.ok(inspect(badHash).findings.includes('evidence.hash'));
const badSupply = structuredClone(receipt);
badSupply.mintEvidence.account.supply = '1';
assert.ok(inspect(badSupply).findings.includes('evidence.supply'));
const market = { provider: 'Dexscreener', fetchedAt: '2026-08-07T06:00:00.000Z', pairUrl: real.config.links.dex,
  pairAddress: real.config.links.dex.split('/').pop().toUpperCase(), mint: real.config.mint, priceUsd: '0.001',
  marketCap: null, liquidityUsd: 1, volume24h: 2, change: { m5: null, h1: 1, h6: 2, h24: 3 } };
assert.equal(inspect({ ...receipt, marketObservation: market }).ok, true);
assert.ok(inspect({ ...receipt, marketObservation: { ...market, mint: 'wrong', pairUrl: 'https://evil.test/' } }).findings.includes('market.mint'));
assert.ok(inspect({ ...receipt, marketObservation: { ...market, priceUsd: '<script>' } }).findings.includes('market.price'));
assert.ok(inspect({ ...receipt, marketObservation: { ...market, fetchedAt: 'tomorrow' } }).findings.includes('market.time'));

console.log('mint-manifest-lint.test.mjs: PASS');
