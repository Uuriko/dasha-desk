import assert from 'node:assert/strict';
import { lintMintManifest, loadMintManifest } from './mint-manifest-lint.mjs';

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

console.log('mint-manifest-lint.test.mjs: PASS');
