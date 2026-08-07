import assert from 'node:assert/strict';
import { checkMintEvidence } from './mint-evidence-refresh.mjs';
import { loadMintManifest } from './mint-manifest-lint.mjs';

const { config, evidence } = await loadMintManifest();
const base = Buffer.from(evidence.account.accountDataBase64, 'base64');
const response = (changes = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    jsonrpc: '2.0',
    id: 1,
    result: {
      context: { slot: evidence.slot + 100 },
      value: {
        data: [base.toString('base64'), 'base64'],
        executable: false,
        owner: evidence.account.ownerProgram,
        space: 82,
        ...changes,
      },
    },
  }),
});
const run = (reply = response(), extra = {}) => checkMintEvidence({
  config,
  evidence,
  fetchImpl: async (_url, options) => {
    extra.inspect?.(JSON.parse(options.body));
    return reply;
  },
});
const rejects = async (reply, code, extra) => assert.rejects(() => run(reply, extra), (error) => error.code === code);

const unchanged = await run(response(), {
  inspect: (request) => {
    assert.equal(request.method, 'getAccountInfo');
    assert.equal(request.params[0], config.mint);
    assert.deepEqual(request.params[1], { commitment: 'finalized', encoding: 'base64', minContextSlot: evidence.slot });
  },
});
assert.equal(unchanged.status, 'UNCHANGED');
assert.deepEqual(unchanged.differences, []);

const supply = Buffer.from(base);
supply[36] ^= 1;
const supplyDrift = await run(response({ data: [supply.toString('base64'), 'base64'] }));
assert.equal(supplyDrift.status, 'DRIFT');
assert.deepEqual(supplyDrift.differences.map((item) => item.field), ['accountDataSha256', 'supply']);

const authority = Buffer.from(base);
authority.writeUInt32LE(1, 0);
authority.fill(0, 4, 36);
const authorityDrift = await run(response({ data: [authority.toString('base64'), 'base64'] }));
assert.deepEqual(authorityDrift.differences.map((item) => item.field), ['accountDataSha256', 'mintAuthority']);
assert.equal(authorityDrift.differences[1].observed, '1'.repeat(32));

await rejects(response({ owner: '11111111111111111111111111111111' }), 'account.owner');
await rejects(response({ executable: true }), 'account.executable');
await rejects(response({ data: ['*', 'base64'] }), 'account.base64');
await rejects(response({ data: [base.subarray(1).toString('base64'), 'base64'], space: 81 }), 'account.space');
const invalidLayout = Buffer.from(base);
invalidLayout.writeUInt32LE(2, 0);
await rejects(response({ data: [invalidLayout.toString('base64'), 'base64'] }), 'account.layout');
await rejects({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: { context: { slot: evidence.slot + 1 }, value: null } }) }, 'account.missing');
await rejects({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, error: { code: -1 } }) }, 'rpc.error');
await assert.rejects(
  () => checkMintEvidence({ config, evidence, fetchImpl: async () => { throw new Error('secret endpoint failure'); } }),
  (error) => error.code === 'rpc.fetch' && !error.message.includes('secret'),
);
await assert.rejects(
  () => checkMintEvidence({ config, evidence, endpoint: 'https://user:secret@example.test', fetchImpl: async () => response() }),
  (error) => error.code === 'rpc.url' && !error.message.includes('secret'),
);

console.log('mint-evidence-refresh.test.mjs: PASS');
