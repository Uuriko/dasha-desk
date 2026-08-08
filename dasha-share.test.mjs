/**
 * Trust-reset contract for dasha desk.
 * Neutral mint/source/risk surface — no FOMO, raid, referral, or Telegram.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'src/app.js'), 'utf8');
const body = readFileSync(join(__dirname, 'src/body.html'), 'utf8');
const styles = readFileSync(join(__dirname, 'src/styles.css'), 'utf8');
const build = readFileSync(join(__dirname, 'build.mjs'), 'utf8');
const standalone = readFileSync(join(__dirname, 'index.html'), 'utf8');

const sandbox = {
  globalThis: {},
  window: undefined,
  document: undefined,
  navigator: undefined,
  console,
  URL,
};
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'src/app.js' });

const DD = sandbox.globalThis.DDShare;
assert.ok(DD, 'DDShare must export from app.js');
assert.equal(DD.CA, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump');
assert.ok(DD.BUY.includes('jup.ag') && DD.BUY.includes(DD.CA), 'BUY is Jupiter + mint');
assert.ok(DD.PAIR.includes('dexscreener'), 'PAIR is Dexscreener');

const share = DD.buildSharePack('share');
assert.ok(share.includes(DD.CA), 'share pack includes mint');
assert.ok(!share.includes('jup.ag'), 'share pack does not disguise a second buy route');
assert.ok(share.includes('dexscreener') || share.includes(DD.PAIR), 'share pack includes chart');
assert.ok(/can go to zero|NFA|not financial advice/i.test(share), 'share pack includes risk');
assert.ok(!/raid|fomo|invite|referral|telegram|t\.me/i.test(share), 'share pack stays neutral');

const verify = DD.buildSharePack('verify');
assert.ok(verify.includes('solscan.io/token/' + DD.CA));
assert.ok(verify.includes('rugcheck.xyz/tokens/' + DD.CA));
assert.ok(verify.includes(DD.CA));
assert.ok(!verify.includes('jup.ag'), 'verify pack stays informational');

// Mint paste: explorer URLs and zero-width junk
assert.equal(DD.normalizeMint(DD.CA), DD.CA);
assert.equal(DD.normalizeMint('  ' + DD.CA + '  '), DD.CA);
assert.equal(DD.normalizeMint('https://solscan.io/token/' + DD.CA), DD.CA);
assert.equal(DD.normalizeMint('https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=' + DD.CA), DD.CA);
assert.equal(DD.normalizeMint('\u200b' + DD.CA), DD.CA);
assert.notEqual(DD.normalizeMint('11111111111111111111111111111111'), DD.CA);


// Body contract: core IDs present, pressure surfaces gone
for (const id of [
  'dd-ca',
  'dd-copy',
  'dd-copy-share',
  'dd-share',
  'dd-tweet',
  'dd-paste',
  'dd-verify',
  'dd-refresh',
  'dd-buy',
  'dd-chart',
]) {
  assert.ok(body.includes('id="' + id + '"'), 'body has #' + id);
}

assert.ok(body.includes('id="dd-buy"') && body.includes('jup.ag/swap'), 'one Jupiter buy route');
assert.equal((body.match(/jup\.ag\/swap/g) || []).length, 1, 'exactly one Jupiter swap URL in body');
assert.ok(!/t\.me|telegram/i.test(body), 'no Telegram');
assert.ok(!/id="dd-fomo"|dd-fomo-|Raid this|raid kit|invite loop|dd-ref-chip|dd-sticky|dd-kit-raid/i.test(body), 'no FOMO/raid/referral/sticky chrome');
assert.ok(!/data-raid|data-pack="raid"|Copy raid|Buy the dip/i.test(body), 'no raid/dip CTAs');
assert.ok(/can go to zero/i.test(body) && /not financial advice|NFA/i.test(body), 'risk visible');
assert.ok(body.includes('rugcheck') && body.includes('solscan'), 'source links present');

// Styles stay light and free of pressure chrome
assert.ok(styles.includes('.dd-btn') && styles.includes('.dd-verify'), 'core styles present');
assert.ok(!/\.dd-fomo|\.dd-sticky|\.dd-raid/i.test(styles), 'no FOMO/sticky/raid styles');
for (const selector of ['#dd-app a:focus-visible', '#dd-app button:focus-visible', '#dd-app input:focus-visible', '#dd-app textarea:focus-visible']) {
  assert.ok(styles.includes(selector), `visible focus rule missing ${selector}`);
}
assert.ok(body.includes('id="dd-asof" role="status" aria-live="polite"'), 'market status is not announced');
assert.ok(body.includes('id="dd-toast" role="status" aria-live="polite"'), 'copy status is not announced');

// Standalone previews use the verified, no-likeness Dasha card rather than the retired casino image.
assert.ok(build.includes('<link rel="canonical" href="https://www.getdasha.com/dasha"/>'), 'Desk canonical missing');
assert.ok(build.includes('<meta property="og:url" content="https://www.getdasha.com/dasha"/>'), 'Desk og:url missing');
assert.ok(build.includes('<title>$dasha desk — verify, chart, buy</title>'), 'Desk title drifted from production');
assert.ok(build.includes('dasha-icon-32.png') && build.includes('dasha-icon-180.png'), 'standalone Desk icons missing');
const socialCard = 'https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/6a769a95c4b741dec227190f_dasha-social-card-v2.png';
assert.ok(build.includes(`<meta property="og:image" content="${socialCard}"/>`), 'standalone Desk social card missing');
assert.ok(build.includes(`<meta name="twitter:image" content="${socialCard}"/>`), 'standalone Desk Twitter card missing');
assert.ok(build.includes('<meta property="og:image:width" content="1200"/>') && build.includes('<meta property="og:image:height" content="630"/>'), 'standalone Desk social dimensions missing');
assert.ok(!/gpjyb0|casino-open-card/i.test(build), 'standalone Desk retained the retired casino card');
for (const url of ['https://www.getdasha.com/', 'https://www.getdasha.com/studio', 'https://www.getdasha.com/dasha']) {
  assert.ok(standalone.includes(`href="${url}"`), `standalone navigation lost ${url}`);
}
assert.ok(!/href="\/(?:studio|dasha)?"/.test(standalone), 'standalone navigation breaks on a subpath host');

// App must not reintroduce pressure builders
assert.ok(!/fomoDipHeadline|dipRaidLabel|buildSharePack\('raid'|dd-fomo-raid|invite loop|ref=/i.test(src), 'app.js free of FOMO/raid/ref builders');
assert.ok(src.includes('DDShare') && src.includes('buildSharePack'), 'DDShare export kept');

// A later Dex failure must clear previously painted numbers instead of presenting stale data.
{
  const elements = new Proxy({}, {
    get(store, id) {
      if (!store[id]) store[id] = {
        textContent: '',
        value: '',
        hidden: false,
        style: { removeProperty(name) { delete this[name]; } },
        listeners: {},
        addEventListener(type, fn) { this.listeners[type] = fn; },
      };
      return store[id];
    },
  });
  let requests = 0;
  const dom = {
    globalThis: null,
    document: { getElementById: id => elements[id], addEventListener() {}, visibilityState: 'visible' },
    navigator: {},
    URL,
    console,
    isFinite,
    AbortController,
    clearTimeout() {},
    setTimeout() { return 1; },
    setInterval() { return 1; },
    fetch: async () => ++requests === 1
      ? { ok: true, json: async () => ({ pairs: [{ priceUsd: '1', marketCap: 2000, liquidity: { usd: 3000 }, priceChange: { h24: 4 }, dexId: 'test' }] }) }
      : { ok: false, status: 503 },
  };
  dom.globalThis = dom;
  vm.runInNewContext(src, dom, { filename: 'src/app.js' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements['s-price'].textContent, '$1.00', 'successful Dex response did not paint');
  elements['dd-refresh'].listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(['s-price', 's-mcap', 's-liq', 's-24h', 'dd-px'].map(id => elements[id].textContent), ['—', '—', '—', '—', '—'], 'failed Dex refresh left stale data');
  assert.match(elements['dd-asof'].textContent, /unavailable · use sources below/i);
}

console.log('dasha-share.test.mjs: PASS (trust-reset)');
