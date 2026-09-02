/**
 * Strict getdasha compatibility profile: dasha-bounties-feed/v1 <-> Commons.
 * The generic Commons record stays token-agnostic, but this adapter accepts only
 * canonical Solana USDC rows because the current Dasha board is a USDC-only rail.
 */
import {
  BOUNTY_SCHEMA,
  FEED_SCHEMA,
  SCHEMA_VERSION,
  isCanonicalAmount,
  isIsoTime,
  isSolanaAddress,
  validateBounty,
} from './schema.mjs';
import { createBounty } from './machine.mjs';

export const LEGACY_FEED_SCHEMA = 'dasha-bounties-feed/v1';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DASHA_BOARD_URL = 'https://www.getdasha.com/bounties';
export const LIVE_FEED_URL = 'https://www.getdasha.com/bounties.json';
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

const ITEM_RE = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/(issues|pull)\/(\d+)/i;

function issue(path, msg) {
  return { path, msg };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseItem(url) {
  const match = String(url || '').trim().match(ITEM_RE);
  if (!match) return null;
  return {
    repo: `${match[1]}/${match[2]}`,
    type: match[3].toLowerCase() === 'pull' ? 'pull' : 'issues',
    number: Number(match[4]),
  };
}

export function legacyListingId(listing) {
  const item = listing && (listing.item || parseItem(listing.itemUrl));
  if (listing && listing.kind === 'item' && item) return (`item:${item.repo}/${item.type}/${item.number}`).toLowerCase();
  if (listing && listing.repo) return String(listing.repo).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').slice(0, 200);
  const slug = slugify(listing && (listing.name || listing.title));
  return slug ? `name:${slug}` : '';
}

function canonicalLegacyAmount(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(value * 1_000_000)) return null;
    value = String(value);
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  let [whole, fraction = ''] = raw.split('.');
  whole = whole.replace(/^0+(?=\d)/, '');
  fraction = fraction.replace(/0+$/, '');
  const amount = fraction ? `${whole}.${fraction}` : whole;
  if (!isCanonicalAmount(amount, 6)) return null;
  return amount;
}

function rowsOf(feed) {
  if (!feed) return [];
  if (Array.isArray(feed.listings)) return feed.listings;
  if (Array.isArray(feed.items)) return feed.items;
  if (Array.isArray(feed.bounties)) return feed.bounties;
  if (Array.isArray(feed)) return feed;
  return [];
}

export function isDashaUsdcReward(reward) {
  return Boolean(
    reward &&
      reward.chain === 'solana' &&
      reward.asset === 'spl' &&
      reward.symbol === 'USDC' &&
      reward.mint === USDC_MINT &&
      isCanonicalAmount(reward.amount, 6),
  );
}

export function isCommonsBounty(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema !== BOUNTY_SCHEMA || raw.schemaVersion !== SCHEMA_VERSION) return false;
  return validateBounty(raw).ok;
}

export function validateLegacyListing(listing) {
  const errors = [];
  if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
    return { ok: false, errors: [issue('', 'listing must be an object')], amount: null };
  }
  const title = listing.name || listing.title;
  if (typeof title !== 'string' || !title.trim()) errors.push(issue('name', 'title is required'));
  else if (title.length > 240) errors.push(issue('name', 'title is too long'));

  const directAmount = listing.amount != null ? canonicalLegacyAmount(listing.amount) : null;
  const poolAmount = listing.pool && listing.pool.amount != null ? canonicalLegacyAmount(listing.pool.amount) : null;
  const amount = directAmount || poolAmount;
  if (!amount) errors.push(issue('amount', 'canonical positive USDC amount with at most 6 decimals is required'));
  if (directAmount && poolAmount && directAmount !== poolAmount) errors.push(issue('pool.amount', 'must match listing amount'));
  if (listing.chain !== 'solana') errors.push(issue('chain', 'Dasha listings must explicitly use solana'));
  const currencies = [listing.currency, listing.pool && listing.pool.currency].filter((value) => value != null && value !== '');
  if (!currencies.length || currencies.some((value) => value !== 'USDC')) {
    errors.push(issue('currency', 'all declared currencies must be USDC'));
  }
  if (listing.tokenMint !== USDC_MINT) errors.push(issue('tokenMint', 'exact canonical Solana USDC mint is required'));
  if (!isIsoTime(listing.createdAt)) errors.push(issue('createdAt', 'ISO timestamp is required'));
  if (listing.payTo != null && listing.payTo !== '' && !isSolanaAddress(listing.payTo)) {
    errors.push(issue('payTo', 'must be a valid Solana address when present'));
  }
  if (listing.kind === 'item' && !parseItem(listing.itemUrl)) errors.push(issue('itemUrl', 'item listing needs a GitHub issue or pull request URL'));
  if (Array.isArray(listing.outcomes) && listing.outcomes.length) {
    errors.push(issue('outcomes', 'legacy outcomes lack confirmed funding and selection evidence and cannot be promoted to canonical state'));
  }
  return { ok: errors.length === 0, errors, amount };
}

function identityFromLegacy(listing) {
  const login = listing.github ? String(listing.github).trim() : '';
  const wallet = listing.payTo || null;
  if (login) return { kind: 'github', id: login, handle: login, wallet };
  if (wallet) return { kind: 'wallet', id: wallet, wallet, handle: null };
  return { kind: 'opaque', id: legacyListingId(listing), wallet: null, handle: null };
}

export function fromLegacyListing(listing, { community = 'getdasha', origin = 'seed' } = {}) {
  if (!listing || typeof listing !== 'object') return null;
  if (listing.schema === BOUNTY_SCHEMA) return isCommonsBounty(listing) ? structuredClone(listing) : null;
  const checked = validateLegacyListing(listing);
  if (!checked.ok) return null;
  const item = parseItem(listing.itemUrl);
  const payTo = listing.payTo || null;
  const bounty = createBounty({
    id: listing.id || legacyListingId(listing),
    title: listing.name || listing.title,
    description: listing.blurb || listing.pays || '',
    creator: identityFromLegacy(listing),
    creatorWallet: payTo,
    fundingDestination: null,
    settlementSource: payTo,
    reward: {
      asset: 'spl',
      symbol: 'USDC',
      mint: USDC_MINT,
      amount: checked.amount,
      chain: 'solana',
    },
    createdAt: listing.createdAt,
    deadline: listing.deadline || null,
    rules: {
      eligibility: listing.eligibility || '',
      submissionFormat: 'github_proof',
      text: listing.rules || '',
    },
    state: 'open',
    source: {
      kind: origin,
      community,
      ref: listing.itemUrl || listing.repo || null,
      repo: listing.repo || item && item.repo || null,
      url: listing.itemUrl || null,
      feed: LEGACY_FEED_SCHEMA,
    },
  });
  bounty.funding.state = payTo ? 'declared' : 'unfunded';
  const valid = validateBounty(bounty);
  return valid.ok ? bounty : null;
}

export function toLegacyListing(bounty) {
  const valid = validateBounty(bounty);
  if (!valid.ok || !isDashaUsdcReward(bounty.reward)) return null;
  const creator = bounty.creator || {};
  const source = bounty.source || {};
  const payTo = bounty.creatorWallet || creator.wallet || null;
  const outcomes = (bounty.winners || [])
    .map((winner) => {
      const submission = bounty.submissions.find((row) => row.id === winner.submissionId);
      const url = submission && submission.proof && submission.proof.url;
      if (!url) return null;
      return { login: winner.identity.handle || winner.identity.id, url };
    })
    .filter(Boolean);
  const amount = Number(bounty.reward.amount);
  if (!Number.isFinite(amount)) return null;
  const entry = {
    id: bounty.id,
    kind: bounty.kind || (source.url ? 'item' : 'project'),
    name: bounty.title,
    repo: source.repo || null,
    itemUrl: source.url || null,
    amount,
    currency: 'USDC',
    chain: 'solana',
    payTo,
    tokenMint: USDC_MINT,
    github: creator.kind === 'github' ? creator.id : '',
    x: '',
    createdAt: bounty.createdAt,
    eligibility: bounty.rules && bounty.rules.eligibility || null,
    rules: bounty.rules && bounty.rules.text || null,
    outcomes,
  };
  if (!payTo || bounty.funding.state === 'unfunded') entry.payoutStatus = 'not_implemented';
  if (entry.kind === 'project') entry.pool = { amount, currency: 'USDC' };
  return entry;
}

export function fromLegacyFeed(feed, extra = {}) {
  const community = extra.community != null ? extra.community : 'getdasha';
  const origin = extra.origin || feed && feed.origin || 'seed';
  const rows = rowsOf(feed);
  const bounties = [];
  const rejected = [];
  rows.forEach((raw, index) => {
    if (raw && raw.schema === BOUNTY_SCHEMA) {
      if (isCommonsBounty(raw)) bounties.push(structuredClone(raw));
      else rejected.push({ index, id: raw.id || null, errors: validateBounty(raw).errors });
      return;
    }
    const checked = validateLegacyListing(raw);
    const bounty = checked.ok ? fromLegacyListing(raw, { community, origin }) : null;
    if (bounty) bounties.push(bounty);
    else rejected.push({ index, id: raw && (raw.id || raw.name || raw.title) || null, errors: checked.errors });
  });
  return {
    schema: FEED_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    source: {
      schema: feed && feed.schema || LEGACY_FEED_SCHEMA,
      community,
      url: feed && feed.url || DASHA_BOARD_URL,
      name: feed && feed.name || null,
      note: feed && feed.note || null,
    },
    generatedAt: feed && (feed.generatedAt || feed.fetchedAt) || null,
    bounties,
    rejected,
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
