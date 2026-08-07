#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_PROGRAMS = new Set([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]);

export function decodeMintAccount(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 82) throw new Error('mint account must be exactly 82 bytes');
  const authority = (offset) => {
    const option = bytes.readUInt32LE(offset);
    if (option === 0) return null;
    if (option !== 1) throw new Error('invalid authority option');
    const key = bytes.subarray(offset + 4, offset + 36);
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let value = BigInt(`0x${key.toString('hex')}`);
    let encoded = '';
    while (value) {
      encoded = alphabet[Number(value % 58n)] + encoded;
      value /= 58n;
    }
    for (const byte of key) {
      if (byte) break;
      encoded = '1' + encoded;
    }
    return encoded;
  };
  if (bytes[45] > 1) throw new Error('invalid initialized byte');
  return {
    mintAuthority: authority(0),
    supply: bytes.readBigUInt64LE(36).toString(),
    decimals: bytes[44],
    initialized: Boolean(bytes[45]),
    freezeAuthority: authority(46),
  };
}

export function inspectObservationReceipt(raw, config) {
  const findings = [];
  const add = (condition, code) => { if (!condition) findings.push(code); };
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 1_000_000)
    return { ok: false, findings: ['receipt.size'], provenance: 'unverified', safety: 'not assessed' };
  let receipt;
  try { receipt = JSON.parse(raw); } catch { return { ok: false, findings: ['receipt.json'], provenance: 'unverified', safety: 'not assessed' }; }
  const evidence = receipt?.mintEvidence;
  const account = evidence?.account || {};
  add(receipt?.schema === 'dasha.observation-receipt/1', 'receipt.schema');
  add(evidence?.schema === 'dasha.mint-evidence/1', 'evidence.schema');
  add(evidence?.mint === config.mint, 'evidence.mint');
  add(evidence?.cluster === 'mainnet-beta' && evidence?.commitment === 'finalized', 'evidence.context');
  add(Number.isSafeInteger(evidence?.slot) && evidence.slot > 0, 'evidence.slot');
  add(['capturedAt', 'slotBlockTime'].every((key) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(evidence?.[key] || '') && !Number.isNaN(Date.parse(evidence[key]))), 'evidence.time');
  const bytes = Buffer.from(typeof account.accountDataBase64 === 'string' ? account.accountDataBase64 : '', 'base64');
  add(bytes.length === 82 && bytes.toString('base64') === account.accountDataBase64, 'evidence.bytes');
  add(createHash('sha256').update(bytes).digest('hex') === account.accountDataSha256, 'evidence.hash');
  if (bytes.length === 82) try {
    const decoded = decodeMintAccount(bytes);
    for (const field of ['supply', 'decimals', 'initialized', 'mintAuthority', 'freezeAuthority'])
      add(decoded[field] === account[field], `evidence.${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  } catch { findings.push('evidence.layout'); }
  const market = receipt?.marketObservation;
  add(market === null || typeof market === 'object', 'market.shape');
  if (market && typeof market === 'object') {
    const expectedPair = new URL(config.links.dex).pathname.split('/').pop();
    const optionalNumber = (value, nonnegative = false) => value == null || (typeof value === 'number' && Number.isFinite(value) && (!nonnegative || value >= 0));
    add(market.provider === 'Dexscreener', 'market.provider');
    add(market.mint === config.mint, 'market.mint');
    add(market.pairUrl === config.links.dex, 'market.url');
    add(String(market.pairAddress || '').toLowerCase() === expectedPair.toLowerCase(), 'market.pair');
    add(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(market.fetchedAt || '') && !Number.isNaN(Date.parse(market.fetchedAt)), 'market.time');
    add(typeof market.priceUsd === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(market.priceUsd) && Number(market.priceUsd) > 0, 'market.price');
    add(['marketCap', 'liquidityUsd', 'volume24h'].every((key) => optionalNumber(market[key], true)), 'market.number');
    add(market.change && ['m5', 'h1', 'h6', 'h24'].every((key) => optionalNumber(market.change[key]) && (market.change[key] == null || market.change[key] >= -100)), 'market.change');
  }
  const requiredLimits = [
    'The RPC snapshot is not a cryptographic inclusion proof or token assessment.',
    'Market values are provider-reported observations, not independent corroboration.',
    'Association evidence is not an endorsement.',
  ];
  add(requiredLimits.every((line) => receipt?.limitations?.includes(line)), 'receipt.limitations');
  return { ok: findings.length === 0, sha256: createHash('sha256').update(raw).digest('hex'),
    findings: [...new Set(findings)].sort(), provenance: 'unverified', safety: 'not assessed' };
}

export function lintMintManifest({ config, evidence, body, app }) {
  const findings = [];
  const add = (level, code, path, message) => findings.push({ level, code, path, message });
  const error = (condition, code, path, message) => {
    if (!condition) add('error', code, path, message);
  };
  const mint = config?.mint;

  error(MINT_RE.test(mint || ''), 'mint.shape', 'config.mint', 'must be a base58-shaped address');
  const appMint = app.match(/var CA = '([^']+)'/)?.[1];
  error(appMint === mint, 'mint.app-drift', 'src/app.js', 'CA must equal config.mint');
  error(evidence?.mint === mint, 'mint.evidence-drift', 'evidence.mint', 'must equal config.mint');

  const linkRules = {
    jupiter: ['jup.ag', `/swap/SOL-${mint}`],
    solscan: ['solscan.io', `/token/${mint}`],
    birdeye: ['birdeye.so', `/token/${mint}`],
    rugcheck: ['rugcheck.xyz', `/tokens/${mint}`],
    phantom: ['phantom.com', `/tokens/solana/${mint}`],
  };
  for (const [key, [host, path]] of Object.entries(linkRules)) {
    checkUrl(config?.links?.[key], `config.links.${key}`, host, path, error);
  }
  const dex = checkUrl(config?.links?.dex, 'config.links.dex', 'dexscreener.com', null, error);
  error(/^\/solana\/[A-Za-z0-9]+$/.test(dex?.pathname || ''), 'url.path', 'config.links.dex', 'must use /solana/<pair>');
  const caPost = checkUrl(config?.links?.caPost, 'config.links.caPost', 'x.com', null, error);
  error(/^\/dash_eats\/status\/\d+$/.test(caPost?.pathname || ''), 'association.url', 'config.links.caPost', 'must be a numeric @dash_eats status URL');

  error(evidence?.schema === 'dasha.mint-evidence/1', 'evidence.schema', 'evidence.schema', 'unsupported schema');
  error(evidence?.cluster === 'mainnet-beta', 'evidence.cluster', 'evidence.cluster', 'must be mainnet-beta');
  error(evidence?.commitment === 'finalized', 'evidence.commitment', 'evidence.commitment', 'must be finalized');
  error(Number.isSafeInteger(evidence?.slot) && evidence.slot > 0, 'evidence.slot', 'evidence.slot', 'must be a positive safe integer');
  for (const key of ['capturedAt', 'slotBlockTime']) {
    error(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(evidence?.[key] || '') && !Number.isNaN(Date.parse(evidence[key])), 'evidence.time', `evidence.${key}`, 'must be UTC ISO-8601');
  }

  const account = evidence?.account || {};
  error(account.type === 'mint', 'evidence.account-type', 'evidence.account.type', 'must be mint');
  error(TOKEN_PROGRAMS.has(account.ownerProgram), 'evidence.owner', 'evidence.account.ownerProgram', 'must be an SPL Token program');
  error(typeof account.initialized === 'boolean', 'evidence.initialized', 'evidence.account.initialized', 'must be boolean');
  error(Number.isInteger(account.decimals) && account.decimals >= 0 && account.decimals <= 18, 'evidence.decimals', 'evidence.account.decimals', 'must be an integer from 0 to 18');
  error(/^\d+$/.test(account.supply || ''), 'evidence.supply', 'evidence.account.supply', 'must be an integer string');
  for (const key of ['mintAuthority', 'freezeAuthority']) {
    error(account[key] === null || MINT_RE.test(account[key] || ''), 'evidence.authority', `evidence.account.${key}`, 'must be null or a base58 address');
  }

  let bytes = Buffer.alloc(0);
  try {
    bytes = Buffer.from(account.accountDataBase64 || '', 'base64');
  } catch {}
  error(account.accountDataEncoding === 'base64' && bytes.length === 82, 'evidence.bytes', 'evidence.account.accountDataBase64', 'must contain the 82-byte Mint account');
  const digest = createHash('sha256').update(bytes).digest('hex');
  error(digest === account.accountDataSha256, 'evidence.hash', 'evidence.account.accountDataSha256', 'must hash the embedded account bytes');
  if (bytes.length === 82) {
    try {
      const decoded = decodeMintAccount(bytes);
      for (const key of ['supply', 'decimals', 'initialized', 'mintAuthority', 'freezeAuthority'])
        error(decoded[key] === account[key], `evidence.layout-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, `evidence.account.${key}`, 'must match raw Mint bytes');
    } catch {
      error(false, 'evidence.layout', 'evidence.account.accountDataBase64', 'must be a valid SPL Mint layout');
    }
  }

  const association = evidence?.claims?.find((claim) => claim.kind === 'association');
  error(association?.source === config?.links?.caPost, 'association.source', 'evidence.claims', 'must equal config.links.caPost');
  error(/can go to zero/i.test(body), 'copy.loss-risk', 'src/body.html', 'must disclose loss risk');
  error(/association[^<\n]*(?:≠|not)[^<\n]*endorsement/i.test(body), 'copy.endorsement', 'src/body.html', 'must distinguish association from endorsement');
  error(body.includes('999,831,950.053985'), 'render.supply', 'src/body.html', 'visible supply must match evidence');
  error(body.includes('437,730,576'), 'render.slot', 'src/body.html', 'visible slot must match evidence');
  error(account.mintAuthority !== null || /Mint authority<\/dt><dd[^>]*>None/.test(body), 'render.mint-authority', 'src/body.html', 'None label requires null authority');
  error(account.freezeAuthority !== null || /Freeze authority<\/dt><dd[^>]*>None/.test(body), 'render.freeze-authority', 'src/body.html', 'None label requires null authority');
  error(app.includes("safeProviderUrl(pair.url, 'dexscreener.com')"), 'runtime.chart-host', 'src/app.js', 'chart URL must use exact-host validation');

  const quotes = config?.quotes || [];
  const renderedQuotes = [...body.matchAll(/data-share-quote="([^"]+)"/g)].map((match) => match[1]);
  error(new Set(quotes.map((quote) => quote.text)).size === quotes.length, 'quote.duplicate', 'config.quotes', 'quote text must be unique');
  for (const [i, quote] of quotes.entries()) {
    const path = `config.quotes[${i}]`;
    const source = /^@[A-Za-z0-9_]+$/.test(quote.source || '') ? quote.source.slice(1) : '';
    error(Boolean(source), 'quote.source', `${path}.source`, 'must be an @handle');
    const url = checkUrl(quote.url, `${path}.url`, 'x.com', null, error);
    const status = url?.pathname.match(/^\/([^/]+)\/status\/(\d+)$/);
    error(status?.[1] === source, 'quote.source-url', `${path}.url`, 'must be an exact status URL for the source handle');
    error(!url?.search && !url?.hash, 'quote.source-url', `${path}.url`, 'must not include tracking or fragments');
    error(quote.source === '@dash_eats' || quote.thirdParty === true, 'quote.third-party', path, 'non-@dash_eats quotes must be labeled third-party');
    error(renderedQuotes.filter((text) => text === quote.text).length === 1, 'quote.render', path, 'must render exactly once');
    error(body.split(`href="${quote.url}"`).length === 2, 'quote.source-link', path, 'source URL must render exactly once');
  }
  error(renderedQuotes.every((text) => quotes.some((quote) => quote.text === text)), 'quote.unconfigured', 'src/body.html', 'rendered quotes must exist in config');
  return findings.sort((a, b) => `${a.level}:${a.code}:${a.path}`.localeCompare(`${b.level}:${b.code}:${b.path}`));
}

function checkUrl(raw, path, host, expectedPath, error) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    error(false, 'url.parse', path, 'must be an absolute URL');
    return null;
  }
  error(url.protocol === 'https:', 'url.https', path, 'must use HTTPS');
  error(!url.username && !url.password, 'url.credentials', path, 'must not contain credentials');
  error(!url.port, 'url.port', path, 'must not use a non-default port');
  error(url.hostname === host, 'url.host', path, `must use exact host ${host}`);
  if (expectedPath) error(url.pathname === expectedPath, 'url.path', path, `must use ${expectedPath}`);
  return url;
}

export async function loadMintManifest(root = new URL('./', import.meta.url)) {
  const [configText, body, app] = await Promise.all([
    readFile(new URL('config/dasha.json', root), 'utf8'),
    readFile(new URL('src/body.html', root), 'utf8'),
    readFile(new URL('src/app.js', root), 'utf8'),
  ]);
  const evidenceText = body.match(/<script type="application\/json" id="dd-evidence-json">([^<]+)<\/script>/)?.[1];
  if (!evidenceText) throw new Error('src/body.html: missing #dd-evidence-json');
  return { config: JSON.parse(configText), evidence: JSON.parse(evidenceText), body, app };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === '--receipt') {
  const path = process.argv[3];
  if (!path || process.argv.length !== 4) {
    console.error('Usage: node mint-manifest-lint.mjs --receipt FILE');
    process.exitCode = 2;
  } else try {
    if ((await stat(path)).size > 1_000_000) throw new Error('receipt.size');
    const [raw, configText] = await Promise.all([readFile(path, 'utf8'), readFile(new URL('config/dasha.json', import.meta.url), 'utf8')]);
    const result = inspectObservationReceipt(raw, JSON.parse(configText));
    console.log(`${result.ok ? 'INTERNALLY CONSISTENT' : 'INVALID'} · provenance ${result.provenance} · safety ${result.safety} · sha256=${result.sha256 || 'unavailable'}`);
    for (const code of result.findings) console.log(`FAIL ${code}`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`INVALID · provenance unverified · safety not assessed · ${error.message === 'receipt.size' ? 'receipt.size' : 'receipt.read'}`);
    process.exitCode = 2;
  }
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const findings = lintMintManifest(await loadMintManifest());
  for (const item of findings) console.log(`${item.level.toUpperCase()} ${item.code} ${item.path}: ${item.message}`);
  const errors = findings.filter((item) => item.level === 'error');
  console.log(`Dasha manifest: ${errors.length ? 'FAIL' : 'PASS'} · ${errors.length} errors · ${findings.length - errors.length} warnings`);
  process.exitCode = errors.length ? 1 : 0;
}
