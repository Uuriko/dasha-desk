#!/usr/bin/env node
/**
 * Home is $dasha + Chat + Buy. No Studio. No chess-door. No VVAIFU. No Simp.
 */
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
assert.equal((html.match(/<h1\b/g) || []).length, 1, 'Home must have exactly one H1');
assert.match(html, />Chat</);
assert.match(html, />Buy</);
assert.match(html, /id="chat-door"/);
assert.match(html, /faucet/i);
assert.match(html, /grwm/i);
assert.doesNotMatch(html, /getdasha\.com\/studio/);
assert.doesNotMatch(html, /chess-door/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);
assert.doesNotMatch(html, /VVAIFU/);
assert.match(html, /getdasha\.com\/lobby/);
assert.match(html, /getdasha\.com\/compute/);
assert.match(html, /id="compute-door"/);
assert.match(html, /Try the console/);
assert.match(html, /Review source/);
assert.match(html, /Open alpha/);
assert.match(html, /providers can read prompts/);
assert.match(html, /no billing yet/);
assert.doesNotMatch(html, /encrypted from providers|production[- ]ready|guaranteed (demand|earnings)/i);
assert.match(html, /x\.com\/dash_eats/);
assert.match(html, /53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.match(html, /jup\.ag\/swap/);
assert.doesNotMatch(html, /simp-board|simp-row|Simp board|START QUIZ|LET'S GO|leaderboard/i);
assert.doesNotMatch(html, /dgnav|\.dgnav|system-ui|\bExo\b|\bBangers\b|\bRaleway\b|#c4a5ff|#3b6bff|#7c3aed|#7dffa3|#ffc857/);
assert.doesNotMatch(html, /t\.me\/|telegram/i);
assert.doesNotMatch(html, /<iframe/i);
assert.doesNotMatch(html, /pbs\.twimg\.com\/profile_images/);
assert.match(html, /class="ticker"/);
assert.match(html, /@keyframes dasha-ticker/);
assert.match(html, /Not endorsement/);
assert.match(html, /color:var\(--paper\)/);
assert.match(html, /box-shadow:4px 4px 0 var\(--hot\)/);

console.log('dasha-home: PASS');
