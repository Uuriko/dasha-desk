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
 *
 * Run it from `dasha-desk/studio/`, not from here. This file is the SOURCE that
 * dasha-studio-publish.mjs:97 copies out as `dasha-desk/studio/studio.test.mjs`, and every path in
 * it — the `./embed-build.mjs` import, `index.html`, `embed.html`, `embed.js` — resolves only at
 * that destination. Running it from the repo root gets ERR_MODULE_NOT_FOUND, which looks like a
 * broken test and is not one. `npm run dasha:test:all` covers it via `dasha-studio-publish.mjs
 * --check`, which is why nothing invokes this path directly.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildStudioEmbed } from './embed-build.mjs';

const here = (f) => new URL(`./${f}`, import.meta.url);
const studio = await readFile(here('index.html'), 'utf8');
const embed = await readFile(here('embed.html'), 'utf8');
const embedScript = await readFile(here('embed.js'), 'utf8');
const readme = await readFile(here('README.md'), 'utf8');

/* 1. Nothing loads that nobody approved.
      The tool's code, styles and drawn art are all in this one file, so the drawn looks work with
      the wifi off. The photo gallery is the one exception and it is a deliberate one — every host it
      reaches is listed here, and a new one fails this test rather than appearing quietly.
      Note the pattern: it matches any absolute URL, not just src=/href=. An earlier version only
      checked attributes and waved through fifteen photographs, because they are URLs in a
      JavaScript array loaded with new Image(). Markup-shaped checks do not check a canvas app. */
const LINKS = /^https:\/\/(creativecommons\.org|github\.com\/Uuriko|jup\.ag|x\.com|lobby\.getdasha\.com)/;
const PHOTO_HOSTS = /^https:\/\/(pbs\.twimg\.com|static1\.squarespace\.com|www\.moviemaker\.com|m\.media-amazon\.com|br\.web\.img2\.acsta\.net|avatars\.mds\.yandex\.net|upload\.wikimedia\.org)\//;
const external = [...studio.matchAll(/https?:\/\/[^\s"'`)<>]+/g)].map((m) => m[0]);
assert.deepEqual([...new Set(external.filter((u) => !LINKS.test(u) && !PHOTO_HOSTS.test(u)))], [],
  'the Studio reaches a host nobody approved — add it above on purpose, or drop it');
assert.ok(!/<link[^>]+stylesheet/i.test(studio), 'external stylesheet: the Studio must carry its own CSS');
assert.ok(!/<script[^>]+\bsrc=/i.test(studio), 'external script: the Studio must carry its own JS');

/* 2. The licence claim must match what an export can actually contain.
      With a photo gallery in the tool, "assets and exports are CC0" hands someone else's photograph
      to the public domain. The dedication covers what the Studio DRAWS; the photos are not ours. */
const hasGallery = external.some((u) => PHOTO_HOSTS.test(u));
assert.ok(!(hasGallery && /exports are\s*<a[^>]*>CC0/i.test(studio)),
  'the footer dedicates EXPORTS to the public domain while a photo gallery exists — narrow it to what the Studio draws');

/* 2. Everything the remix URLs can name still exists. A remix link is a promise: someone posted
      ?look=ticket months ago and it has to still open a ticket. Renaming a look silently breaks
      every link anyone ever shared. */
for (const look of ['poster', 'ticket', 'print', 'marquee', 'signal', 'face']) {
  assert.ok(studio.includes(`id: '${look}'`), `the "${look}" look is gone — every remix link naming it now breaks`);
}
for (const format of ['square', 'story', 'banner']) {
  assert.ok(studio.includes(`id: '${format}'`), `the "${format}" format is gone`);
}

/* 2b. Surprise me sits with the other .go actions, picks a new look, and uses that look's line. */
assert.match(studio, /<div class="go">[\s\S]*id="surprise-go"[\s\S]*Surprise me/,
  'Surprise me must sit next to the existing .go buttons');
assert.match(studio, /LOOKS\.filter\(\(option\) => option\.id !== look\.id\)/,
  'Surprise me must not re-pick the look that is already selected');
assert.match(studio, /\$\('line'\)\.value = capsOn \? pick\.toUpperCase\(\) : pick/,
  'Surprise me must set the caption from the chosen look');
assert.match(studio, /const pick = nextLook\.line/,
  'Surprise me caption must come from the chosen look\'s line');

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

/* The copy-paste script runs with the host page's authority. Pin the reviewed bytes so a changed
   Pages asset fails closed instead of silently executing on every adopter's site. */
const sri = `sha384-${createHash('sha384').update(embedScript).digest('base64')}`;
assert.match(readme, new RegExp(`integrity=["']${sri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`),
  'README integrity does not match embed.js — update the copy-paste snippet with the reviewed SHA-384');
assert.match(readme, /crossorigin=["']anonymous["']/,
  'cross-origin SRI requires crossorigin="anonymous"');

/* 6. The embed cannot fight its host page. It goes into sites we do not control, where a bare
      `#canvas` or a `body { }` rule would collide with whatever is already there. */
assert.ok(!/\bdocument\.getElementById\b/.test(embed),
  'the embed reaches into the host document — ids must be looked up inside the shadow root');
for (const banned of ['<!doctype', '<html', '<body', ':root']) {
  assert.ok(!embed.toLowerCase().includes(banned), `the embed is a fragment and must not contain ${banned}`);
}

console.log('Dasha Studio: PASS (self-contained, looks and formats intact, licence stated, mint correct, embed generated and scoped)');
