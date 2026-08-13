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
const html = readFileSync(join(here, 'index.html'), 'utf8');
const css = readFileSync(join(here, 'board.css'), 'utf8');
const js = readFileSync(join(here, 'board.js'), 'utf8');
const template = read('.github/ISSUE_TEMPLATE/bounty-project.yml');

assert.ok(existsSync(join(here, 'index.html')));
assert.ok(existsSync(join(root, 'config/bounties.seed.json')));
assert.match(html, /declared bounties, not escrow/i);
assert.match(html, /id="bb-form"/);
assert.match(html, /id="bb-rules"/);
assert.match(html, /open bounties, you set the pool/i);
assert.doesNotMatch(html + css + js, /[1-9A-HJ-NP-Za-km-z]{32,44}pump/);
assert.doesNotMatch(html, /1% platform fee|signed compute|14-day wallet/i);
assert.doesNotMatch(js, /merge_cap|issue_close|DEFAULT_SCORING/);
assert.match(template, /name: Bounty project listing/);
assert.match(template, /bounty-project/);
assert.match(template, /id: listing/);

/* JSON listing parse — freeform rules, repo optional */
const fenced = B.listingFromIssue({
  number: 11,
  title: '[bounty] dasha desk',
  html_url: 'https://github.com/Uuriko/dasha-desk/issues/11',
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
assert.equal(fenced.pool.amount, 50);
assert.equal(fenced.pays, 'Merged PRs');
assert.equal(fenced.origin, 'issue');
assert.ok(!('scoring' in fenced) || fenced.scoring == null);

const namedOnly = B.normalizeListing({ name: 'Zine', pays: 'A printed page' });
assert.equal(namedOnly.name, 'Zine');
assert.equal(namedOnly.repo, '');
assert.equal(namedOnly.pool, null);
assert.equal(B.formatPool(namedOnly.pool), 'undeclared');
assert.match(B.renderRules(namedOnly), /A printed page/);
assert.equal(B.normalizeListing({ title: 'Poster' }).name, 'Poster');
assert.match(B.renderRules(B.normalizeListing({ name: 'X', rules: 'Pay in stickers' })), /Pay in stickers/);

const fromUrl = B.normalizeListing({ name: 'desk', repo: 'https://github.com/Uuriko/dasha-desk.git' });
assert.equal(fromUrl.repo, 'Uuriko/dasha-desk');

assert.equal(B.normalizeListing({}), null);
assert.equal(B.normalizeListing({ repo: 'not a repo' }), null);
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
]);
assert.deepEqual(
  parsed.map((row) => row.name),
  ['Alpha', 'Zed'],
);
assert.equal(B.formatPool(parsed[0].pool), '10 SOL');

/* no fabricated numbers when fetch fails */
const failedBoard = B.renderGlobalBoard({
  boardError: 'GitHub contributor fetch failed.',
  global: [],
});
assert.match(failedBoard, /failed|unavailable|no ranks/i);
assert.doesNotMatch(failedBoard, /#1/);
assert.doesNotMatch(failedBoard, /\$50/);

const emptyBoard = B.renderGlobalBoard({ global: [] });
assert.match(emptyBoard, /no public github/i);
assert.doesNotMatch(emptyBoard, /#1/);

const seedListing = B.listingsFromSeed(seed)[0];
const failCard = B.renderProjectCard(seedListing);
assert.match(failCard, /Uuriko\/dasha-desk/);
assert.match(failCard, /seed listing/i);
assert.doesNotMatch(failCard, /#1/);
assert.match(failCard, /\$50/);
assert.match(failCard, /Merged pull requests/i);

const failPage = B.renderProjectPage(seedListing, { contributors: null, error: 'unavailable' }, {});
assert.match(failPage, /no fake leaderboard/i);
assert.doesNotMatch(failPage, /#1/);

const scoredFail = await B.fetchContributors('Uuriko/dasha-desk', {
  fetchImpl: async () => new Response('nope', { status: 500, headers: { date: 'Wed, 13 Aug 2026 12:00:00 GMT' } }),
});
assert.equal(scoredFail.contributors, null);
assert.equal(scoredFail.error, 'unavailable');

const limited = await B.fetchContributors('Uuriko/dasha-desk', {
  fetchImpl: async () =>
    new Response('API rate limit exceeded', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', date: 'Wed, 13 Aug 2026 12:00:00 GMT' },
    }),
});
assert.equal(limited.contributors, null);
assert.equal(limited.error, 'rate-limited');

/* form builds a GitHub new-issue URL — name is enough */
const built = B.buildIssueUrl({
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
assert.equal(listing.pool.amount, 50);
assert.equal(listing.pays, 'Merged PRs');
assert.ok(!listing.scoring);

const noRepo = B.buildIssueUrl({ name: 'Zine', pays: 'A spread' });
assert.equal(noRepo.ok, true);
assert.equal(JSON.parse(new URL(noRepo.url).searchParams.get('listing')).name, 'Zine');

const blankPool = B.buildIssueUrl({ name: 'X', amount: '' });
assert.equal(blankPool.ok, true);
assert.equal(JSON.parse(new URL(blankPool.url).searchParams.get('listing')).pool, undefined);

assert.equal(B.buildIssueUrl({ repo: 'nope' }).ok, false);
assert.equal(B.buildIssueUrl({}).ok, false);

/* seed listing renders without a fake leaderboard */
const seedListings = B.listingsFromSeed(seed);
assert.equal(seedListings.length, 1);
assert.equal(seedListings[0].repo, 'Uuriko/dasha-desk');
assert.equal(seedListings[0].origin, 'seed');
assert.ok(!('contributors' in seed.listings[0]));
assert.ok(!('score' in seed.listings[0]));
assert.ok(!('scoring' in seed.listings[0]));
const listingsFile = JSON.parse(read('bounties/listings.json'));
assert.deepEqual(listingsFile.listings, seed.listings);
const seedCard = B.renderProjectCard(seedListings[0]);
assert.match(seedCard, /data-origin="seed"/);
assert.doesNotMatch(seedCard, /#1/);

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

const ranked = B.aggregateGlobal([
  {
    repo: 'Uuriko/dasha-desk',
    contributors: [
      { login: 'ada', htmlUrl: 'https://github.com/ada', contributions: 10 },
      { login: 'bob', htmlUrl: 'https://github.com/bob', contributions: 10 },
    ],
  },
]);
assert.equal(ranked[0].rank, 1);
assert.equal(ranked[0].contributions, 10);

const boardHtml = B.renderGlobalBoard({
  global: [{ rank: 1, login: 'ada', htmlUrl: 'https://github.com/ada', contributions: 10, projects: ['Uuriko/dasha-desk'] }],
});
assert.match(boardHtml, /Contributor/i);
assert.match(boardHtml, /GitHub contributions/i);
assert.doesNotMatch(boardHtml, /Projected|Total paid|1 scored cycle/i);

assert.match(html, /Home/);
assert.match(html, /Studio/);
assert.match(html, /Bounties/);
assert.match(html, /List a project/);
assert.match(css, /#F4F0E7/i);
assert.match(css, /#F5511E/i);
assert.match(css, /Poppins/);
assert.match(css, /prefers-reduced-motion/);

console.log('dasha-bounties: PASS');
