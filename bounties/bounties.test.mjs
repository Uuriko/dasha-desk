#!/usr/bin/env node
/**
 * dasha bounties — parse listings, skip junk, never invent ranks or dollars,
 * and prove the “list a project” form builds a real GitHub new-issue URL.
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

assert.ok(existsSync(join(here, 'index.html')), 'bounties/index.html missing');
assert.ok(existsSync(join(root, 'config/bounties.seed.json')), 'seed listing missing');
assert.match(html, /declared bounties, not escrow/i);
assert.match(html, /id="bb-form"/);
assert.match(html, /open bounties, you set the pool/i);
assert.doesNotMatch(html + css + js, /[1-9A-HJ-NP-Za-km-z]{32,44}pump/);
assert.match(template, /name: Bounty project listing/);
assert.match(template, /bounty-project/);
assert.match(template, /id: listing/);
assert.match(template, /\[bounty\]/);

/* JSON listing parse */
const fenced = listingFromBody(`hello

\`\`\`json
{
  "repo": "Uuriko/dasha-desk",
  "pool": { "amount": 50, "currency": "USD", "period": "monthly" },
  "payout": { "solana": "", "url": "https://github.com/Uuriko/dasha-desk" },
  "scoring": { "merge": 10, "issue_close": 4, "review": 2, "merge_cap": 5, "review_cap": 10 }
}
\`\`\`
`);
assert.equal(fenced.repo, 'Uuriko/dasha-desk');
assert.equal(fenced.pool.amount, 50);
assert.equal(fenced.pool.currency, 'USD');
assert.equal(fenced.origin, 'issue');

const defaults = B.normalizeListing({ repo: 'Acme/tools' });
assert.equal(defaults.repo, 'Acme/tools');
assert.equal(defaults.pool, null);
assert.equal(B.formatPool(defaults.pool), 'undeclared');
assert.deepEqual(defaults.scoring, B.DEFAULT_SCORING);

const fromUrl = B.normalizeListing({ repo: 'https://github.com/Uuriko/dasha-desk.git' });
assert.equal(fromUrl.repo, 'Uuriko/dasha-desk');

assert.equal(B.normalizeListing({ repo: 'not a repo' }), null);
assert.equal(B.normalizeListing({ repo: '../etc/passwd' }), null);
assert.equal(B.extractJsonObject('no json here'), null);
assert.equal(B.extractJsonObject('```json\n{not json}\n```'), null);

/* skip malformed issues */
const issues = [
  { number: 1, title: '[bounty] good', html_url: 'https://github.com/Uuriko/dasha-desk/issues/1', body: '```json\n{"repo":"a/b","pool":{"amount":10,"currency":"SOL"}}\n```' },
  { number: 2, title: '[bounty] junk', html_url: 'https://github.com/x/y/issues/2', body: 'I forgot the json' },
  { number: 3, title: '[bounty] bad repo', html_url: 'https://github.com/x/y/issues/3', body: '{"repo":"nope"}' },
  { number: 4, title: 'not a listing', html_url: 'https://github.com/x/y/issues/4', body: '```json\n{"repo":"a/c"}\n```' },
  { number: 5, title: '[bounty] pr-shaped', pull_request: { url: 'https://api.github.com' }, body: '```json\n{"repo":"a/d"}\n```' },
  { number: 6, title: 'Labeled only', labels: [{ name: 'bounty-project' }], html_url: 'https://github.com/Uuriko/dasha-desk/issues/6', body: '```json\n{"repo":"z/y"}\n```' },
];
const parsed = B.listingsFromIssues(issues);
assert.deepEqual(
  parsed.map((row) => row.repo),
  ['a/b', 'z/y'],
);
assert.ok(!parsed.some((row) => row.repo === 'a/c' || row.repo === 'a/d'));
assert.equal(B.formatPool(parsed[0].pool), '10 SOL / MONTH');

/* no fabricated numbers when fetch fails */
const failed = {
  repo: 'Uuriko/dasha-desk',
  pool: { amount: 50, currency: 'USD', period: 'monthly' },
  contributors: null,
  error: 'unavailable',
};
const failedBoard = B.renderGlobalBoard({
  boardError: 'Contributor fetch failed. No ranks are shown.',
  global: [],
});
assert.match(failedBoard, /no ranks|unavailable|failed/i);
assert.doesNotMatch(failedBoard, /#1/);
assert.doesNotMatch(failedBoard, /\$50/);
assert.doesNotMatch(failedBoard, />0</);

const emptyBoard = B.renderGlobalBoard({ global: [] });
assert.match(emptyBoard, /no accepted outcomes/i);
assert.doesNotMatch(emptyBoard, /#1/);

const failCard = B.renderProjectCard(
  {
    repo: 'Uuriko/dasha-desk',
    origin: 'seed',
    blurb: 'Seed listing',
    pool: { amount: 50, currency: 'USD', period: 'monthly' },
    payout: { solana: '', url: 'https://github.com/Uuriko/dasha-desk' },
    scoring: B.DEFAULT_SCORING,
    period: 'monthly',
  },
  failed,
);
assert.match(failCard, /Uuriko\/dasha-desk/);
assert.match(failCard, /seed listing/i);
assert.doesNotMatch(failCard, /#1/);
assert.match(failCard, /\$50 \/ MONTH/);
const failPage = B.renderProjectPage(
  {
    repo: 'Uuriko/dasha-desk',
    origin: 'seed',
    blurb: 'Seed listing',
    pool: { amount: 50, currency: 'USD', period: 'monthly' },
    payout: { solana: '', url: 'https://github.com/Uuriko/dasha-desk' },
    scoring: B.DEFAULT_SCORING,
    period: 'monthly',
  },
  failed,
  { asOf: 'Wed, 13 Aug 2026 12:00:00 GMT' },
);
assert.match(failPage, /no fake leaderboard/i);
assert.doesNotMatch(failPage, /#1/);
assert.match(failPage, /as of /i);
assert.match(failPage, />—</);

const scoredFail = await B.scoreRepo(
  { repo: 'Uuriko/dasha-desk', scoring: B.DEFAULT_SCORING, pool: { amount: 50, currency: 'USD' } },
  {
    fetchImpl: async () =>
      new Response('nope', {
        status: 500,
        headers: { 'content-type': 'application/json', date: 'Wed, 13 Aug 2026 12:00:00 GMT' },
      }),
  },
  B.utcMonthRange('2026-08-13T12:00:00Z'),
);
assert.equal(scoredFail.contributors, null);
assert.equal(scoredFail.error, 'unavailable');
assert.ok(!Array.isArray(scoredFail.contributors));

const limited = await B.scoreRepo(
  { repo: 'Uuriko/dasha-desk', scoring: B.DEFAULT_SCORING, pool: null },
  {
    fetchImpl: async () =>
      new Response('API rate limit exceeded', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', date: 'Wed, 13 Aug 2026 12:00:00 GMT' },
      }),
  },
  B.utcMonthRange('2026-08-13T12:00:00Z'),
);
assert.equal(limited.contributors, null);
assert.equal(limited.error, 'rate-limited');

assert.equal(B.declaredShare(10, 0, { amount: 50, currency: 'USD' }), null);
assert.equal(B.declaredShare(10, 20, null), null);
assert.equal(B.declaredShare(10, 20, { amount: 50, currency: 'USD' }), 25);

/* form builds a valid GitHub new-issue URL */
const built = B.buildIssueUrl({
  repo: 'Uuriko/dasha-desk',
  amount: '50',
  currency: 'USD',
  period: 'monthly',
  blurb: 'desk seed',
  solana: '',
  url: 'https://github.com/Uuriko/dasha-desk',
  scoring: B.DEFAULT_SCORING,
});
assert.equal(built.ok, true);
const issueUrl = new URL(built.url);
assert.equal(issueUrl.origin, 'https://github.com');
assert.equal(issueUrl.pathname, '/Uuriko/dasha-desk/issues/new');
assert.equal(issueUrl.searchParams.get('template'), 'bounty-project.yml');
assert.equal(issueUrl.searchParams.get('title'), '[bounty] Uuriko/dasha-desk');
assert.equal(issueUrl.searchParams.get('labels'), 'bounty-project');
const listing = JSON.parse(issueUrl.searchParams.get('listing'));
assert.equal(listing.repo, 'Uuriko/dasha-desk');
assert.equal(listing.pool.amount, 50);
assert.equal(listing.pool.currency, 'USD');
assert.equal(listing.payout.url, 'https://github.com/Uuriko/dasha-desk');

const blankPool = B.buildIssueUrl({ repo: 'owner/name', amount: '' });
assert.equal(blankPool.ok, true);
assert.equal(JSON.parse(new URL(blankPool.url).searchParams.get('listing')).pool, undefined);

const badForm = B.buildIssueUrl({ repo: 'nope' });
assert.equal(badForm.ok, false);
assert.match(badForm.error, /owner\/name/);

/* seed listing renders */
const seedListings = B.listingsFromSeed(seed);
assert.equal(seedListings.length, 1);
assert.equal(seedListings[0].repo, 'Uuriko/dasha-desk');
assert.equal(seedListings[0].origin, 'seed');
assert.ok(seedListings[0].pool);
assert.equal(typeof seedListings[0].pool.amount, 'number');
assert.ok(!('contributors' in seed.listings[0]));
assert.ok(!('score' in seed.listings[0]));

const seedCard = B.renderProjectCard(seedListings[0], null);
assert.match(seedCard, /Uuriko\/dasha-desk/);
assert.match(seedCard, /seed listing/i);
assert.match(seedCard, /data-origin="seed"/);
assert.match(seedCard, /\$50 \/ MONTH/);
assert.doesNotMatch(seedCard, /#1/);

const merged = B.mergeListings(seedListings, [
  B.listingFromIssue({
    number: 99,
    title: '[bounty] Uuriko/dasha-desk',
    html_url: 'https://github.com/Uuriko/dasha-desk/issues/99',
    body: '```json\n{"repo":"Uuriko/dasha-desk","pool":{"amount":75,"currency":"USD","period":"monthly"}}\n```',
  }),
]);
assert.equal(merged.length, 1);
assert.equal(merged[0].origin, 'issue');
assert.equal(merged[0].pool.amount, 75);

const scored = B.scoreEvents({ merges: 9, issue_closes: 2, reviews: 40 }, B.DEFAULT_SCORING);
assert.equal(scored.merge_counted, 5);
assert.equal(scored.review_counted, 10);
assert.equal(scored.score, 5 * 10 + 2 * 4 + 10 * 2);

const rankedHuman = B.rankContributors([
  { login: 'ada', score: 10 },
  { login: 'dependabot[bot]', score: 99 },
]);
assert.equal(rankedHuman.length, 1);
assert.equal(rankedHuman[0].login, 'ada');

const ranked = B.aggregateGlobal([
  {
    repo: 'Uuriko/dasha-desk',
    pool: { amount: 50, currency: 'USD' },
    contributors: [
      { login: 'ada', htmlUrl: 'https://github.com/ada', score: 10 },
      { login: 'bob', htmlUrl: 'https://github.com/bob', score: 10 },
    ],
  },
]);
assert.equal(ranked[0].rank, 1);
assert.equal(ranked[1].rank, 1);
assert.equal(ranked[0].shares[0].share, 25);

const boardHtml = B.renderGlobalBoard({
  global: [
    {
      rank: 1,
      login: 'ada',
      htmlUrl: 'https://github.com/ada',
      score: 10,
      projects: ['Uuriko/dasha-desk'],
      shares: [{ repo: 'Uuriko/dasha-desk', share: 25, pool: { amount: 50, currency: 'USD' } }],
    },
  ],
});
assert.match(boardHtml, /Contributor/i);
assert.match(boardHtml, /Declared share/i);
assert.match(boardHtml, /Projected/i);
assert.match(boardHtml, /Total paid/i);
assert.match(boardHtml, /1 project · 1 scored cycle/);
assert.match(boardHtml, /\$25/);
assert.match(boardHtml, /—/);
assert.doesNotMatch(boardHtml, /\$0/);

assert.match(html, /Home/);
assert.match(html, /Studio/);
assert.match(html, /Bounties/);
assert.match(html, /Leaderboard/);
assert.match(html, /List a project/);
assert.match(css, /#F4F0E7/i);
assert.match(css, /#F5511E/i);
assert.match(css, /Poppins/);
assert.match(css, /prefers-reduced-motion/);

function listingFromBody(body) {
  return B.listingFromIssue({
    number: 11,
    title: '[bounty] Uuriko/dasha-desk',
    html_url: 'https://github.com/Uuriko/dasha-desk/issues/11',
    body,
  });
}

console.log('dasha-bounties: PASS');
