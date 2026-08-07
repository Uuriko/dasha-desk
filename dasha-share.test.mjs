/**
 * Unit tests for pure share builders shipped in src/app.js (globalThis.DDShare).
 * Loads the real app.js entry — does not re-implement pack strings.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'src/app.js'), 'utf8');

function load(overrides = {}) {
  const sandbox = { globalThis: {}, window: undefined, document: undefined, navigator: undefined, console, URL, ...overrides };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'src/app.js' });
  return sandbox.globalThis.DDShare;
}

const DD = load();
assert.ok(DD, 'DDShare must export from app.js');
assert.equal(DD.CA, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump');
assert.equal(DD.DESK, 'https://www.getdasha.com/');

const fakeDoc = (...hrefs) => ({
  querySelectorAll: () => hrefs.map((href) => ({ getAttribute: (name) => (name === 'rel' ? 'alternate CANONICAL' : href) })),
});
assert.equal(
  DD.resolveDeskUrl(fakeDoc('https://www.getdasha.com/?utm=x#mint'), { href: 'https://johns-awesome-project-39b1b5.webflow.io/dasha?utm=y#top' }, DD.DESK),
  'https://www.getdasha.com/',
);
assert.equal(DD.resolveDeskUrl(fakeDoc(), { href: 'https://johns-awesome-project-39b1b5.webflow.io/dasha?utm=x#mint' }, DD.DESK), 'https://johns-awesome-project-39b1b5.webflow.io/dasha');
assert.equal(DD.resolveDeskUrl(fakeDoc(), { href: 'https://files.catbox.moe/sm5mo0.html#top' }, DD.DESK), 'https://files.catbox.moe/sm5mo0.html');
assert.equal(DD.resolveDeskUrl(fakeDoc(), { href: 'https://www.getdasha.com/?utm=x#mint' }, DD.DESK), 'https://www.getdasha.com/');
assert.equal(DD.resolveDeskUrl(fakeDoc(), { href: 'https://johns-awesome-project-39b1b5.webflow.io/?utm=x#mint' }, DD.DESK), 'https://johns-awesome-project-39b1b5.webflow.io/');
for (const href of [
  'https://getdasha.com/',
  'https://www.getdasha.com/labs',
  'https://www.getdasha.com.evil.test/',
  'https://www.getdasha.com:444/',
  'https://user:pass@www.getdasha.com/',
  'https://files.catbox.moe/other.html',
  'http://127.0.0.1:8766/dasha',
  'file:///tmp/index.html',
  'https://example.test/dasha',
]) assert.equal(DD.resolveDeskUrl(fakeDoc(), { href }, DD.DESK), '', href);
assert.equal(DD.resolveDeskUrl(fakeDoc('https://evil.test/'), { href: 'https://johns-awesome-project-39b1b5.webflow.io/dasha' }, DD.DESK), 'https://johns-awesome-project-39b1b5.webflow.io/dasha');
assert.equal(DD.resolveDeskUrl(fakeDoc('https://www.getdasha.com/', 'https://evil.test/'), { href: 'https://johns-awesome-project-39b1b5.webflow.io/dasha' }, DD.DESK), 'https://johns-awesome-project-39b1b5.webflow.io/dasha');

const unsafe = load({ document: fakeDoc(), location: { href: 'https://example.test/dasha' } });
assert.equal(unsafe.DESK, '');
assert.ok(!unsafe.buildSharePack('discord').includes('Desk:'), 'unsafe mirrors omit desk from Discord pack');
assert.ok(!unsafe.buildSharePack('boost').includes('Desk:'), 'unsafe mirrors omit desk from boost pack');
assert.ok(!unsafe.buildSharePack('raid').includes('Desk →'), 'unsafe mirrors omit desk from raid pack');
assert.ok(!unsafe.buildLiveProof('$12.3K', '+4.2%').includes('Desk →'), 'unsafe mirrors omit desk from live pack');
assert.ok(!unsafe.buildSharePack('raid').includes('undefined'));
assert.match(src, /if \(DESK\) payload\.url = DESK;/, 'native share omits an unsafe URL');

const raid = DD.buildSharePack('raid');
assert.ok(raid.includes(DD.CA), 'raid pack includes mint');
assert.ok(raid.includes('casino') || raid.includes('crying'), 'raid pack includes casino line');
assert.ok(raid.includes(DD.PAIR) || raid.includes('dexscreener'), 'raid pack includes chart');

const discord = DD.buildSharePack('discord');
assert.ok(discord.includes(DD.CA));
assert.ok(discord.includes('NFA') || discord.includes('zero'));

const verify = DD.buildSharePack('verify');
assert.ok(verify.includes('solscan.io/token/' + DD.CA));
assert.ok(verify.includes('rugcheck.xyz/tokens/' + DD.CA));

const meme = DD.buildSharePack('meme');
assert.ok(meme.includes('$dasha'));
assert.ok(meme.length > 20);

const boost = DD.buildSharePack('boost');
assert.ok(boost.includes(DD.CA), 'boost pack includes mint');
assert.ok(boost.includes(DD.BUY) || boost.includes('jup.ag'), 'boost pack includes buy');
assert.ok(boost.includes(DD.DESK) || boost.includes('webflow.io/dasha'), 'boost pack includes desk');

const mini = DD.buildMiniPack();
assert.ok(mini.includes(DD.CA));
assert.ok(mini.includes(DD.BUY) || mini.includes('jup.ag'));
assert.notEqual(mini, raid);
assert.ok(DD.buildSharePack('raid').includes(DD.BUY) || DD.buildSharePack('raid').includes('jup.ag'));

const q = DD.buildQuoteShare('They are angels actually');
assert.ok(q.startsWith('They are angels actually'));
assert.ok(q.includes('$dasha'));
assert.equal(DD.buildQuoteShare(''), '');

const intent = DD.intentTweet(raid);
assert.ok(intent.startsWith('https://x.com/intent/tweet?text='));
assert.ok(intent.length > 40);
assert.ok(decodeURIComponent(intent).includes(DD.CA));
assert.equal(
  DD.safeProviderUrl('https://dexscreener.com/solana/pair', 'dexscreener.com'),
  'https://dexscreener.com/solana/pair',
);
assert.equal(DD.safeProviderUrl('http://dexscreener.com/solana/pair', 'dexscreener.com'), '');
assert.equal(DD.safeProviderUrl('https://dexscreener.com.evil.test/pair', 'dexscreener.com'), '');
assert.equal(DD.safeProviderUrl('javascript:alert(1)', 'dexscreener.com'), '');

const configuredPair = {
  chainId: 'solana',
  dexId: 'raydium',
  pairAddress: '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7',
  baseToken: { address: DD.CA },
  quoteToken: { address: 'So11111111111111111111111111111111111111112' },
  url: DD.PAIR,
  priceUsd: '0.001',
  liquidity: { usd: 1 },
};
assert.equal(
  DD.selectMarketPair([
    { ...configuredPair, pairAddress: 'wrong', liquidity: { usd: 1e9 } },
    { ...configuredPair, chainId: 'ethereum' },
    { ...configuredPair, baseToken: { address: 'wrong' }, quoteToken: { address: DD.CA } },
    configuredPair,
  ], DD.PAIR, DD.CA),
  configuredPair,
);
for (const pair of [
  null,
  { ...configuredPair, pairAddress: 'wrong' },
  { ...configuredPair, pairAddress: configuredPair.pairAddress.toLowerCase() },
  { ...configuredPair, chainId: 'ethereum' },
  { ...configuredPair, dexId: 'wrong' },
  { ...configuredPair, baseToken: { address: 'wrong' }, quoteToken: { address: DD.CA } },
  { ...configuredPair, quoteToken: { address: 'wrong' } },
  { ...configuredPair, priceUsd: '<script>' },
  { ...configuredPair, priceUsd: '0x10' },
  { ...configuredPair, priceUsd: ' ' },
  { ...configuredPair, priceUsd: '0' },
  { ...configuredPair, marketCap: -1 },
  { ...configuredPair, marketCap: true },
  { ...configuredPair, liquidity: { usd: 'Infinity' } },
  { ...configuredPair, volume: { h24: {} } },
  { ...configuredPair, priceChange: { h24: -101 } },
  { ...configuredPair, url: 'https://user:pass@dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7' },
  { ...configuredPair, url: 'https://dexscreener.com:444/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7' },
  { ...configuredPair, url: 'https://dexscreener.com/ethereum/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7' },
  { ...configuredPair, url: 'https://dexscreener.com.evil.test/solana/' + configuredPair.pairAddress },
]) assert.equal(DD.selectMarketPair(pair ? [pair] : null, DD.PAIR, DD.CA), null);
assert.equal(DD.selectMarketPair([configuredPair, { ...configuredPair }], DD.PAIR, DD.CA), null, 'duplicate identity is ambiguous');
assert.equal(DD.selectMarketPair([{ ...configuredPair, priceChange: { h24: 544 } }], DD.PAIR, DD.CA).pairAddress, configuredPair.pairAddress);
assert.ok(src.includes('/latest/dex/pairs/solana/'), 'uses documented exact-pair endpoint');

// body structural gates (built visitor surface later also checked)
const body = readFileSync(join(__dirname, 'src/body.html'), 'utf8');
assert.ok(body.includes('files.catbox.moe/gpjyb0.jpg'), 'casino-open durable media');
assert.ok(body.includes('files.catbox.moe/nid4qy.jpg'), 'verify-mint durable media');
assert.ok(body.includes('files.catbox.moe/qnvc7b.jpg'), 'aurora durable media');
assert.ok(body.includes('dd-share-room'), 'share section');
assert.ok(body.includes('dd-verify-how') || body.includes('dd-paste'), 'mint checker');
assert.ok(body.includes('dd-risk'), 'risk strip');
assert.ok(/culture coin|can go to zero|NFA/i.test(body), 'disclaimer language');
assert.ok(body.includes('endorsement') || body.includes('≠'), 'non-endorsement');
assert.ok(body.includes('53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump'));
assert.ok(body.includes('data-pack="raid"'));
assert.ok(body.includes('data-share-quote'));
assert.ok(body.includes('dd-copy-share') && body.includes('dd-tweet'), 'two share affordances');
assert.ok(body.includes('id="dd-desk-url" href="https://www.getdasha.com/"'), 'absolute no-JS desk fallback');
assert.ok(body.includes('id="dd-desk-link" hidden'), 'no-JS output hides the unverified desk-link fallback');
assert.ok(body.includes('dd-buy') && body.includes('jup.ag'), 'buy CTA');
assert.ok(body.includes('dd-proof') && body.includes('p-mcap'), 'live proof strip');
assert.ok(body.includes('data-pack="boost"'), 'boost share pack tab');
assert.ok(body.includes('Buy on Jupiter') || body.includes('dd-buy'), 'primary buy label');
const evidenceText = body.match(/<script type="application\/json" id="dd-evidence-json">([^<]+)<\/script>/)?.[1];
assert.ok(evidenceText, 'machine-readable mint evidence');
const evidence = JSON.parse(evidenceText);
assert.equal(evidence.mint, DD.CA);
assert.equal(evidence.commitment, 'finalized');
assert.equal(evidence.cluster, 'mainnet-beta');
assert.equal(evidence.account.type, 'mint');
assert.equal(evidence.account.mintAuthority, null);
assert.equal(evidence.account.freezeAuthority, null);
const receipt = DD.buildObservationReceipt(evidence, {
  ...configuredPair,
  marketCap: 1234,
  liquidity: { usd: 567 },
  volume: { h24: 89 },
  priceChange: { m5: 1, h1: 2, h6: 3, h24: 4 },
}, '2026-08-07T06:00:00.000Z');
assert.equal(receipt.schema, 'dasha.observation-receipt/1');
assert.equal(receipt.mintEvidence.account.accountDataSha256, evidence.account.accountDataSha256);
assert.deepEqual(JSON.parse(JSON.stringify(receipt.marketObservation)), {
  provider: 'Dexscreener', fetchedAt: '2026-08-07T06:00:00.000Z', pairUrl: DD.PAIR,
  pairAddress: configuredPair.pairAddress, mint: DD.CA, priceUsd: '0.001', marketCap: 1234,
  liquidityUsd: 567, volume24h: 89, change: { m5: 1, h1: 2, h6: 3, h24: 4 },
});
assert.equal(DD.buildObservationReceipt(evidence, null, '').marketObservation, null);
assert.deepEqual(DD.buildObservationReceipt(evidence, configuredPair, '2026-08-07T06:00:00Z'), DD.buildObservationReceipt(evidence, configuredPair, '2026-08-07T06:00:00Z'));
assert.throws(() => DD.buildObservationReceipt(null, configuredPair, '2026-08-07T06:00:00Z'), /evidence/i);
assert.ok(!JSON.stringify(receipt).includes(DD.BUY) && !JSON.stringify(receipt).includes(DD.DESK));
const accountData = Buffer.from(evidence.account.accountDataBase64, 'base64');
assert.equal(accountData.length, 82);
assert.equal(createHash('sha256').update(accountData).digest('hex'), evidence.account.accountDataSha256);
assert.equal(accountData.readUInt32LE(0), 0, 'mint authority COption is None');
assert.equal(accountData.readBigUInt64LE(36).toString(), evidence.account.supply);
assert.equal(accountData[44], evidence.account.decimals);
assert.equal(Boolean(accountData[45]), evidence.account.initialized);
assert.equal(accountData.readUInt32LE(46), 0, 'freeze authority COption is None');


// conversion / virality gates
assert.ok(raid.includes(DD.DESK) || raid.includes('webflow.io/dasha'), 'raid pack includes desk');
assert.ok(raid.includes(DD.BUY) || raid.includes('jup.ag'), 'raid pack includes buy');
assert.ok(typeof DD.buildLiveProof === 'function', 'buildLiveProof exported');
const live = DD.buildLiveProof('$12.3K', '+4.2%', '2026-08-07T06:00:00.000Z');
assert.ok(/mcap \$12\.3K/i.test(live), 'live proof mcap');
assert.ok(live.includes('+4.2%') || live.includes('24h'), 'live proof 24h');
assert.ok(live.includes('Dexscreener-reported') && live.includes(DD.PAIR), 'market snapshot names provider and exact chart');
assert.ok(live.includes('2026-08-07T06:00:00.000Z'), 'market snapshot includes retrieval time');
assert.ok(live.includes(DD.BUY) || live.includes('jup.ag'), 'live proof buy');
assert.ok(live.includes(DD.DESK) || live.includes('webflow.io/dasha'), 'live proof desk');
assert.ok(live.includes(DD.CA), 'live proof mint');
const mini2 = DD.buildMiniPack();
assert.ok(mini2.includes(DD.BUY) || mini2.includes('jup.ag'), 'mini buy');
assert.ok(mini2.toLowerCase().includes('buy') || mini2.includes(DD.BUY), 'mini conversion orient');
assert.ok(body.includes('dd-copy-buy'), 'copy buy funnel control');
assert.ok(body.includes('dd-copy-live'), 'copy live pack control');
assert.ok(body.includes('dd-social-proof'), 'live social proof line');


assert.ok(body.includes('dd-buy-sticky') || body.includes('Buy now'), 'sticky buy now');
assert.ok(body.includes('dd-buy-now') || body.includes('Buy now'), 'mobile buy-now class or label');
assert.ok(body.includes('dd-social-proof-hint') || body.includes('Tap to copy'), 'social proof one-tap hint');
assert.ok(body.includes('dd-social-proof-text') || body.includes('role="status"'), 'social proof live text');
assert.ok(body.includes('One-tap buy') || body.includes('dd-buy-sticky'), 'sticky funnel region');


assert.ok(!/dd-fomo|smartPackPicked|dd_raid_ab|data-raid-ab/.test(body + src), 'no urgency signal or hidden pack selection');


assert.ok(body.includes('dd-buy-sticky'), 'sticky buy control');
assert.ok(body.includes('Tap · copy share-ready live pack'), 'live-pack action is explicit');
assert.ok(!/dd-exit|dd-pulse-buy|dd-sticky-live|dd-sp-strip/.test(body + src), 'no exit interception, urgency pulse, or duplicate live strip');
assert.ok(!/localStorage|dd-hold|dd-copy-burst|dd-ticker|telegram\.me|t\.me\//i.test(body + src), 'no fake holding, copy-count, ticker, or Telegram channel state');
assert.ok(!src.includes('p.marketCap || p.fdv'), 'FDV is never mislabeled as market cap');
assert.ok(src.includes("lastProof = { mcap: '—', ch24: '—', at: '' }"), 'offline path clears shareable market state');
assert.ok(body.includes('Copy evidence receipt'), 'receipt label remains accurate when market data is unavailable');
assert.ok(src.includes("if (document.execCommand('copy')) ok();"), 'clipboard fallback reports success only when copying succeeds');

console.log('dasha-share.test.mjs: PASS');
