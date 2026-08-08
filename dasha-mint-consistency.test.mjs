#!/usr/bin/env node
/** Assert associated mint stays consistent across config and UI sources. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const cfg = JSON.parse(read('config/dasha.json'));
const mint = cfg.mint;
assert.equal(typeof mint, 'string');
assert.match(mint, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'config mint must look like a Solana base58 address');

const body = read('src/body.html');
const app = read('src/app.js');
assert.ok(body.includes(mint), 'src/body.html missing config mint');
assert.ok(app.includes(mint), 'src/app.js missing config mint');

// No second conflicting 53ux… mint (common paste-typo class for this project)
const all = [...body.matchAll(/53uxQtB9[A-Za-z0-9]+/g)].map((m) => m[0]);
for (const m of all) assert.equal(m, mint, `body has divergent mint fragment ${m}`);

console.log('dasha-mint-consistency: PASS');
