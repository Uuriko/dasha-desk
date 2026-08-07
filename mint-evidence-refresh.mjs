#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeMintAccount, loadMintManifest } from './mint-manifest-lint.mjs';

const DEFAULT_RPC = 'https://api.mainnet.solana.com';

export class EvidenceCheckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new EvidenceCheckError(code, message);
}

function rpcUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('rpc.url', 'RPC URL is invalid');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')))
    fail('rpc.url', 'RPC URL must be credential-free HTTPS or loopback HTTP');
  return url.href;
}

export async function checkMintEvidence({ config, evidence, endpoint = DEFAULT_RPC, fetchImpl = fetch, timeoutMs = 10000 }) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getAccountInfo',
    params: [
      config.mint,
      { commitment: 'finalized', encoding: 'base64', minContextSlot: evidence.slot },
    ],
  };
  const url = rpcUrl(endpoint);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    fail('rpc.fetch', 'RPC request failed');
  }
  if (!response?.ok) fail('rpc.http', `RPC returned HTTP ${response?.status || 0}`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail('rpc.json', 'RPC response was not JSON');
  }
  if (payload?.error) fail('rpc.error', 'RPC returned a JSON-RPC error');
  if (payload?.jsonrpc !== '2.0' || payload?.id !== 1 || !payload.result) fail('rpc.shape', 'RPC response shape is invalid');

  const slot = payload.result.context?.slot;
  const value = payload.result.value;
  if (!Number.isSafeInteger(slot) || slot < evidence.slot) fail('rpc.slot', 'RPC context slot is missing or stale');
  if (!value) fail('account.missing', 'mint account was not found');
  if (value.owner !== evidence.account.ownerProgram || value.owner !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    fail('account.owner', 'account is not owned by the expected legacy SPL Token Program');
  if (value.executable !== false) fail('account.executable', 'mint account must not be executable');
  if (value.space !== 82) fail('account.space', 'only the 82-byte legacy SPL Mint layout is supported');
  if (!Array.isArray(value.data) || value.data.length !== 2 || value.data[1] !== 'base64')
    fail('account.encoding', 'account data must be a base64 tuple');

  const encoded = value.data[0];
  const bytes = Buffer.from(typeof encoded === 'string' ? encoded : '', 'base64');
  if (bytes.length !== 82 || bytes.toString('base64') !== encoded) fail('account.base64', 'account data is not canonical 82-byte base64');
  let decoded;
  try {
    decoded = decodeMintAccount(bytes);
  } catch {
    fail('account.layout', 'account data is not a valid legacy SPL Mint layout');
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  const observed = { ...decoded, accountDataSha256: digest };
  const expected = evidence.account;
  const differences = ['accountDataSha256', 'supply', 'decimals', 'initialized', 'mintAuthority', 'freezeAuthority']
    .filter((field) => observed[field] !== expected[field])
    .map((field) => ({ field, expected: expected[field], observed: observed[field] }));
  return { status: differences.length ? 'DRIFT' : 'UNCHANGED', mint: config.mint, observedSlot: slot, accountDataSha256: digest, differences, request: body };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) {
    console.error('Usage: node mint-evidence-refresh.mjs --check');
    process.exitCode = 2;
  } else {
    try {
      const { config, evidence } = await loadMintManifest();
      const result = await checkMintEvidence({ config, evidence, endpoint: process.env.DASHA_SOLANA_RPC_URL || DEFAULT_RPC });
      console.log(`${result.status} mint=${result.mint} slot=${result.observedSlot} sha256=${result.accountDataSha256}`);
      for (const item of result.differences)
        console.log(`DRIFT ${item.field} expected=${JSON.stringify(item.expected)} observed=${JSON.stringify(item.observed)}`);
      process.exitCode = result.status === 'UNCHANGED' ? 0 : 1;
    } catch (error) {
      console.error(`ERROR ${error.code || 'unexpected'}: ${error instanceof EvidenceCheckError ? error.message : 'unexpected failure'}`);
      process.exitCode = 2;
    }
  }
}
