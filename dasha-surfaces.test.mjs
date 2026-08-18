#!/usr/bin/env node
/**
 * Hunt for this-week getdasha surfaces in-repo: lobby, privacy, desk→dasha, branded 404.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const files = {
  home: 'home/index.html',
  lobby: 'lobby/index.html',
  privacy: 'privacy/index.html',
  desk: 'desk/index.html',
  notFound: '404.html',
  bounties: 'bounties/index.html',
};

for (const [name, rel] of Object.entries(files)) {
  assert.ok(existsSync(join(root, rel)), `${name} missing at ${rel}`);
}

const home = read(files.home);
const lobby = read(files.lobby);
const privacy = read(files.privacy);
const desk = read(files.desk);
const notFound = read(files.notFound);
const bounties = read(files.bounties) + read('bounties/board.css');
const loader = read('studio/loader.html');
const studioReadme = read('studio/README.md');
const studioSri = `sha384-${createHash('sha384').update(read('studio/embed.js')).digest('base64')}`;

assert.doesNotMatch(home, /id="dasha-simp-board"|Simp board/i);
assert.match(lobby, /id="dasha-simp-board"/);
assert.match(privacy, /<h1>\s*Privacy\s*<\/h1>/i);
assert.match(privacy, /We don't hold it/);
assert.match(desk, /location\.replace/);
assert.match(desk, /\/dasha/);
assert.match(desk, /rel="canonical" href="https:\/\/www\.getdasha\.com\/dasha"/);
assert.match(notFound, /This page isn’t here|This page isn't here/);
assert.match(notFound, /--ink:#070608/);
assert.match(notFound, /--acid:#dfff00/);
assert.doesNotMatch(notFound, /Page not found/);

for (const [name, html] of Object.entries({ home, lobby, privacy, desk, notFound, bounties })) {
  assert.match(html, /#070608/, `${name} missing ink`);
  assert.match(html, /#f4eddb/, `${name} missing paper`);
  assert.match(html, /#dfff00/, `${name} missing acid`);
  assert.match(html, /#ff3b81/, `${name} missing hot`);
  assert.doesNotMatch(html, /\bExo\b|\bBangers\b|\bRaleway\b/, `${name} loads a second font stack`);
  assert.doesNotMatch(html, /t\.me\/|telegram/i, `${name} invents Telegram`);
  assert.doesNotMatch(html, /#c4a5ff|#f6f1ff|#7c3aed|#ffc857/, `${name} uses a banned colour`);
}

assert.match(bounties, /id="bb-payto"[^>]*required/);
assert.doesNotMatch(bounties, /<iframe/i);

assert.ok(loader.includes(`integrity="${studioSri}"`));
assert.ok(studioReadme.includes(studioSri));

console.log('dasha-surfaces: PASS');
