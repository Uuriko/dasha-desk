#!/usr/bin/env node
/**
 * Leftover lock after style+script strip.
 *
 * Live 2026-09-01 still ships Telegram chrome:
 *   /lobby pin + footer → https://t.me/+xB7S8mIQaKFiZjRh
 *   /chess footer same link, plus leftover id="buy-share-tg"
 *
 * id=forum-play stays gone. Play on lobby is product. Telegram is not.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

export function stripStyleScript(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
}

export function leftoverHits(html) {
  const stripped = stripStyleScript(html);
  const hits = [];
  if (/t\.me\//i.test(stripped) || /telegram\.me\//i.test(stripped)) hits.push('t.me');
  if (/id=["']forum-play["']/.test(stripped)) hits.push('forum-play');
  if (/id=["']buy-share-tg["']/.test(stripped)) hits.push('buy-share-tg');
  return hits;
}

const surfaces = {
  'home/index.html': read('home/index.html'),
  'lobby/index.html': read('lobby/index.html'),
  'privacy/index.html': read('privacy/index.html'),
  'desk/index.html': read('desk/index.html'),
  '404.html': read('404.html'),
  'bounties/index.html': read('bounties/index.html'),
  'fixtures/watch/home.html': read('fixtures/watch/home.html'),
  'fixtures/watch/lobby.html': read('fixtures/watch/lobby.html'),
  'fixtures/watch/chess.html': read('fixtures/watch/chess.html'),
  'fixtures/watch/howto.html': read('fixtures/watch/howto.html'),
  'fixtures/watch/bounties.html': read('fixtures/watch/bounties.html'),
};

for (const [name, html] of Object.entries(surfaces)) {
  const hits = leftoverHits(html);
  assert.deepEqual(hits, [], `${name} leftover after style+script strip: ${hits.join(', ')}`);
}

{
  const liveLobbyLeftover = '<p class="forum-pin"><a href="https://t.me/+xB7S8mIQaKFiZjRh">TG</a></p>';
  assert.deepEqual(leftoverHits(liveLobbyLeftover), ['t.me']);
}

{
  const liveChessLeftover = '<a id="buy-share-tg" href="https://t.me/+xB7S8mIQaKFiZjRh">TG</a>';
  assert.deepEqual(leftoverHits(liveChessLeftover), ['t.me', 'buy-share-tg']);
}

{
  const alreadyGone = '<section id="forum-play" class="forum-play"></section>';
  assert.deepEqual(leftoverHits(alreadyGone), ['forum-play']);
}

assert.doesNotMatch(stripStyleScript(read('lobby/index.html')), /id=["']forum-play-go["']/);
assert.doesNotMatch(stripStyleScript(read('lobby/index.html')), /id=["']bb-x["']/);
assert.match(read('bounties/index.html'), /id="bb-x"/);
assert.match(read('bounties/index.html'), /href="https:\/\/lobby\.getdasha\.com\/oauth\/x\/start"/);

console.log('leftover-lobby: PASS');
