#!/usr/bin/env node
/**
 * dasha bounties — parse listings, skip junk, never invent ranks,
 * prove the form builds a GitHub issue URL, and that seed has no fake leaderboard.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const B = require('./board.js');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const seed = JSON.parse(read('config/bounties.seed.json'));
const feed = JSON.parse(read('bounties/feed.json'));
const rootFeed = JSON.parse(read('bounties.json'));
const html = readFileSync(join(here, 'index.html'), 'utf8');
const css = readFileSync(join(here, 'board.css'), 'utf8');
const js = readFileSync(join(here, 'board.js'), 'utf8');
const template = read('.github/ISSUE_TEMPLATE/bounty-project.yml');

assert.ok(existsSync(join(here, 'index.html')));
assert.ok(existsSync(join(here, 'feed.json')));
assert.ok(existsSync(join(root, 'bounties.json')));
assert.ok(existsSync(join(root, 'config/bounties.seed.json')));
assert.match(html, /declared bounties, not escrow/i);
assert.match(html, /id="bb-form"/);
assert.match(html, /id="bb-rules"/);
assert.match(html, /id="bb-item"/);
assert.match(html, /open bounties, you set the pool/i);
assert.match(html, /rel="alternate"[^>]*feed\.json/);
assert.doesNotMatch(html + css + js, /[1-9A-HJ-NP-Za-km-z]{32,44}pump/);
assert.doesNotMatch(html, /1% platform fee|signed compute|14-day wallet/i);
assert.doesNotMatch(js, /merge_cap|issue_close|DEFAULT_SCORING|contributors\?per_page/);
assert.match(template, /name: Bounty listing/);
assert.match(template, /bounty-project/);
assert.match(template, /id: listing/);
assert.match(template, /itemUrl/);

/* JSON listing parse — freeform rules, repo optional */
const fenced = B.listingFromIssue({
  number: 11,
  title: '[bounty] dasha desk',
  html_url: 'https://github.com/Uuriko/dasha-desk/issues/11',
  created_at: '2026-08-13T12:00:00Z',
  body: `hello
\`\`\`json
{
  "name": "dasha desk",
  "repo": "Uuriko/dasha-desk",
  "pool": { "amount": 50, "currency": "USD" },
  "pays": "Merged PRs",
  "eligibility": "Anyone",
  "payout": "SOL to the address on the PR"
}
\`\`\`
`,
});
assert.equal(fenced.name, 'dasha desk');
assert.equal(fenced.repo, 'Uuriko/dasha-desk');
assert.equal(fenced.kind, 'project');
assert.equal(fenced.pool.amount, 50);
assert.equal(fenced.pays, 'Merged PRs');
assert.equal(fenced.origin, 'issue');
assert.ok(fenced.createdAt);
assert.ok(!('scoring' in fenced) || fenced.scoring == null);

const namedOnly = B.normalizeListing({ name: 'Zine', pays: 'A printed page' });
assert.equal(namedOnly.name, 'Zine');
assert.equal(namedOnly.kind, 'project');
assert.equal(namedOnly.repo, '');
assert.equal(namedOnly.pool, null);
assert.equal(B.formatPool(namedOnly.pool), 'undeclared');
assert.match(B.renderRules(namedOnly), /A printed page/);
assert.equal(B.normalizeListing({ title: 'Poster' }).name, 'Poster');
assert.match(B.renderRules(B.normalizeListing({ name: 'X', rules: 'Pay in stickers' })), /Pay in stickers/);

const fromUrl = B.normalizeListing({ name: 'desk', repo: 'https://github.com/Uuriko/dasha-desk.git' });
assert.equal(fromUrl.repo, 'Uuriko/dasha-desk');
assert.equal(fromUrl.kind, 'project');

const item = B.normalizeListing({
  itemUrl: 'https://github.com/Uuriko/dasha-desk/issues/8',
  amount: 25,
  currency: 'USD',
  pays: 'A merged PR',
  payout: 'example',
  createdAt: '2026-08-13T00:00:00.000Z',
});
assert.equal(item.kind, 'item');
assert.equal(item.repo, 'Uuriko/dasha-desk');
assert.equal(item.itemUrl, 'https://github.com/Uuriko/dasha-desk/issues/8');
assert.equal(item.amount, 25);
assert.match(item.name, /#8/);
assert.equal(B.parseGithubItem('Uuriko/dasha-desk#8').url, 'https://github.com/Uuriko/dasha-desk/issues/8');

assert.equal(B.normalizeListing({}), null);
assert.equal(B.normalizeListing({ repo: 'not a repo' }), null);
assert.equal(B.normalizeListing({ kind: 'item', itemUrl: 'https://example.com/not-github' }), null);
assert.equal(B.extractJsonObject('no json here'), null);
assert.equal(B.extractJsonObject('```json\n{not json}\n```'), null);

/* skip malformed issues */
const parsed = B.listingsFromIssues([
  { number: 1, title: '[bounty] good', html_url: 'https://x/1', body: '```json\n{"name":"Alpha","repo":"a/b","pool":{"amount":10,"currency":"SOL"}}\n```' },
  { number: 2, title: '[bounty] junk', html_url: 'https://x/2', body: 'I forgot the json' },
  { number: 3, title: '[bounty] empty', html_url: 'https://x/3', body: '{"repo":"nope"}' },
  { number: 4, title: 'not a listing', html_url: 'https://x/4', body: '```json\n{"name":"skip"}\n```' },
  { number: 5, title: '[bounty] pr', pull_request: { url: 'https://api.github.com' }, body: '```json\n{"name":"nope"}\n```' },
  { number: 6, title: 'Labeled', labels: [{ name: 'bounty-project' }], html_url: 'https://x/6', body: '```json\n{"name":"Zed"}\n```' },
  { number: 7, title: '[bounty] item', html_url: 'https://x/7', body: '```json\n{"kind":"item","itemUrl":"https://github.com/a/b/issues/9","amount":5,"currency":"USD"}\n```' },
]);
assert.deepEqual(
  parsed.map((row) => row.name),
  ['Alpha', 'Zed', 'a/b#9'],
);
assert.equal(B.formatPool(parsed[0].pool), '10 SOL');
assert.equal(parsed[2].kind, 'item');
assert.equal(parsed[2].itemUrl, 'https://github.com/a/b/issues/9');

/* no fabricated numbers when outcomes are empty / fetch is unused */
const failedBoard = B.renderGlobalBoard({
  boardError: 'GitHub contributor fetch failed.',
  outcomes: [],
});
assert.match(failedBoard, /failed|unavailable|no ranks/i);
assert.doesNotMatch(failedBoard, /#1/);
assert.doesNotMatch(failedBoard, /\$50/);

const emptyBoard = B.renderOutcomes([]);
assert.equal(emptyBoard.includes(B.EMPTY_OUTCOMES), true);
assert.match(emptyBoard, /No accepted outcomes in this cycle yet\./);
assert.doesNotMatch(emptyBoard, /#1/);

assert.deepEqual(B.normalizeOutcomes([{ login: 'ada', url: 'https://github.com/ada' }]), []);
assert.equal(
  B.normalizeOutcomes([{ login: 'ada', url: 'https://github.com/Uuriko/dasha-desk/pull/19' }]).length,
  1,
);
const scoredRow = B.renderOutcomes([
  { login: 'ada', url: 'https://github.com/Uuriko/dasha-desk/pull/19', note: 'merged' },
]);
assert.match(scoredRow, /href="https:\/\/github\.com\/Uuriko\/dasha-desk\/pull\/19"/);
assert.match(scoredRow, /PR #19/);
assert.doesNotMatch(scoredRow, /Projected|Total paid/);

const seedListings = B.listingsFromSeed(seed);
const project = seedListings.find((row) => row.kind === 'project');
const itemSeed = seedListings.find((row) => row.kind === 'item');
const failCard = B.renderProjectCard(project);
assert.match(failCard, /Uuriko\/dasha-desk/);
assert.match(failCard, /seed listing/i);
assert.doesNotMatch(failCard, /#1/);
assert.match(failCard, /\$50/);
assert.match(failCard, /Merged pull requests/i);

const failPage = B.renderProjectPage(project, seedListings);
assert.match(failPage, /No accepted outcomes in this cycle yet\./);
assert.doesNotMatch(failPage, />#1</);

const hunt = B.renderHunt(seedListings);
assert.match(hunt, /\$25/);
assert.match(hunt, /issues\/8/);
assert.match(hunt, /Open on GitHub/);

/* form builds a GitHub new-issue URL — name is enough for a project */
const built = B.buildIssueUrl({
  kind: 'project',
  name: 'dasha desk',
  repo: 'Uuriko/dasha-desk',
  amount: '50',
  currency: 'USD',
  pays: 'Merged PRs',
  eligibility: 'Anyone',
  payout: 'https://github.com/Uuriko/dasha-desk',
});
assert.equal(built.ok, true);
const issueUrl = new URL(built.url);
assert.equal(issueUrl.pathname, '/Uuriko/dasha-desk/issues/new');
assert.equal(issueUrl.searchParams.get('template'), 'bounty-project.yml');
assert.match(issueUrl.searchParams.get('title'), /^\[bounty\]/);
const listing = JSON.parse(issueUrl.searchParams.get('listing'));
assert.equal(listing.name, 'dasha desk');
assert.equal(listing.repo, 'Uuriko/dasha-desk');
assert.equal(listing.kind, 'project');
assert.equal(listing.pool.amount, 50);
assert.equal(listing.pays, 'Merged PRs');
assert.ok(!listing.scoring);

const noRepo = B.buildIssueUrl({ kind: 'project', name: 'Zine', pays: 'A spread' });
assert.equal(noRepo.ok, true);
assert.equal(JSON.parse(new URL(noRepo.url).searchParams.get('listing')).name, 'Zine');

const blankPool = B.buildIssueUrl({ kind: 'project', name: 'X', amount: '' });
assert.equal(blankPool.ok, true);
assert.equal(JSON.parse(new URL(blankPool.url).searchParams.get('listing')).pool, undefined);

assert.equal(B.buildIssueUrl({ kind: 'item', itemUrl: 'https://example.com/nope' }).ok, false);
assert.equal(B.buildIssueUrl({ repo: 'nope' }).ok, false);
assert.equal(B.buildIssueUrl({}).ok, false);

const itemForm = B.buildIssueUrl({
  kind: 'item',
  itemUrl: 'https://github.com/Uuriko/dasha-desk/issues/8',
  amount: '25',
  currency: 'USD',
  pays: 'A merged PR',
});
assert.equal(itemForm.ok, true);
const itemListing = JSON.parse(new URL(itemForm.url).searchParams.get('listing'));
assert.equal(itemListing.kind, 'item');
assert.equal(itemListing.itemUrl, 'https://github.com/Uuriko/dasha-desk/issues/8');
assert.equal(itemListing.amount, 25);
assert.ok(!itemListing.pool);

/* seed listing renders without a fake leaderboard */
assert.equal(seedListings.length, 2);
assert.equal(project.repo, 'Uuriko/dasha-desk');
assert.equal(project.origin, 'seed');
assert.equal(itemSeed.kind, 'item');
assert.equal(itemSeed.itemUrl, 'https://github.com/Uuriko/dasha-desk/issues/8');
assert.ok(!('contributors' in seed.listings[0]));
assert.ok(!('score' in seed.listings[0]));
assert.ok(!('scoring' in seed.listings[0]));
assert.deepEqual(seed.listings, feed.listings);
assert.deepEqual(feed, rootFeed);
assert.equal(feed.schema, 'dasha-bounties-feed/v1');
assert.equal(rootFeed.schema, 'dasha-bounties-feed/v1');
assert.equal(seed.schema, 'dasha-bounties-feed/v1');
assert.equal(B.FEED_SCHEMA, 'dasha-bounties-feed/v1');
assert.equal(feed.url, 'https://www.getdasha.com/bounties');
assert.equal(B.BOARD_URL, 'https://www.getdasha.com/bounties');
assert.doesNotMatch(feed.url, /\/$/);
assert.ok(Array.isArray(feed.listings));
assert.ok(!('items' in feed));
assert.match(html, /rel="canonical" href="https:\/\/www\.getdasha\.com\/bounties"/);
assert.doesNotMatch(html, /rel="canonical" href="https:\/\/www\.getdasha\.com\/bounties\/"/);
assert.match(html, /property="og:url" content="https:\/\/www\.getdasha\.com\/bounties"/);
assert.match(html, /https:\/\/uuriko\.github\.io\/dasha-desk\/bounties\/feed\.json/);
assert.match(html, /https:\/\/raw\.githubusercontent\.com\/Uuriko\/dasha-desk\/main\/bounties\/feed\.json/);
assert.doesNotMatch(html, /www\.getdasha\.com\/bounties\.json/);
assert.doesNotMatch(html, /www\.getdasha\.com\/bounties\/feed\.json/);
assert.doesNotMatch(html, /href="\/bounties\.json"/);
assert.match(html, /schema: dasha-bounties-feed\/v1/);
const serializedFeed = B.toFeed([]);
assert.equal(serializedFeed.schema, 'dasha-bounties-feed/v1');
assert.equal(serializedFeed.url, 'https://www.getdasha.com/bounties');
assert.ok(Array.isArray(serializedFeed.listings));
const seedCard = B.renderProjectCard(project);
assert.match(seedCard, /data-origin="seed"/);
assert.doesNotMatch(seedCard, /#1/);

feed.listings.forEach((row) => {
  assert.ok('repo' in row);
  assert.ok('itemUrl' in row);
  assert.ok('amount' in row);
  assert.ok('currency' in row);
  assert.ok('payout' in row);
  assert.ok('createdAt' in row);
});
const serialized = B.toFeed(seedListings);
serialized.listings.forEach((row) => {
  assert.ok('repo' in row);
  assert.ok('itemUrl' in row);
  assert.ok('amount' in row);
  assert.ok('currency' in row);
  assert.ok('rules' in row);
  assert.ok('payout' in row);
  assert.ok('createdAt' in row);
});
assert.equal(serialized.listings.find((row) => row.kind === 'item').itemUrl, 'https://github.com/Uuriko/dasha-desk/issues/8');
assert.ok(serialized.listings.every((row) => Array.isArray(row.outcomes)));
assert.ok(serialized.listings.every((row) => row.outcomes.every((o) => B.parseGithubProof(o.url))));

/* localStorage + shareable JSON */
const mem = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
};
assert.equal(B.saveLocal([namedOnly], mem), true);
assert.equal(B.loadLocal(mem)[0].name, 'Zine');
const token = B.encodeShare({ name: 'Poster', pays: 'A remix' });
const shared = B.decodeShare(token);
assert.equal(shared.name, 'Poster');
assert.equal(shared.pays, 'A remix');

assert.deepEqual(B.collectOutcomes(seedListings), []);

assert.match(html, /Home/);
assert.match(html, /Studio/);
assert.match(html, /Bounties/);
assert.match(html, /List a bounty/);
assert.match(html, /Open bounties/);
assert.match(html, /also on trydemigod\.com\/bounties/);
assert.match(html, /declared, not escrow/i);
assert.doesNotMatch(html, /1% platform fee|signed compute|14-day wallet/i);
assert.match(css, /#F4F0E7/i);
assert.match(css, /#F5511E/i);
assert.match(css, /Poppins/);
assert.match(css, /prefers-reduced-motion/);

/* Extra Demigod feed — injected via extraSeedUrls, not mixed into the local seed fallback list */
assert.deepEqual(B.EXTRA_SEED_URLS, [
  'https://raw.githubusercontent.com/Uuriko/demigod-site-cdn/main/bounties-feed.json',
  'https://cdn.jsdelivr.net/gh/Uuriko/demigod-site-cdn@main/bounties-feed.json',
]);
assert.ok(B.EXTRA_SEED_URLS.every((url) => !/trydemigod\.com/i.test(url)));
assert.doesNotMatch(js, /seedUrls[\s\S]{0,200}demigod-site-cdn/);
assert.doesNotMatch(js, /https:\/\/(?:www\.)?trydemigod\.com[^"'\s]*bounties-feed/i);

const demigodFeed = {
  name: 'demigod bounties',
  schema: 'dasha-bounties-feed/v1',
  note: 'Declared bounties, not escrow.',
  url: 'https://trydemigod.com/bounties',
  listings: [
    {
      kind: 'item',
      name: 'docs: add CONTRIBUTING screenshot of GitHub web edit flow',
      repo: 'Uuriko/dasha-desk',
      itemUrl: 'https://github.com/Uuriko/dasha-desk/issues/8',
      amount: 25,
      currency: 'USD',
      pays: 'A merged PR',
      eligibility: 'Anyone',
      payout: 'Owner-declared',
      rules: '',
      blurb: 'Same hunt as Dasha seed',
      createdAt: '2026-08-13T00:00:00.000Z',
      outcomes: [],
    },
    {
      kind: 'item',
      name: 'Demigod-only hunt',
      repo: 'Uuriko/demigod',
      itemUrl: 'https://github.com/Uuriko/demigod/issues/3',
      amount: 40,
      currency: 'USD',
      pays: 'A merged PR',
      eligibility: 'Anyone',
      payout: 'Owner-declared',
      rules: '',
      blurb: 'Only on Demigod',
      createdAt: '2026-08-13T00:00:00.000Z',
      outcomes: [],
    },
    {
      kind: 'project',
      name: 'dasha desk',
      repo: 'Uuriko/dasha-desk',
      itemUrl: null,
      amount: 50,
      currency: 'USD',
      pays: 'Merged PRs',
      outcomes: [{ login: 'bot', url: 'https://example.com/not-github', amount: 9999 }],
    },
    {
      kind: 'project',
      name: 'demigod',
      repo: 'Uuriko/demigod',
      itemUrl: null,
      blurb: 'A Demigod project listing',
      amount: 10,
      currency: 'USD',
      pays: 'Merged PRs',
      eligibility: 'Anyone',
      payout: 'Owner-declared',
      rules: '',
      createdAt: '2026-08-13T00:00:00.000Z',
      outcomes: [],
    },
    {},
    { kind: 'item', itemUrl: 'https://example.com/not-github' },
    { repo: 'not a repo' },
  ],
};

const demigodListings = B.listingsFromSeed(demigodFeed, 'demigod');
assert.deepEqual(
  demigodListings.map((row) => row.name),
  ['docs: add CONTRIBUTING screenshot of GitHub web edit flow', 'Demigod-only hunt', 'dasha desk', 'demigod'],
);
assert.ok(demigodListings.every((row) => row.origin === 'demigod'));
assert.deepEqual(
  demigodListings.find((row) => row.name === 'dasha desk').outcomes,
  [],
);
assert.ok(demigodListings.every((row) => row.outcomes.every((o) => B.parseGithubProof(o.url))));

const dashaOnly = B.listingsFromSeed(feed);
const merged = B.mergeListings(dashaOnly, demigodListings);
assert.equal(merged.filter((row) => row.itemUrl === 'https://github.com/Uuriko/dasha-desk/issues/8').length, 1);
assert.equal(merged.filter((row) => row.kind === 'project' && String(row.repo).toLowerCase() === 'uuriko/dasha-desk').length, 1);
assert.ok(merged.some((row) => row.name === 'Demigod-only hunt' && row.origin === 'demigod'));
assert.ok(merged.some((row) => row.name === 'demigod' && row.origin === 'demigod'));

const emptyRemote = B.mergeListings(dashaOnly, B.listingsFromSeed({ listings: [] }, 'demigod'));
assert.equal(emptyRemote.length, dashaOnly.length);
assert.deepEqual(emptyRemote.map((row) => row.name), dashaOnly.map((row) => row.name));

const mergedHunt = B.renderHunt(merged);
assert.match(mergedHunt, /Demigod-only hunt/);
assert.match(mergedHunt, /also on trydemigod\.com\/bounties/);
assert.doesNotMatch(mergedHunt, /hire|Studio work/i);

const demigodCard = B.renderProjectCard(demigodListings.find((row) => row.name === 'demigod'));
assert.match(demigodCard, /data-origin="demigod"/);
assert.match(demigodCard, /also on trydemigod\.com\/bounties/);
assert.match(demigodCard, /Not a Dasha mint or Studio listing/);
assert.doesNotMatch(demigodCard, /hire/i);

const jsonRes = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const EXTRA_FEED = 'https://example.test/demigod-feed.json';

function fakeBoardFetch(demigodBody, demigodStatus = 200) {
  return async (url) => {
    const u = String(url);
    if (u.includes('feed.json') && !u.includes('demigod-feed') && !u.includes('bounties-feed')) return jsonRes(feed);
    if (u.includes('api.github.com')) return jsonRes([]);
    if (u.includes('demigod-feed.json') || u.includes('bounties-feed.json')) {
      if (demigodStatus >= 400) return { ok: false, status: demigodStatus, json: async () => ({}), text: async () => '' };
      return jsonRes(demigodBody);
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
}

const booted = await B.boot({
  fetchImpl: fakeBoardFetch(demigodFeed),
  seedUrl: './feed.json',
  extraSeedUrls: [EXTRA_FEED],
  storage: mem,
});
assert.ok(booted.listings.some((row) => row.name === 'Demigod-only hunt' && row.origin === 'demigod'));
assert.equal(booted.listings.filter((row) => row.itemUrl === 'https://github.com/Uuriko/dasha-desk/issues/8').length, 1);
assert.ok(booted.listings.some((row) => row.name === 'docs: add CONTRIBUTING screenshot of GitHub web edit flow'));

const bootedEmpty = await B.boot({
  fetchImpl: fakeBoardFetch({ name: 'demigod bounties', listings: [] }),
  seedUrl: './feed.json',
  extraSeedUrls: [EXTRA_FEED],
  storage: mem,
});
assert.ok(bootedEmpty.listings.some((row) => row.name === 'docs: add CONTRIBUTING screenshot of GitHub web edit flow'));
assert.ok(!bootedEmpty.listings.some((row) => row.origin === 'demigod'));
assert.ok(bootedEmpty.listings.length >= dashaOnly.length);

const bootedFail = await B.boot({
  fetchImpl: fakeBoardFetch(null, 500),
  seedUrl: './feed.json',
  extraSeedUrls: [EXTRA_FEED],
  storage: mem,
});
assert.ok(bootedFail.listings.some((row) => row.name === 'docs: add CONTRIBUTING screenshot of GitHub web edit flow'));
assert.deepEqual(bootedFail.demigod, []);

const extraFailed = await B.listingsFromExtraUrls(
  async () => {
    throw new Error('network');
  },
  [EXTRA_FEED],
  'demigod',
);
assert.deepEqual(extraFailed, []);

console.log('dasha-bounties: PASS');
