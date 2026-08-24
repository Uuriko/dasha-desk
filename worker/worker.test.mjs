#!/usr/bin/env node
/**
 * Worker-first getdasha.com public contract.
 * Home HTML must not contain VVAIFU or plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  handleRequest,
  rewriteHome,
  stripHomeOtherCoinWarning,
  HOME_308,
} from './src/index.js';
import {
  JUP_TOKENS,
  MINT,
  PAIR,
  SAME_AS,
  SITE,
  X_URL,
} from './src/identity.js';

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const dirty = read('fixtures/home-origin.html');
assert.match(dirty, /VVAIFU/);
assert.match(dirty, /plugin\.jup\.ag/);
assert.match(dirty, /Not CoinGecko/);

const stripped = stripHomeOtherCoinWarning(dirty);
assert.doesNotMatch(stripped, /VVAIFU/);
assert.doesNotMatch(stripped, /Not CoinGecko/);

const rewritten = rewriteHome(dirty);
assert.doesNotMatch(rewritten, /VVAIFU/, 'rewritten home must not contain VVAIFU');
assert.doesNotMatch(rewritten, /plugin\.jup\.ag/, 'rewritten home must not contain plugin.jup.ag');
assert.doesNotMatch(rewritten, /Not CoinGecko/, 'rewritten home must not contain Not CoinGecko');
assert.match(rewritten, /\$dasha/);
assert.match(rewritten, />Buy</);
assert.match(rewritten, new RegExp(JUP_TOKENS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const sameAs = JSON.parse(
  rewritten.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
);
assert.deepEqual(sameAs.sameAs, SAME_AS);
assert.equal(sameAs.sameAs[0], X_URL);
assert.equal(sameAs.sameAs[1], SITE);
assert.equal(sameAs.sameAs[2], JUP_TOKENS);

async function text(path) {
  const res = await handleRequest(new Request(`https://www.getdasha.com${path}`));
  return { res, body: await res.text() };
}

{
  const { res, body } = await text('/');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'html-security');
  assert.doesNotMatch(body, /VVAIFU/, 'Worker home HTML must not contain VVAIFU');
  assert.doesNotMatch(body, /plugin\.jup\.ag/, 'Worker home HTML must not contain plugin.jup.ag');
  assert.match(body, /\$dasha/);
  assert.match(body, />Buy</);
  assert.match(body, new RegExp(MINT));
  const ld = JSON.parse(body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(ld.sameAs, SAME_AS);
}

{
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /origin\.example/);
    return new Response(dirty, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  try {
    const res = await handleRequest(
      new Request('https://www.getdasha.com/'),
      { ORIGIN: 'https://origin.example' },
    );
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.doesNotMatch(body, /VVAIFU/, 'origin rewrite home must not contain VVAIFU');
    assert.doesNotMatch(body, /plugin\.jup\.ag/, 'origin rewrite home must not contain plugin.jup.ag');
    assert.match(body, />Buy</);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

for (const path of HOME_308) {
  const res = await handleRequest(new Request(`https://www.getdasha.com${path}`, { redirect: 'manual' }));
  assert.equal(res.status, 308, `${path} must 308`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/');
  const slash = await handleRequest(new Request(`https://www.getdasha.com${path}/`));
  assert.equal(slash.status, 308, `${path}/ must 308`);
}

{
  const { res, body } = await text('/bag');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'bag');
  assert.match(body, /Mint-dead/);
  assert.match(body, /Freeze-dead/);
  assert.match(body, /Burned Raydium LP/);
  assert.match(body, new RegExp(MINT));
  assert.match(body, new RegExp(PAIR));
}

{
  const { res, body } = await text('/which');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'which');
  assert.match(body, /VVAIFU/);
  assert.match(body, new RegExp(MINT));
  assert.doesNotMatch(body, /plugin\.jup\.ag/);
}

{
  const { res, body } = await text('/llms.txt');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'llms');
  assert.match(body, new RegExp(MINT));
  assert.match(body, /dash_eats/);
  assert.doesNotMatch(body, /plugin\.jup\.ag/);
}

{
  const { res, body } = await text('/llms-full.txt');
  assert.equal(res.status, 200);
  assert.match(body, /Mint-dead/);
  assert.match(body, new RegExp(JUP_TOKENS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

{
  const { res, body } = await text('/sitemap.xml');
  assert.equal(res.status, 200);
  assert.match(body, /www\.getdasha\.com\/bag/);
  assert.match(body, /www\.getdasha\.com\/which/);
}

{
  const { res, body } = await text('/robots.txt');
  assert.equal(res.status, 200);
  assert.match(body, /Sitemap: https:\/\/www\.getdasha\.com\/sitemap\.xml/);
}

{
  const example = read('wrangler.jsonc.example');
  assert.doesNotMatch(example, /"account_id"/);
  assert.doesNotMatch(example, /api[_-]?token/i);
  assert.doesNotMatch(example, /oauth/i);
  assert.doesNotMatch(example, /CLOUDFLARE_/);
  assert.match(example, /compatibility_date/);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

const secretLike = [
  /"account_id"\s*:/,
  /CLOUDFLARE_API_TOKEN/,
  /CLOUDFLARE_API_KEY/,
  /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/,
  /"client_secret"\s*:/,
  /CLIENT_SECRET\s*=/,
];

for (const file of walk(root)) {
  if (file.endsWith('worker.test.mjs')) continue;
  if (!/\.(js|jsonc|html)$/.test(file)) continue;
  const bytes = readFileSync(file, 'utf8');
  for (const pat of secretLike) {
    assert.doesNotMatch(bytes, pat, `${file} must stay secrets-free (${pat})`);
  }
}

console.log('dasha-worker: PASS');
