#!/usr/bin/env node
/** Lobby hosts Simp. Home does not. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');

assert.match(html, /--ink:#070608/);
assert.match(html, /--paper:#f4eddb/);
assert.match(html, /--acid:#dfff00/);
assert.match(html, /--hot:#ff3b81/);
assert.match(html, /--violet:#7c4dff/);
assert.match(html, /"Arial Black",Arial,Helvetica/);
assert.equal((html.match(/<h1\b/g) || []).length, 1);
assert.match(html, /id="simp"/);
assert.match(html, /id="dasha-simp-board"/);
assert.match(html, /lobby\.getdasha\.com\/client\/simp-board\.js/);
assert.ok(html.includes("integrity='sha384-UTvrCJlUnlRpT2IJpsLh7/PCpHxqEqdqeM2OX5eNrDdBWVBpesms1soa7Usd5jyG'"));
assert.match(html, /x\.com\/dash_eats/);
assert.match(html, /getdasha\.com\/bounties/);
assert.doesNotMatch(html, /<iframe/i);
assert.doesNotMatch(html, /dgnav|\.dgnav|system-ui|\bExo\b|\bBangers\b|\bRaleway\b|#c4a5ff|#3b6bff|#7c3aed|#ffc857/);
assert.doesNotMatch(html, /t\.me\/|telegram/i);
assert.doesNotMatch(html, /backdrop-filter/);

console.log('dasha-lobby: PASS');
