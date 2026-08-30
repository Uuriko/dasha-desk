/**
 * Explicit v1 state machine. Creator funds, workers submit, creator selects, winner is paid.
 * Future (not implemented): multiple winners, judges, voting, oracles, milestones,
 * SPL/SOL/stablecoin beyond the reward record, API/SDK, embeddable cards, third-party communities.
 */
import {
  BOUNTY_SCHEMA,
  SCHEMA_VERSION,
  STATES,
  TERMINAL,
  emptyCancellation,
  emptyFunding,
  emptyRefund,
  emptyRules,
  emptySettlement,
  isState,
  nowIso,
  validateBounty,
  validateEvent,
  validateSubmission,
} from './schema.mjs';

export { STATES, TERMINAL };

const TABLE = Object.freeze({
  publish: { from: ['draft'], to: 'open' },
  start_funding: { from: ['open'], to: 'funding_pending' },
  observe_funding: { from: ['funding_pending'], to: 'funded' },
  open_submissions: { from: ['funded'], to: 'submission_open' },
  close_submissions: { from: ['submission_open'], to: 'selection_pending' },
  select_winner: { from: ['selection_pending'], to: 'selected' },
  start_settlement: { from: ['selected', 'failed'], to: 'settlement_pending' },
  observe_settlement: { from: ['settlement_pending'], to: 'paid' },
  request_refund: { from: ['cancelled', 'funded', 'submission_open', 'selection_pending', 'selected'], to: 'refund_pending' },
  observe_refund: { from: ['refund_pending'], to: 'refunded' },
  fail: { from: ['funding_pending', 'settlement_pending', 'refund_pending'], to: 'failed' },
  retry_funding: { from: ['failed'], to: 'funding_pending' },
  retry_settlement: { from: ['failed'], to: 'settlement_pending' },
  retry_refund: { from: ['failed'], to: 'refund_pending' },
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameTx(a, b) {
  return Boolean(a && b && a.signature && a.signature === b.signature);
}

function funded(bounty) {
  return Boolean(bounty.funding && (bounty.funding.state === 'funded' || bounty.funding.tx));
}

function cancelTarget(bounty) {
  return funded(bounty) ? 'refund_pending' : 'cancelled';
}

export function canTransition(from, type, bounty) {
  if (type === 'cancel') {
    return ['draft', 'open', 'funding_pending', 'funded', 'submission_open', 'selection_pending', 'selected'].includes(from);
  }
  if (type === 'expire') return from === 'submission_open' || from === 'open';
  if (type === 'submit') return from === 'submission_open';
  const row = TABLE[type];
  if (!row) return false;
  if (type === 'start_settlement' && from === 'failed') {
    return bounty && bounty.settlement && bounty.settlement.state === 'failed';
  }
  if (type === 'retry_funding' && from === 'failed') {
    return bounty && bounty.funding && bounty.funding.state === 'failed';
  }
  if (type === 'retry_settlement' && from === 'failed') {
    return bounty && bounty.settlement && bounty.settlement.state === 'failed';
  }
  if (type === 'retry_refund' && from === 'failed') {
    return bounty && bounty.refund && bounty.refund.state === 'failed';
  }
  return row.from.includes(from);
}

export function createBounty({
  id,
  title,
  description = '',
  creator,
  creatorWallet = null,
  reward,
  createdAt = nowIso(),
  deadline = null,
  rules = emptyRules(),
  source = { kind: 'app', community: null, ref: null },
  state = 'draft',
} = {}) {
  const bounty = {
    schema: BOUNTY_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    id,
    title,
    description,
    creator,
    creatorWallet: creatorWallet || (creator && creator.wallet) || null,
    reward: {
      asset: reward.asset,
      symbol: reward.symbol,
      mint: reward.mint || null,
      amount: String(reward.amount),
      chain: reward.chain || 'solana',
    },
    funding: emptyFunding(),
    createdAt,
    deadline,
    rules: {
      eligibility: (rules && rules.eligibility) || '',
      submissionFormat: (rules && rules.submissionFormat) || 'url',
      text: (rules && rules.text) || '',
    },
    submissions: [],
    winners: [],
    selectedAt: null,
    settlement: emptySettlement(),
    cancellation: emptyCancellation(),
    refund: emptyRefund(),
    history: [],
    seenEventIds: [],
    state,
    source,
  };
  const v = validateBounty(bounty);
  if (!v.ok) {
    const err = new Error(v.errors.map((e) => `${e.path}: ${e.msg}`).join('; '));
    err.errors = v.errors;
    throw err;
  }
  return bounty;
}

function remember(bounty, event) {
  const key = event.idempotencyKey || event.id;
  if (key && !bounty.seenEventIds.includes(key)) bounty.seenEventIds.push(key);
}

function pushTx(bounty, tx) {
  if (!tx || !tx.signature) return;
  if (bounty.history.some((row) => row.signature === tx.signature && row.purpose === tx.purpose)) return;
  bounty.history.push(tx);
}

function reject(code, detail) {
  return { ok: false, error: code, detail, bounty: null };
}

export function apply(bounty, event, now = new Date()) {
  if (!bounty || !isState(bounty.state)) return reject('invalid_bounty', 'bounty is missing or has an unknown state');
  const checked = validateBounty(bounty);
  if (!checked.ok) return reject('invalid_bounty', checked.errors);
  const ev = validateEvent(event);
  if (!ev.ok) return reject('invalid_event', ev.errors);

  const key = event.idempotencyKey || event.id;
  if (key && bounty.seenEventIds.includes(key)) {
    return { ok: true, replayed: true, bounty: clone(bounty) };
  }

  const next = clone(bounty);
  const ts = event.ts || nowIso(now);
  const type = event.type;

  if (type === 'observe_funding') {
    if (next.funding.tx && event.tx && !sameTx(next.funding.tx, event.tx)) {
      return reject('duplicate_funding', 'a different funding signature is already recorded');
    }
    if (next.state === 'funded' || next.state === 'submission_open' || next.funding.state === 'funded') {
      if (!event.tx || sameTx(next.funding.tx, event.tx) || !next.funding.tx) {
        if (event.tx) {
          next.funding.tx = next.funding.tx || event.tx;
          pushTx(next, event.tx);
        }
        remember(next, event);
        return { ok: true, replayed: true, bounty: next };
      }
    }
  }

  if (type === 'observe_settlement') {
    if (next.state === 'paid' || next.settlement.state === 'paid') {
      if (event.tx && next.settlement.tx && !sameTx(next.settlement.tx, event.tx)) {
        return reject('double_settlement', 'a different settlement signature is already recorded');
      }
      remember(next, event);
      return { ok: true, replayed: true, bounty: next };
    }
  }

  if (type === 'submit') {
    if (next.deadline && new Date(now).getTime() > Date.parse(next.deadline)) {
      return reject('expired', 'deadline has passed');
    }
    if (next.state !== 'submission_open') return reject('invalid_transition', `${next.state} cannot accept submissions`);
    const submission = event.payload && event.payload.submission;
    const v = validateSubmission(submission);
    if (!v.ok) return reject('malformed_submission', v.errors);
    if (next.submissions.some((row) => row.id === submission.id)) {
      remember(next, event);
      return { ok: true, replayed: true, bounty: next };
    }
    next.submissions.push({
      ...submission,
      schema: submission.schema || 'commons.submission/v1',
      bountyId: next.id,
      status: submission.status || 'received',
    });
    remember(next, event);
    return { ok: true, replayed: false, bounty: next };
  }

  if (type === 'expire') {
    const due = next.deadline && new Date(now).getTime() > Date.parse(next.deadline);
    if (!due) return reject('not_expired', 'deadline has not passed');
    if (next.state === 'open' && !funded(next)) {
      next.state = 'cancelled';
      next.cancellation = { state: 'cancelled', reason: event.payload && event.payload.reason || 'expired', at: ts };
      remember(next, event);
      return { ok: true, replayed: false, bounty: next };
    }
    if (next.state !== 'submission_open') return reject('invalid_transition', `${next.state} cannot expire`);
    if (next.submissions.length) {
      next.state = 'selection_pending';
    } else {
      next.state = cancelTarget(next);
      next.cancellation = { state: 'cancelled', reason: 'expired', at: ts };
      if (next.state === 'refund_pending') next.refund = { state: 'pending', tx: null, reason: 'expired' };
    }
    remember(next, event);
    return { ok: true, replayed: false, bounty: next };
  }

  if (type === 'cancel') {
    if (!canTransition(next.state, 'cancel', next)) {
      return reject('invalid_transition', `${next.state} cannot cancel`);
    }
    const reason = (event.payload && event.payload.reason) || 'cancelled';
    next.cancellation = { state: 'cancelled', reason, at: ts };
    next.state = cancelTarget(next);
    if (next.state === 'refund_pending') next.refund = { state: 'pending', tx: null, reason };
    remember(next, event);
    return { ok: true, replayed: false, bounty: next };
  }

  if (!canTransition(next.state, type, next)) {
    return reject('invalid_transition', `${next.state} cannot ${type}`);
  }

  if (type === 'publish') next.state = 'open';

  if (type === 'start_funding') {
    next.state = 'funding_pending';
    next.funding = { state: 'pending', tx: event.tx || null };
    pushTx(next, event.tx);
  }

  if (type === 'observe_funding') {
    if (!event.tx || !event.tx.signature) return reject('invalid_event', 'funding observation needs a tx signature');
    next.state = 'funded';
    next.funding = { state: 'funded', tx: { ...event.tx, purpose: 'funding', origin: event.origin || 'chain' } };
    pushTx(next, next.funding.tx);
    if (event.payload && event.payload.openSubmissions) next.state = 'submission_open';
  }

  if (type === 'open_submissions') next.state = 'submission_open';
  if (type === 'close_submissions') next.state = 'selection_pending';

  if (type === 'select_winner') {
    const winners = (event.payload && event.payload.winners) || [];
    if (!winners.length) return reject('invalid_event', 'select_winner needs winners');
    const ids = new Set(next.submissions.map((row) => row.id));
    for (const winner of winners) {
      if (!winner.submissionId || !ids.has(winner.submissionId)) {
        return reject('invalid_event', 'winner must reference a submission');
      }
    }
    next.winners = winners.map((winner) => ({
      submissionId: winner.submissionId,
      identity: winner.identity || null,
      selectedAt: ts,
    }));
    next.submissions = next.submissions.map((row) => ({
      ...row,
      status: winners.some((winner) => winner.submissionId === row.id) ? 'selected' : row.status,
    }));
    next.selectedAt = ts;
    next.state = 'selected';
  }

  if (type === 'start_settlement' || type === 'retry_settlement') {
    next.state = 'settlement_pending';
    next.settlement = { state: 'pending', tx: event.tx || next.settlement.tx || null };
    pushTx(next, event.tx);
  }

  if (type === 'observe_settlement') {
    if (!event.tx || !event.tx.signature) return reject('invalid_event', 'settlement observation needs a tx signature');
    next.state = 'paid';
    next.settlement = { state: 'paid', tx: { ...event.tx, purpose: 'settlement', origin: event.origin || 'chain' } };
    pushTx(next, next.settlement.tx);
  }

  if (type === 'request_refund') {
    if (!funded(next) && next.refund.state !== 'pending') {
      return reject('invalid_transition', 'nothing to refund');
    }
    next.state = 'refund_pending';
    next.refund = { state: 'pending', tx: event.tx || null, reason: (event.payload && event.payload.reason) || next.refund.reason };
    pushTx(next, event.tx);
  }

  if (type === 'observe_refund') {
    if (!event.tx || !event.tx.signature) return reject('invalid_event', 'refund observation needs a tx signature');
    next.state = 'refunded';
    next.refund = {
      state: 'refunded',
      tx: { ...event.tx, purpose: 'refund', origin: event.origin || 'chain' },
      reason: next.refund.reason,
    };
    pushTx(next, next.refund.tx);
  }

  if (type === 'fail') {
    next.state = 'failed';
    if (bounty.state === 'funding_pending') next.funding = { ...next.funding, state: 'failed' };
    if (bounty.state === 'settlement_pending') next.settlement = { ...next.settlement, state: 'failed' };
    if (bounty.state === 'refund_pending') next.refund = { ...next.refund, state: 'failed' };
  }

  if (type === 'retry_funding') {
    next.state = 'funding_pending';
    next.funding = { state: 'pending', tx: event.tx || next.funding.tx };
  }

  if (type === 'retry_refund') {
    next.state = 'refund_pending';
    next.refund = { ...next.refund, state: 'pending', tx: event.tx || next.refund.tx };
  }

  remember(next, event);
  return { ok: true, replayed: false, bounty: next };
}

export function transitionsFrom(state, bounty) {
  return Object.keys(TABLE)
    .concat(['cancel', 'expire', 'submit'])
    .filter((type) => canTransition(state, type, bounty));
}
