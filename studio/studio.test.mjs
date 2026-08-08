#!/usr/bin/env node
/**
 * The Studio's gate — plain node, no dependencies, no browser.
 *
 * This repo deliberately has no install step, so this test has none either. That rules out a real
 * browser, which means it cannot prove the Studio *draws* — the private repo has a Puppeteer suite
 * for that. What it can prove is everything that would quietly break the Studio for the people it is
 * handed to, and those are the failures that actually happen:
 *
 *   node studio.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStudioEmbed } from './embed-build.mjs';

const here = (f) => new URL(`./${f}`, import.meta.url);
const studio = await readFile(here('index.html'), 'utf8');
const embed = await readFile(here('embed.html'), 'utf8');

/* 1. Self-contained. The whole point of this tool is that you can save the file, open it offline,
      and it works — no CDN, no font host, no analytics, nothing that can be taken away from you.
      One well-meaning <script src> would end that, and nothing about the page would look wrong. */
const external = [...studio.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
const links = /^https:\/\/(creativecommons\.org|github\.com\/Uuriko|jup\.ag|x\.com)/;
assert.deepEqual(external.filter((u) => !links.test(u)), [],
  'the Studio must load nothing over the network — inline it or drop it');
assert.ok(!/<link[^>]+stylesheet/i.test(studio), 'external stylesheet: the Studio must carry its own CSS');
assert.ok(!/<script[^>]+\bsrc=/i.test(studio), 'external script: the Studio must carry its own JS');

/* 2. Everything the remix URLs can name still exists. A remix link is a promise: someone posted
      ?look=ticket months ago and it has to still open a ticket. Renaming a look silently breaks
      every link anyone ever shared. */
for (const look of ['poster', 'ticket', 'print', 'marquee', 'signal', 'face']) {
  assert.ok(studio.includes(`id: '${look}'`), `the "${look}" look is gone — every remix link naming it now breaks`);
}
for (const format of ['square', 'story', 'banner']) {
  assert.ok(studio.includes(`id: '${format}'`), `the "${format}" format is gone`);
}

/* 3. The licence. Contributors need to know what they may do with what they make, and the carve-out
      has to survive with it: CC0 can dedicate our drawing, it cannot grant rights to a real person's
      name or likeness, and saying only the first half would imply it did. */
assert.ok(/CC0/.test(studio), 'the CC0 dedication is gone — makers have no statement of their rights');
assert.ok(/name or likeness/i.test(studio), 'the likeness carve-out is gone; CC0 alone overstates the grant');

/* 4. The mint. The one string in this repo where being wrong costs somebody money. */
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
for (const [name, html] of [['index.html', studio], ['embed.html', embed]]) {
  for (const found of html.match(/[1-9A-HJ-NP-Za-km-z]{32,44}pump/g) || []) {
    assert.equal(found, MINT, `${name} contains an address that is not ours: ${found}`);
  }
}

/* 5. The embed is generated, not hand-written. It is what gets pasted into other people's pages, so
      a hand edit here is a fork that nobody knows exists. */
assert.equal(embed, buildStudioEmbed(studio),
  'embed.html is stale or was hand-edited — run: node embed-build.mjs');

/* 6. The embed cannot fight its host page. It goes into sites we do not control, where a bare
      `#canvas` or a `body { }` rule would collide with whatever is already there. */
assert.ok(!/\bdocument\.getElementById\b/.test(embed),
  'the embed reaches into the host document — ids must be looked up inside the shadow root');
for (const banned of ['<!doctype', '<html', '<body', ':root']) {
  assert.ok(!embed.toLowerCase().includes(banned), `the embed is a fragment and must not contain ${banned}`);
}

console.log('Dasha Studio: PASS (self-contained, looks and formats intact, licence stated, mint correct, embed generated and scoped)');
