/**
 * Compatibility adapter: dasha-bounties-feed/v1 ↔ commons.bounty/v1.
 * Existing URLs, feeds, GitHub issue listings, and read-only consumers stay intact.
 * This file is the getdasha profile. Canonical objects themselves stay unbranded.
 */
import { BOUNTY_SCHEMA, FEED_SCHEMA, SCHEMA_VERSION, USDC_MINT, emptyCancellation, emptyRefund, emptyRules, emptySettlement } from './schema.mjs';

export { USDC_MINT };

export const LEGACY_FEED_SCHEMA = 'dasha-bounties-feed/v1';
export const DASHA_BOARD_URL = 'https://www.getdasha.com/bounties';
export const LIVE_FEED_URL = 'https://www.getdasha.com/bounties.json';
/** Measured 2026-08-30 ~12:00 AM PT. These are not feeds. Do not invent them. */
export const LIVE_FEED_NOT_FOUND = Object.freeze([
  'https://www.getdasha.com/bounties/api',
  'https://www.getdasha.com/bounties/feed',
  'https://www.getdasha.com/api/bounties',
  'https://www.getdasha.com/bounties/feed.json',
]);
export const LIVE_EMPTY_FEED = Object.freeze({
  name: 'dasha bounties',
  schema: LEGACY_FEED_SCHEMA,
  note: "USDC on Solana. We don't hold it.",
  url: DASHA_BOARD_URL,
  listings: Object.freeze([]),
});

const ITEM_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/(issues|pull)\/(\d+)/i;

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseItem(url) {
  const m = String(url || '').trim().match(ITEM_RE);
  if (!m) return null;
  return { repo: `${m[1]}/${m[2]}`, type: m[3].toLowerCase() === 'pull' ? 'pull' : 'issues', number: Number(m[4]) };
}

export function legacyListingId(listing) {
  const item = listing && (listing.item || parseItem(listing.itemUrl));
  if (listing && listing.kind === 'item' && item) {
    return (`item:${item.repo}/${item.type}/${item.number}`).toLowerCase();
  }
  if (listing && listing.repo) return String(listing.repo).toLowerCase();
  return `name:${slugify(listing && (listing.name || listing.title))}`;
}

function coerceUsdc(value) {
  const c = String(value || '').trim();
  if (!c || /^usd$/i.test(c) || c === '$' || /^usdc$/i.test(c)) return 'USDC';
  return c;
}

function rowsOf(feed) {
  if (!feed) return [];
  if (Array.isArray(feed.listings)) return feed.listings;
  if (Array.isArray(feed.items)) return feed.items;
  if (Array.isArray(feed.bounties)) return feed.bounties;
  if (Array.isArray(feed)) return feed;
  return [];
}

export function isCommonsBounty(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.schema === BOUNTY_SCHEMA) return true;
  return Boolean(raw.id && raw.title && raw.reward && raw.state);
}

function identityFromLegacy(listing) {
  const login = listing && listing.github ? String(listing.github).trim() : '';
  if (login) return { kind: 'github', id: login, handle: login, wallet: listing.payTo || null };
  if (listing && listing.payTo) return { kind: 'wallet', id: listing.payTo, wallet: listing.payTo, handle: null };
  return { kind: 'opaque', id: legacyListingId(listing), wallet: null, handle: null };
}

function outcomesToWinners(outcomes) {
  return (outcomes || [])
    .filter((row) => row && row.url)
    .map((row, i) => ({
      submissionId: `legacy-outcome-${i + 1}`,
      identity: { kind: 'github', id: String(row.login || 'unknown'), handle: row.login || null, wallet: null },
      selectedAt: null,
      proof: { url: row.url },
    }));
}

export function fromLegacyListing(listing, { community = 'getdasha', origin = 'seed' } = {}) {
  if (!listing || typeof listing !== 'object') return null;
  if (isCommonsBounty(listing)) return listing;
  const item = parseItem(listing.itemUrl);
  const id = listing.id || legacyListingId(listing);
  if (!id || !(listing.name || listing.title)) return null;
  const amount = listing.amount != null ? listing.amount : listing.pool && listing.pool.amount;
  const symbol = coerceUsdc(listing.currency || (listing.pool && listing.pool.currency) || 'USDC');
  const payTo = listing.payTo || null;
  const unfunded = !payTo || listing.payoutStatus === 'not_implemented';
  const winners = outcomesToWinners(listing.outcomes);
  const state = winners.length ? 'selected' : 'open';
  return {
    schema: BOUNTY_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    id,
    title: listing.name || listing.title,
    description: listing.blurb || listing.pays || '',
    creator: identityFromLegacy(listing),
    creatorWallet: payTo,
    reward: {
      asset: 'spl',
      symbol,
      mint: listing.tokenMint || (symbol === 'USDC' ? USDC_MINT : null),
      amount: amount == null ? null : String(amount),
      chain: listing.chain || 'solana',
    },
    funding: {
      state: unfunded ? 'unfunded' : 'declared',
      tx: null,
    },
    createdAt: listing.createdAt || null,
    deadline: listing.deadline || null,
    rules: {
      eligibility: listing.eligibility || '',
      submissionFormat: 'github_proof',
      text: listing.rules || '',
    },
    submissions: winners.map((winner) => ({
      schema: 'commons.submission/v1',
      id: winner.submissionId,
      bountyId: id,
      submitter: winner.identity,
      submittedAt: listing.createdAt || new Date(0).toISOString(),
      format: 'github_proof',
      proof: winner.proof,
      status: 'selected',
    })),
    winners: winners.map((winner) => ({
      submissionId: winner.submissionId,
      identity: winner.identity,
      selectedAt: winner.selectedAt,
    })),
    selectedAt: winners.length ? listing.createdAt || null : null,
    settlement: emptySettlement(),
    cancellation: emptyCancellation(),
    refund: emptyRefund(),
    history: [],
    seenEventIds: [],
    state,
    kind: listing.kind || (item ? 'item' : 'project'),
    source: {
      kind: origin,
      community,
      ref: listing.itemUrl || listing.repo || null,
      repo: listing.repo || (item && item.repo) || null,
      url: listing.itemUrl || null,
      feed: LEGACY_FEED_SCHEMA,
    },
  };
}

export function toLegacyListing(bounty) {
  if (!bounty || typeof bounty !== 'object') return null;
  const reward = bounty.reward || {};
  const creator = bounty.creator || {};
  const source = bounty.source || {};
  const payTo = bounty.creatorWallet || creator.wallet || null;
  const unfunded = !payTo || (bounty.funding && bounty.funding.state === 'unfunded');
  const outcomes = (bounty.winners || [])
    .map((winner, i) => {
      const submission = (bounty.submissions || []).find((row) => row.id === winner.submissionId);
      const url = (submission && submission.proof && submission.proof.url) || (winner.proof && winner.proof.url);
      if (!url) return null;
      return {
        login: (winner.identity && (winner.identity.handle || winner.identity.id)) || `winner-${i + 1}`,
        url,
      };
    })
    .filter(Boolean);
  const entry = {
    id: bounty.id,
    kind: bounty.kind || (source.url ? 'item' : 'project'),
    name: bounty.title,
    repo: source.repo || null,
    itemUrl: source.url || null,
    amount: reward.amount == null || reward.amount === '' ? null : Number(reward.amount),
    currency: reward.symbol || 'USDC',
    chain: reward.chain || 'solana',
    payTo: payTo || null,
    tokenMint: reward.mint || (reward.symbol === 'USDC' ? USDC_MINT : null),
    github: creator.kind === 'github' ? creator.id : '',
    x: '',
    createdAt: bounty.createdAt || null,
    eligibility: bounty.rules && bounty.rules.eligibility ? bounty.rules.eligibility : null,
    rules: bounty.rules && bounty.rules.text ? bounty.rules.text : null,
    outcomes,
  };
  if (unfunded) entry.payoutStatus = 'not_implemented';
  if (entry.kind === 'project' && Number.isFinite(entry.amount)) {
    entry.pool = { amount: entry.amount, currency: entry.currency };
  }
  return entry;
}

export function fromLegacyFeed(feed, extra = {}) {
  const community = extra.community != null ? extra.community : 'getdasha';
  const origin = extra.origin || (feed && feed.origin) || 'seed';
  const rows = rowsOf(feed);
  const bounties = [];
  rows.forEach((raw) => {
    const bounty = isCommonsBounty(raw) ? raw : fromLegacyListing(raw, { community, origin });
    if (bounty && bounty.id && bounty.title) bounties.push(bounty);
  });
  return {
    schema: FEED_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    source: {
      schema: (feed && feed.schema) || LEGACY_FEED_SCHEMA,
      community,
      url: (feed && feed.url) || DASHA_BOARD_URL,
      name: (feed && feed.name) || null,
      note: (feed && feed.note) || null,
    },
    generatedAt: (feed && (feed.generatedAt || feed.fetchedAt)) || null,
    bounties,
  };
}

export function toLegacyFeed(bountiesOrFeed, extra = {}) {
  const bounties = Array.isArray(bountiesOrFeed)
    ? bountiesOrFeed
    : bountiesOrFeed && Array.isArray(bountiesOrFeed.bounties)
      ? bountiesOrFeed.bounties
      : [];
  return {
    name: extra.name || 'dasha bounties',
    schema: LEGACY_FEED_SCHEMA,
    note: extra.note || "USDC on Solana. We don't hold it.",
    url: extra.url || DASHA_BOARD_URL,
    listings: bounties.map(toLegacyListing).filter(Boolean),
  };
}

export function consumeDashaFeed(feed) {
  return fromLegacyFeed(feed, { community: 'getdasha', origin: 'seed' });
}

export function emitDashaFeed(commonsFeed) {
  return toLegacyFeed(commonsFeed);
}
