/**
 * Token-agnostic Commons schemas. The reducer consumes trusted observations;
 * a signature alone is never confirmed funding, settlement, or refund evidence.
 */
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
  'reconcile_funding',
  'reconcile_settlement',
  'reconcile_refund',
  'retry_funding',
  'retry_settlement',
  'retry_refund',
]);

const STATE_SET = new Set(STATES);
const EVENT_SET = new Set(EVENT_TYPES);
const OBSERVE_TYPES = new Set(['observe_funding', 'observe_settlement', 'observe_refund']);
const RECONCILE_TYPES = new Set(['reconcile_funding', 'reconcile_settlement', 'reconcile_refund']);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;
const KEY_MAX = 200;
const HISTORY_MAX = 2000;
const EVENT_MAX = 2000;
const TITLE_MAX = 240;
const TEXT_MAX = 20_000;

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

export function isSolanaAddress(value) {
  return typeof value === 'string' && value.length >= 32 && value.length <= 44 && BASE58_RE.test(value);
}

/** Canonical positive decimal: no sign, exponent, leading zero, or trailing fractional zero. */
export function isCanonicalAmount(value, maxDecimals = 18) {
  if (typeof value !== 'string' || maxDecimals < 0 || maxDecimals > 18) return false;
  if (!/^(?:[1-9]\d{0,17}|(?:0|[1-9]\d{0,17})\.\d{0,17}[1-9])$/.test(value)) return false;
  const [, fraction = ''] = value.split('.');
  return fraction.length <= maxDecimals;
}

export function sameIdentity(a, b) {
  if (!a || !b) return false;
  return a.kind === b.kind && a.id === b.id && (a.wallet || null) === (b.wallet || null);
}

function fail(errors, path, msg) {
  errors.push({ path, msg });
}

function checkString(value, path, errors, { required = false, max = TEXT_MAX } = {}) {
  if (value == null || value === '') {
    if (required) fail(errors, path, 'is required');
    return;
  }
  if (typeof value !== 'string') fail(errors, path, 'must be a string');
  else if (value.length > max) fail(errors, path, `must be at most ${max} characters`);
}

function checkIdentity(identity, path, errors, { required = true } = {}) {
  if (identity == null) {
    if (required) fail(errors, path, 'missing identity');
    return;
  }
  if (typeof identity !== 'object' || Array.isArray(identity)) {
    fail(errors, path, 'identity must be an object');
    return;
  }
  if (!['wallet', 'github', 'opaque'].includes(identity.kind)) {
    fail(errors, `${path}.kind`, 'kind must be wallet, github, or opaque');
  }
  checkString(identity.id, `${path}.id`, errors, { required: true, max: 200 });
  checkString(identity.wallet, `${path}.wallet`, errors, { max: 200 });
  checkString(identity.handle, `${path}.handle`, errors, { max: 200 });
}

function checkReward(reward, path, errors) {
  if (!reward || typeof reward !== 'object' || Array.isArray(reward)) {
    fail(errors, path, 'reward is required');
    return;
  }
  if (!['spl', 'sol', 'other'].includes(reward.asset)) fail(errors, `${path}.asset`, 'asset must be spl, sol, or other');
  checkString(reward.symbol, `${path}.symbol`, errors, { required: true, max: 16 });
  if (!isCanonicalAmount(reward.amount)) {
    fail(errors, `${path}.amount`, 'must be a canonical positive decimal string with at most 18 decimals');
  }
  checkString(reward.chain, `${path}.chain`, errors, { required: true, max: 40 });
  if (reward.asset === 'spl') {
    checkString(reward.mint, `${path}.mint`, errors, { required: true, max: 200 });
    if (reward.chain === 'solana' && !isSolanaAddress(reward.mint)) {
      fail(errors, `${path}.mint`, 'must be a valid Solana mint address');
    }
  } else if (reward.mint != null && reward.mint !== '') {
    fail(errors, `${path}.mint`, 'mint is only valid for spl rewards');
  }
}

export function validateTx(tx, { required = false, statuses = null } = {}) {
  const errors = [];
  if (tx == null) {
    if (required) fail(errors, '', 'missing tx');
    return { ok: errors.length === 0, errors };
  }
  if (typeof tx !== 'object' || Array.isArray(tx)) {
    return { ok: false, errors: [{ path: '', msg: 'tx must be an object' }] };
  }
  if (tx.schema !== TX_SCHEMA) fail(errors, 'schema', `expected ${TX_SCHEMA}`);
  if (typeof tx.signature !== 'string' || !SIG_RE.test(tx.signature)) {
    fail(errors, 'signature', 'must be a 64-128 character base58 signature');
  }
  checkString(tx.chain, 'chain', errors, { required: true, max: 40 });
  if (!['funding', 'settlement', 'refund'].includes(tx.purpose)) fail(errors, 'purpose', 'unknown purpose');
  if (!['submitted', 'confirmed', 'failed', 'not_found'].includes(tx.status)) {
    fail(errors, 'status', 'status must be submitted, confirmed, failed, or not_found');
  }
  if (statuses && !statuses.includes(tx.status)) fail(errors, 'status', `expected ${statuses.join(' or ')}`);
  checkString(tx.source, 'source', errors, { required: true, max: 200 });
  checkString(tx.destination, 'destination', errors, { required: true, max: 200 });
  if (!['spl', 'sol', 'other'].includes(tx.asset)) fail(errors, 'asset', 'asset must be spl, sol, or other');
  checkString(tx.symbol, 'symbol', errors, { required: true, max: 16 });
  if (!isCanonicalAmount(tx.amount)) fail(errors, 'amount', 'must be a canonical positive decimal string');
  if (tx.asset === 'spl') checkString(tx.mint, 'mint', errors, { required: true, max: 200 });
  else if (tx.mint != null && tx.mint !== '') fail(errors, 'mint', 'mint is only valid for spl transfers');
  if (tx.chain === 'solana') {
    if (!isSolanaAddress(tx.source)) fail(errors, 'source', 'must be a valid Solana address');
    if (!isSolanaAddress(tx.destination)) fail(errors, 'destination', 'must be a valid Solana address');
    if (tx.asset === 'spl' && !isSolanaAddress(tx.mint)) fail(errors, 'mint', 'must be a valid Solana mint address');
  }
  if (tx.status === 'submitted') {
    if (tx.success != null) fail(errors, 'success', 'must be omitted for a submitted tx');
    if (tx.slot != null) fail(errors, 'slot', 'must be omitted for a submitted tx');
    if (tx.commitment != null) fail(errors, 'commitment', 'must be omitted for a submitted tx');
  } else {
    checkString(tx.observedBy, 'observedBy', errors, { required: true, max: 200 });
    if (tx.status === 'confirmed') {
      if (tx.success !== true) fail(errors, 'success', 'confirmed tx must have success true');
      if (!Number.isSafeInteger(tx.slot) || tx.slot < 0) fail(errors, 'slot', 'confirmed tx needs a non-negative safe integer slot');
      if (!['confirmed', 'finalized'].includes(tx.commitment)) {
        fail(errors, 'commitment', 'confirmed tx needs confirmed or finalized commitment');
      }
    } else {
      if (tx.success !== false) fail(errors, 'success', `${tx.status} tx must have success false`);
      if (tx.slot != null && (!Number.isSafeInteger(tx.slot) || tx.slot < 0)) {
        fail(errors, 'slot', 'slot must be a non-negative safe integer when present');
      }
      if (tx.commitment != null && !['confirmed', 'finalized'].includes(tx.commitment)) {
        fail(errors, 'commitment', 'commitment must be confirmed or finalized when present');
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateSubmission(submission) {
  const errors = [];
  if (!submission || typeof submission !== 'object' || Array.isArray(submission)) {
    return { ok: false, errors: [{ path: '', msg: 'submission must be an object' }] };
  }
  if (submission.schema !== SUBMISSION_SCHEMA) fail(errors, 'schema', `expected ${SUBMISSION_SCHEMA}`);
  if (!isId(submission.id)) fail(errors, 'id', 'stable id required');
  if (!isId(submission.bountyId)) fail(errors, 'bountyId', 'stable bounty id required');
  checkIdentity(submission.submitter, 'submitter', errors);
  if (!isIsoTime(submission.submittedAt)) fail(errors, 'submittedAt', 'ISO timestamp required');
  if (!['url', 'text', 'github_proof', 'other'].includes(submission.format)) {
    fail(errors, 'format', 'format must be url, text, github_proof, or other');
  }
  const proof = submission.proof;
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) fail(errors, 'proof', 'proof is required');
  else {
    const url = proof.url != null ? String(proof.url).trim() : '';
    const text = proof.text != null ? String(proof.text).trim() : '';
    const ref = proof.ref != null ? String(proof.ref).trim() : '';
    if (!url && !text && !ref) fail(errors, 'proof', 'proof needs url, text, or ref');
    if (url.length > 4000 || text.length > TEXT_MAX || ref.length > 1000) fail(errors, 'proof', 'proof is too large');
    if (submission.format === 'url' && !/^https?:\/\//i.test(url)) fail(errors, 'proof.url', 'url proof needs an http(s) url');
    if (submission.format === 'github_proof' && !/^https?:\/\/(?:www\.)?github\.com\//i.test(url)) {
      fail(errors, 'proof.url', 'github_proof needs a GitHub url');
    }
    if (submission.format === 'text' && !text) fail(errors, 'proof.text', 'text proof is empty');
  }
  if (submission.status != null && !['received', 'rejected', 'selected', 'withdrawn'].includes(submission.status)) {
    fail(errors, 'status', 'unknown status');
  }
  return { ok: errors.length === 0, errors };
}

export function validateEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, errors: [{ path: '', msg: 'event must be an object' }] };
  }
  if (event.schema !== EVENT_SCHEMA) fail(errors, 'schema', `expected ${EVENT_SCHEMA}`);
  if (!isId(event.id)) fail(errors, 'id', 'stable id required');
  if (!isEventType(event.type)) fail(errors, 'type', 'unknown event type');
  if (!isId(event.bountyId)) fail(errors, 'bountyId', 'stable bounty id required');
  if (!isIsoTime(event.ts)) fail(errors, 'ts', 'ISO timestamp required');
  if (typeof event.idempotencyKey !== 'string' || event.idempotencyKey.length < 1 || event.idempotencyKey.length > KEY_MAX) {
    fail(errors, 'idempotencyKey', `must be 1-${KEY_MAX} characters`);
  }
  if (!['chain', 'app'].includes(event.origin)) fail(errors, 'origin', 'origin must be chain or app');
  if (event.tx != null) {
    const tx = validateTx(event.tx);
    if (!tx.ok) tx.errors.forEach((e) => fail(errors, e.path ? `tx.${e.path}` : 'tx', e.msg));
  }
  if (OBSERVE_TYPES.has(event.type)) {
    if (event.origin !== 'chain') fail(errors, 'origin', 'confirmed observation must originate from chain evidence');
    const tx = validateTx(event.tx, { required: true, statuses: ['confirmed'] });
    if (!tx.ok) tx.errors.forEach((e) => fail(errors, e.path ? `tx.${e.path}` : 'tx', e.msg));
  }
  if (RECONCILE_TYPES.has(event.type)) {
    if (event.origin !== 'chain') fail(errors, 'origin', 'reconciliation must originate from chain evidence');
    const tx = validateTx(event.tx, { required: true, statuses: ['failed', 'not_found'] });
    if (!tx.ok) tx.errors.forEach((e) => fail(errors, e.path ? `tx.${e.path}` : 'tx', e.msg));
  }
  if (event.type.startsWith('start_') && event.tx != null && event.tx.status !== 'submitted') {
    fail(errors, 'tx.status', 'start event tx must be submitted');
  }
  if (event.render != null && (typeof event.render !== 'object' || typeof event.render.title !== 'string')) {
    fail(errors, 'render', 'render needs a title');
  }
  return { ok: errors.length === 0, errors };
}

function validateStage(stage, name, states, errors) {
  if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
    fail(errors, name, `${name} is required`);
    return;
  }
  if (!states.includes(stage.state)) fail(errors, `${name}.state`, `unknown ${name} state`);
  if (stage.tx != null) {
    const tx = validateTx(stage.tx);
    if (!tx.ok) tx.errors.forEach((e) => fail(errors, `${name}.tx${e.path ? `.${e.path}` : ''}`, e.msg));
  }
  if (stage.reconciliation != null) {
    const tx = validateTx(stage.reconciliation, { statuses: ['failed', 'not_found'] });
    if (!tx.ok) tx.errors.forEach((e) => fail(errors, `${name}.reconciliation${e.path ? `.${e.path}` : ''}`, e.msg));
  }
}

export function validateBounty(bounty) {
  const errors = [];
  if (!bounty || typeof bounty !== 'object' || Array.isArray(bounty)) {
    return { ok: false, errors: [{ path: '', msg: 'bounty must be an object' }] };
  }
  if (bounty.schema !== BOUNTY_SCHEMA) fail(errors, 'schema', `expected ${BOUNTY_SCHEMA}`);
  if (bounty.schemaVersion !== SCHEMA_VERSION) fail(errors, 'schemaVersion', `expected ${SCHEMA_VERSION}`);
  if (!isId(bounty.id)) fail(errors, 'id', 'stable id required');
  checkString(bounty.title, 'title', errors, { required: true, max: TITLE_MAX });
  checkString(bounty.description, 'description', errors, { max: TEXT_MAX });
  checkIdentity(bounty.creator, 'creator', errors);
  checkString(bounty.creatorWallet, 'creatorWallet', errors, { max: 200 });
  checkString(bounty.fundingDestination, 'fundingDestination', errors, { max: 200 });
  checkString(bounty.settlementSource, 'settlementSource', errors, { max: 200 });
  checkReward(bounty.reward, 'reward', errors);
  if (bounty.reward && bounty.reward.chain === 'solana') {
    if (bounty.creatorWallet && !isSolanaAddress(bounty.creatorWallet)) fail(errors, 'creatorWallet', 'must be a valid Solana address');
    if (bounty.fundingDestination && !isSolanaAddress(bounty.fundingDestination)) {
      fail(errors, 'fundingDestination', 'must be a valid Solana address');
    }
    if (bounty.settlementSource && !isSolanaAddress(bounty.settlementSource)) {
      fail(errors, 'settlementSource', 'must be a valid Solana address');
    }
  }
  if (!isState(bounty.state)) fail(errors, 'state', 'unknown state');
  if (!isIsoTime(bounty.createdAt)) fail(errors, 'createdAt', 'ISO timestamp required');
  if (bounty.deadline != null && !isIsoTime(bounty.deadline)) fail(errors, 'deadline', 'deadline must be ISO or omitted');
  if (!bounty.rules || typeof bounty.rules !== 'object') fail(errors, 'rules', 'rules are required');

  validateStage(bounty.funding, 'funding', ['unfunded', 'declared', 'pending', 'reconcile_required', 'failed', 'funded'], errors);
  validateStage(bounty.settlement, 'settlement', ['none', 'pending', 'reconcile_required', 'failed', 'paid'], errors);
  validateStage(bounty.refund, 'refund', ['none', 'pending', 'reconcile_required', 'failed', 'refunded'], errors);

  const stageSpecs = [
    { name: 'funding', stage: bounty.funding, purpose: 'funding', empty: ['unfunded', 'declared'], terminal: 'funded' },
    { name: 'settlement', stage: bounty.settlement, purpose: 'settlement', empty: ['none'], terminal: 'paid' },
    { name: 'refund', stage: bounty.refund, purpose: 'refund', empty: ['none'], terminal: 'refunded' },
  ];
  stageSpecs.forEach(({ name, stage, purpose, empty, terminal }) => {
    if (!stage || typeof stage !== 'object') return;
    if (stage.tx && stage.tx.purpose !== purpose) fail(errors, `${name}.tx.purpose`, `expected ${purpose}`);
    if (stage.reconciliation && stage.reconciliation.purpose !== purpose) {
      fail(errors, `${name}.reconciliation.purpose`, `expected ${purpose}`);
    }
    if (empty.includes(stage.state) && (stage.tx != null || stage.reconciliation != null)) {
      fail(errors, name, `${stage.state} stage cannot carry transaction evidence`);
    }
    if (stage.state === 'pending' && stage.tx != null && stage.tx.status !== 'submitted') {
      fail(errors, `${name}.tx.status`, 'pending stage may only carry a submitted candidate');
    }
    if (stage.state === 'reconcile_required') {
      if (!stage.tx || stage.tx.status !== 'submitted') {
        fail(errors, `${name}.tx`, 'reconciliation-required stage needs the ambiguous submitted candidate');
      }
      if (stage.reconciliation != null) fail(errors, `${name}.reconciliation`, 'must be empty until reconciliation completes');
    }
    if (stage.state === 'failed' && stage.tx != null && stage.tx.status !== 'submitted') {
      fail(errors, `${name}.tx.status`, 'failed stage preserves the submitted candidate, not a confirmed transfer');
    }
    if (stage.state === terminal && (!stage.tx || stage.tx.status !== 'confirmed')) {
      fail(errors, `${name}.tx`, `${terminal} stage requires a confirmed transaction`);
    }
  });

  if (!Array.isArray(bounty.submissions)) fail(errors, 'submissions', 'submissions must be an array');
  else {
    const ids = new Set();
    bounty.submissions.forEach((row, i) => {
      const v = validateSubmission(row);
      if (!v.ok) v.errors.forEach((e) => fail(errors, `submissions[${i}]${e.path ? `.${e.path}` : ''}`, e.msg));
      if (row && row.bountyId !== bounty.id) fail(errors, `submissions[${i}].bountyId`, 'must match bounty id');
      if (row && ids.has(row.id)) fail(errors, `submissions[${i}].id`, 'duplicate submission id');
      if (row) ids.add(row.id);
    });
  }
  if (!Array.isArray(bounty.winners)) fail(errors, 'winners', 'winners must be an array');
  else {
    if (bounty.winners.length > 1) fail(errors, 'winners', 'v1 supports exactly one winner');
    bounty.winners.forEach((winner, i) => {
      if (!winner || typeof winner !== 'object') {
        fail(errors, `winners[${i}]`, 'winner must be an object');
        return;
      }
      if (!isId(winner.submissionId)) fail(errors, `winners[${i}].submissionId`, 'submission id required');
      if (!isIsoTime(winner.selectedAt)) fail(errors, `winners[${i}].selectedAt`, 'ISO timestamp required');
      checkIdentity(winner.identity, `winners[${i}].identity`, errors);
      const submission = Array.isArray(bounty.submissions) ? bounty.submissions.find((row) => row.id === winner.submissionId) : null;
      if (!submission) fail(errors, `winners[${i}].submissionId`, 'must reference an existing submission');
      else if (!sameIdentity(winner.identity, submission.submitter)) {
        fail(errors, `winners[${i}].identity`, 'must match the referenced submitter');
      }
    });
  }
  if (bounty.selectedAt != null && !isIsoTime(bounty.selectedAt)) fail(errors, 'selectedAt', 'must be ISO or omitted');
  if (!bounty.cancellation || typeof bounty.cancellation !== 'object') fail(errors, 'cancellation', 'cancellation is required');
  if (!Array.isArray(bounty.history)) fail(errors, 'history', 'history must be an array');
  else {
    if (bounty.history.length > HISTORY_MAX) fail(errors, 'history', `must contain at most ${HISTORY_MAX} records`);
    bounty.history.forEach((tx, i) => {
      const v = validateTx(tx);
      if (!v.ok) v.errors.forEach((e) => fail(errors, `history[${i}]${e.path ? `.${e.path}` : ''}`, e.msg));
    });
  }
  if (!Array.isArray(bounty.seenEventIds)) fail(errors, 'seenEventIds', 'seenEventIds must be an array');
  else {
    if (bounty.seenEventIds.length > EVENT_MAX) fail(errors, 'seenEventIds', `must contain at most ${EVENT_MAX} keys`);
    if (new Set(bounty.seenEventIds).size !== bounty.seenEventIds.length) fail(errors, 'seenEventIds', 'contains duplicate keys');
    bounty.seenEventIds.forEach((key, i) => {
      if (typeof key !== 'string' || key.length < 1 || key.length > KEY_MAX) fail(errors, `seenEventIds[${i}]`, 'invalid key');
    });
  }
  if (!bounty.seenEvents || typeof bounty.seenEvents !== 'object' || Array.isArray(bounty.seenEvents)) {
    fail(errors, 'seenEvents', 'seenEvents must be an object');
  } else if (Array.isArray(bounty.seenEventIds)) {
    const keys = Object.keys(bounty.seenEvents);
    if (keys.length !== bounty.seenEventIds.length || keys.some((key) => !bounty.seenEventIds.includes(key))) {
      fail(errors, 'seenEvents', 'keys must exactly match seenEventIds');
    }
    keys.forEach((key) => {
      if (typeof bounty.seenEvents[key] !== 'string') fail(errors, `seenEvents.${key}`, 'fingerprint must be a string');
    });
  }
  if (!bounty.source || typeof bounty.source !== 'object' || Array.isArray(bounty.source)) fail(errors, 'source', 'source is required');

  const fundedStates = new Set(['funded', 'submission_open', 'selection_pending', 'selected', 'settlement_pending', 'paid', 'refund_pending', 'refunded']);
  if (fundedStates.has(bounty.state) && bounty.funding && bounty.funding.state !== 'funded') {
    fail(errors, 'funding.state', `${bounty.state} requires confirmed funding`);
  }
  if (bounty.state === 'funding_pending' && bounty.funding && bounty.funding.state !== 'pending') {
    fail(errors, 'funding.state', 'funding_pending requires pending funding');
  }
  if (bounty.funding && bounty.funding.state === 'funded') {
    const v = validateTx(bounty.funding.tx, { required: true, statuses: ['confirmed'] });
    if (!v.ok) v.errors.forEach((e) => fail(errors, `funding.tx${e.path ? `.${e.path}` : ''}`, e.msg));
  }
  const winnerStates = new Set(['selected', 'settlement_pending', 'paid']);
  if (winnerStates.has(bounty.state) && (!Array.isArray(bounty.winners) || bounty.winners.length !== 1)) {
    fail(errors, 'winners', `${bounty.state} requires exactly one winner`);
  }
  if (bounty.state === 'settlement_pending' && bounty.settlement && bounty.settlement.state !== 'pending') {
    fail(errors, 'settlement.state', 'settlement_pending requires pending settlement');
  }
  if (bounty.state === 'paid' && bounty.settlement && bounty.settlement.state !== 'paid') {
    fail(errors, 'settlement.state', 'paid requires confirmed settlement');
  }
  if (bounty.settlement && bounty.settlement.state === 'paid') {
    const v = validateTx(bounty.settlement.tx, { required: true, statuses: ['confirmed'] });
    if (!v.ok) v.errors.forEach((e) => fail(errors, `settlement.tx${e.path ? `.${e.path}` : ''}`, e.msg));
  }
  if (bounty.state === 'refund_pending' && bounty.refund && !['pending', 'reconcile_required'].includes(bounty.refund.state)) {
    fail(errors, 'refund.state', 'refund_pending requires a pending or reconciliation-required refund');
  }
  if (bounty.state === 'refunded' && bounty.refund && bounty.refund.state !== 'refunded') {
    fail(errors, 'refund.state', 'refunded requires a confirmed refund');
  }
  if (bounty.refund && bounty.refund.state === 'refunded') {
    const v = validateTx(bounty.refund.tx, { required: true, statuses: ['confirmed'] });
    if (!v.ok) v.errors.forEach((e) => fail(errors, `refund.tx${e.path ? `.${e.path}` : ''}`, e.msg));
  }
  if (bounty.state === 'failed') {
    const stages = [bounty.funding, bounty.settlement, bounty.refund];
    if (!stages.some((stage) => stage && ['failed', 'reconcile_required'].includes(stage.state))) {
      fail(errors, 'state', 'failed requires a failed or reconciliation-required stage');
    }
  }
  if (bounty.funding && bounty.funding.state === 'funded' && ['draft', 'open', 'funding_pending', 'cancelled'].includes(bounty.state)) {
    fail(errors, 'state', `confirmed funding is inconsistent with ${bounty.state}`);
  }
  if (bounty.settlement && bounty.settlement.state === 'paid' && bounty.state !== 'paid') {
    fail(errors, 'state', 'confirmed settlement requires paid state');
  }
  if (bounty.refund && bounty.refund.state === 'refunded' && bounty.state !== 'refunded') {
    fail(errors, 'state', 'confirmed refund requires refunded state');
  }
  if (bounty.state === 'cancelled' && bounty.funding && bounty.funding.state === 'funded') {
    fail(errors, 'state', 'a funded cancellation must proceed through refund_pending');
  }
  if (bounty.state === 'selection_pending' && Array.isArray(bounty.submissions) && bounty.submissions.length === 0) {
    fail(errors, 'submissions', 'selection_pending requires at least one submission');
  }
  return { ok: errors.length === 0, errors };
}

export const ChainObserver = Object.freeze({
  name: 'commons.chain-observer/v1',
  async observeTx(_signature) {
    throw new Error('ChainObserver.observeTx is not implemented - inject a provider');
  },
  async subscribe(_address) {
    throw new Error('ChainObserver.subscribe is not implemented - inject a provider');
  },
});

export function emptyFunding() {
  return { state: 'unfunded', tx: null, reconciliation: null };
}

export function emptySettlement() {
  return { state: 'none', tx: null, reconciliation: null };
}

export function emptyCancellation() {
  return { state: 'none', reason: null, at: null };
}

export function emptyRefund() {
  return { state: 'none', tx: null, reconciliation: null, reason: null };
}

export function emptyRules() {
  return { eligibility: '', submissionFormat: 'url', text: '' };
}

export function nowIso(date = new Date()) {
  return new Date(date).toISOString();
}
