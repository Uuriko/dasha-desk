#!/usr/bin/env node
/**
 * Home is band + one H1 + one Studio CTA + mint/buy + optional still.
 * Simp board does not belong on `/`. Quiz pills are already gone from live home.
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
assert.match(html, /Make something/);
assert.match(html, /getdasha\.com\/studio/);
assert.match(html, /getdasha\.com\/lobby/);
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
