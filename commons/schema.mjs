/**
 * Token-agnostic Commons schemas. No community brand in required fields.
 *
 * Trust model v1 (do not hide this):
 *   creator funds bounty → participants submit work/proof →
 *   creator chooses winner → winner gets paid
 * No DAO, disputes, oracles, reputation, or escrow in v1.
 * Prefer user-signed settlement. This module never holds keys.
 */

/** Well-known USDC mint on Solana. Optional convenience — not a schema requirement. */
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const BOUNTY_SCHEMA = 'commons.bounty/v1';
export const SUBMISSION_SCHEMA = 'commons.submission/v1';
export const EVENT_SCHEMA = 'commons.event/v1';
export const TX_SCHEMA = 'commons.tx/v1';
export const FEED_SCHEMA = 'commons.bounty-feed/v1';
export const SCHEMA_VERSION = 1;

export const STATES = Object.freeze([
  'draft',
  'open',
  'funding_pending',
  'funded',
  'submission_open',
  'selection_pending',
  'selected',
  'settlement_pending',
  'paid',
  'cancelled',
  'refund_pending',
  'refunded',
  'failed',
]);

export const TERMINAL = Object.freeze(['paid', 'cancelled', 'refunded']);

export const EVENT_TYPES = Object.freeze([
  'publish',
  'start_funding',
  'observe_funding',
  'open_submissions',
  'submit',
  'close_submissions',
  'expire',
  'select_winner',
  'start_settlement',
  'observe_settlement',
  'cancel',
  'request_refund',
  'observe_refund',
  'fail',
  'retry_funding',
  'retry_settlement',
  'retry_refund',
]);

const STATE_SET = new Set(STATES);
const EVENT_SET = new Set(EVENT_TYPES);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{1,200}$/;
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;

export function isState(value) {
  return STATE_SET.has(value);
}

export function isEventType(value) {
  return EVENT_SET.has(value);
}

export function isIsoTime(value) {
  return typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value));
}

export function isId(value) {
  return typeof value === 'string' && ID_RE.test(value);
}

function fail(errors, path, msg) {
  errors.push({ path, msg });
}

function checkIdentity(identity, path, errors, { required = true } = {}) {
  if (identity == null) {
    if (required) fail(errors, path, 'missing identity');
    return;
  }
  if (typeof identity !== 'object') {
    fail(errors, path, 'identity must be an object');
    return;
  }
  const kind = identity.kind;
  if (kind !== 'wallet' && kind !== 'github' && kind !== 'opaque') {
    fail(errors, `${path}.kind`, 'kind must be wallet, github, or opaque');
  }
  if (!identity.id || typeof identity.id !== 'string') {
    fail(errors, `${path}.id`, 'id is required');
  }
  if (identity.wallet != null && typeof identity.wallet !== 'string') {
    fail(errors, `${path}.wallet`, 'wallet must be a string or omitted');
  }
}

export function validateTx(tx, { required = false } = {}) {
  const errors = [];
  if (tx == null) {
    if (required) errors.push({ path: '', msg: 'missing tx' });
    return { ok: errors.length === 0, errors };
  }
  if (typeof tx !== 'object') return { ok: false, errors: [{ path: '', msg: 'tx must be an object' }] };
  if (tx.schema && tx.schema !== TX_SCHEMA) fail(errors, 'schema', `expected ${TX_SCHEMA}`);
  if (!tx.signature || typeof tx.signature !== 'string') fail(errors, 'signature', 'signature is required');
  else if (!SIG_RE.test(tx.signature) && !/^[1-9A-HJ-NP-Za-km-z]{32,128}$/.test(tx.signature)) {
    fail(errors, 'signature', 'signature looks malformed');
  }
  if (tx.chain != null && typeof tx.chain !== 'string') fail(errors, 'chain', 'chain must be a string');
  if (tx.origin != null && tx.origin !== 'chain' && tx.origin !== 'app') {
    fail(errors, 'origin', 'origin must be chain or app');
  }
  const purpose = tx.purpose;
  if (purpose != null && !['funding', 'settlement', 'refund', 'other'].includes(purpose)) {
    fail(errors, 'purpose', 'unknown purpose');
  }
  return { ok: errors.length === 0, errors };
}

export function validateSubmission(submission) {
  const errors = [];
  if (!submission || typeof submission !== 'object') {
    return { ok: false, errors: [{ path: '', msg: 'submission must be an object' }] };
  }
  if (submission.schema && submission.schema !== SUBMISSION_SCHEMA) {
    fail(errors, 'schema', `expected ${SUBMISSION_SCHEMA}`);
  }
  if (!isId(submission.id)) fail(errors, 'id', 'stable id required');
  if (submission.bountyId != null && !isId(submission.bountyId)) fail(errors, 'bountyId', 'invalid bounty id');
  checkIdentity(submission.submitter, 'submitter', errors);
  if (!isIsoTime(submission.submittedAt)) fail(errors, 'submittedAt', 'ISO timestamp required');
  const format = submission.format;
  if (!['url', 'text', 'github_proof', 'other'].includes(format)) {
    fail(errors, 'format', 'format must be url, text, github_proof, or other');
  }
  const proof = submission.proof;
  if (!proof || typeof proof !== 'object') {
    fail(errors, 'proof', 'proof is required');
  } else {
    const url = proof.url != null ? String(proof.url).trim() : '';
    const text = proof.text != null ? String(proof.text).trim() : '';
    const ref = proof.ref != null ? String(proof.ref).trim() : '';
    if (!url && !text && !ref) fail(errors, 'proof', 'proof needs url, text, or ref');
    if (format === 'url' && !/^https?:\/\//i.test(url)) fail(errors, 'proof.url', 'url proof needs an http(s) url');
    if (format === 'github_proof' && !/^https?:\/\/(?:www\.)?github\.com\//i.test(url)) {
      fail(errors, 'proof.url', 'github_proof needs a GitHub url');
    }
    if (format === 'text' && !text) fail(errors, 'proof.text', 'text proof is empty');
  }
  if (submission.status != null && !['received', 'rejected', 'selected', 'withdrawn'].includes(submission.status)) {
    fail(errors, 'status', 'unknown status');
  }
  return { ok: errors.length === 0, errors };
}

export function validateEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object') {
    return { ok: false, errors: [{ path: '', msg: 'event must be an object' }] };
  }
  if (event.schema && event.schema !== EVENT_SCHEMA) fail(errors, 'schema', `expected ${EVENT_SCHEMA}`);
  if (!isId(event.id)) fail(errors, 'id', 'stable id required');
  if (!isEventType(event.type)) fail(errors, 'type', 'unknown event type');
  if (!isIsoTime(event.ts)) fail(errors, 'ts', 'ISO timestamp required');
  if (!event.idempotencyKey || typeof event.idempotencyKey !== 'string') {
    fail(errors, 'idempotencyKey', 'idempotencyKey is required');
  }
  if (event.origin != null && event.origin !== 'chain' && event.origin !== 'app') {
    fail(errors, 'origin', 'origin must be chain or app');
  }
  if (event.tx != null) {
    const tx = validateTx(event.tx);
    if (!tx.ok) tx.errors.forEach((e) => fail(errors, e.path ? `tx.${e.path}` : 'tx', e.msg));
  }
  if (event.render != null) {
    if (typeof event.render !== 'object' || !event.render.title) {
      fail(errors, 'render', 'render needs a title');
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateBounty(bounty) {
  const errors = [];
  if (!bounty || typeof bounty !== 'object') {
    return { ok: false, errors: [{ path: '', msg: 'bounty must be an object' }] };
  }
  if (bounty.schema !== BOUNTY_SCHEMA) fail(errors, 'schema', `expected ${BOUNTY_SCHEMA}`);
  if (bounty.schemaVersion !== SCHEMA_VERSION) fail(errors, 'schemaVersion', `expected ${SCHEMA_VERSION}`);
  if (!isId(bounty.id)) fail(errors, 'id', 'stable id required');
  if (!bounty.title || typeof bounty.title !== 'string') fail(errors, 'title', 'title is required');
  if (bounty.description != null && typeof bounty.description !== 'string') {
    fail(errors, 'description', 'description must be a string');
  }
  checkIdentity(bounty.creator, 'creator', errors);
  if (bounty.creatorWallet != null && typeof bounty.creatorWallet !== 'string') {
    fail(errors, 'creatorWallet', 'creatorWallet must be a string or omitted');
  }
  const reward = bounty.reward;
  if (!reward || typeof reward !== 'object') {
    fail(errors, 'reward', 'reward is required');
  } else {
    if (!['spl', 'sol', 'other'].includes(reward.asset)) fail(errors, 'reward.asset', 'asset must be spl, sol, or other');
    if (!reward.symbol || typeof reward.symbol !== 'string') fail(errors, 'reward.symbol', 'symbol is required');
    if (reward.amount == null || String(reward.amount).trim() === '' || Number(reward.amount) < 0) {
      fail(errors, 'reward.amount', 'amount must be a non-negative number string');
    }
    if (reward.asset === 'spl' && (!reward.mint || typeof reward.mint !== 'string')) {
      fail(errors, 'reward.mint', 'spl reward needs a mint');
    }
    if (reward.chain != null && typeof reward.chain !== 'string') fail(errors, 'reward.chain', 'chain must be a string');
  }
  if (!isState(bounty.state)) fail(errors, 'state', 'unknown state');
  if (!isIsoTime(bounty.createdAt)) fail(errors, 'createdAt', 'ISO timestamp required');
  if (bounty.deadline != null && !isIsoTime(bounty.deadline)) fail(errors, 'deadline', 'deadline must be ISO or omitted');
  if (!Array.isArray(bounty.submissions)) fail(errors, 'submissions', 'submissions must be an array');
  else {
    bounty.submissions.forEach((row, i) => {
      const v = validateSubmission(row);
      if (!v.ok) v.errors.forEach((e) => fail(errors, `submissions[${i}].${e.path}`, e.msg));
    });
  }
  if (!Array.isArray(bounty.winners)) fail(errors, 'winners', 'winners must be an array');
  if (!Array.isArray(bounty.history)) fail(errors, 'history', 'history must be an array');
  if (!Array.isArray(bounty.seenEventIds)) fail(errors, 'seenEventIds', 'seenEventIds must be an array');
  if (!bounty.source || typeof bounty.source !== 'object') fail(errors, 'source', 'source is required');
  else if (bounty.source.community != null && typeof bounty.source.community !== 'string') {
    fail(errors, 'source.community', 'community must be a string or omitted');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Chain observer port. Implementations may use public RPC, Helius, or anything else.
 * Commons must not import a provider SDK.
 */
export const ChainObserver = Object.freeze({
  name: 'commons.chain-observer/v1',
  async observeTx(_signature) {
    throw new Error('ChainObserver.observeTx is not implemented — inject a provider');
  },
  async subscribe(_address) {
    throw new Error('ChainObserver.subscribe is not implemented — inject a provider');
  },
});

export function emptyFunding() {
  return { state: 'unfunded', tx: null };
}

export function emptySettlement() {
  return { state: 'none', tx: null };
}

export function emptyCancellation() {
  return { state: 'none', reason: null, at: null };
}

export function emptyRefund() {
  return { state: 'none', tx: null, reason: null };
}

export function emptyRules() {
  return { eligibility: '', submissionFormat: 'url', text: '' };
}

export function nowIso(date = new Date()) {
  return new Date(date).toISOString();
}
