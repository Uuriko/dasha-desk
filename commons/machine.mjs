/**
 * Explicit v1 state machine. One winner. Confirmed chain observations must bind
 * the expected source, destination, asset, amount, purpose, slot and commitment.
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
  sameIdentity,
  validateBounty,
  validateEvent,
  validateSubmission,
  validateTx,
} from './schema.mjs';

export { STATES, TERMINAL };

const TABLE = Object.freeze({
  publish: ['draft'],
  start_funding: ['open'],
  open_submissions: ['funded'],
  close_submissions: ['submission_open'],
  select_winner: ['selection_pending'],
  start_settlement: ['selected'],
  request_refund: ['funded', 'submission_open', 'selection_pending', 'selected', 'cancelled', 'refund_pending'],
  retry_funding: ['failed'],
  retry_settlement: ['failed'],
  retry_refund: ['failed'],
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
    .join(',')}}`;
}

export function eventFingerprint(event) {
  return stable({
    schema: event.schema,
    id: event.id,
    type: event.type,
    bountyId: event.bountyId,
    ts: event.ts,
    origin: event.origin,
    idempotencyKey: event.idempotencyKey,
    tx: event.tx || null,
    source: event.source || null,
    payload: event.payload || null,
  });
}

function sameTx(a, b) {
  return Boolean(a && b && a.signature && a.signature === b.signature && a.purpose === b.purpose);
}

function sameValue(a, b) {
  return stable(a) === stable(b);
}

function confirmedFunding(bounty) {
  return Boolean(bounty.funding && bounty.funding.state === 'funded' && bounty.funding.tx && bounty.funding.tx.status === 'confirmed');
}

function stageForPurpose(bounty, purpose) {
  if (purpose === 'funding') return bounty.funding;
  if (purpose === 'settlement') return bounty.settlement;
  if (purpose === 'refund') return bounty.refund;
  return null;
}

function expectedTransfer(bounty, purpose) {
  const reward = bounty.reward || {};
  if (purpose === 'funding') {
    return {
      source: bounty.creatorWallet || (bounty.creator && bounty.creator.wallet) || null,
      destination: bounty.fundingDestination || null,
      reward,
    };
  }
  if (purpose === 'settlement') {
    const winner = bounty.winners && bounty.winners[0];
    const submission = winner && bounty.submissions.find((row) => row.id === winner.submissionId);
    return {
      source: bounty.settlementSource || null,
      destination: submission && submission.submitter && submission.submitter.wallet || null,
      reward,
    };
  }
  return {
    source: bounty.fundingDestination || null,
    destination: bounty.creatorWallet || (bounty.creator && bounty.creator.wallet) || null,
    reward,
  };
}

function validateBoundTx(bounty, tx, purpose, statuses) {
  const v = validateTx(tx, { required: true, statuses });
  if (!v.ok) return { ok: false, error: 'invalid_transaction_evidence', detail: v.errors };
  if (tx.purpose !== purpose) return { ok: false, error: 'wrong_transaction_purpose', detail: `expected ${purpose}` };
  const expected = expectedTransfer(bounty, purpose);
  if (!expected.source || !expected.destination) {
    return { ok: false, error: 'payment_route_missing', detail: `${purpose} source and destination must be configured` };
  }
  const reward = expected.reward;
  const checks = [
    ['chain', reward.chain],
    ['asset', reward.asset],
    ['symbol', reward.symbol],
    ['amount', reward.amount],
    ['source', expected.source],
    ['destination', expected.destination],
  ];
  if (reward.asset === 'spl') checks.push(['mint', reward.mint]);
  for (const [key, value] of checks) {
    if (tx[key] !== value) return { ok: false, error: 'transaction_mismatch', detail: `${key} does not match bounty` };
  }
  if (reward.asset !== 'spl' && tx.mint != null) {
    return { ok: false, error: 'transaction_mismatch', detail: 'mint must be absent for non-SPL reward' };
  }
  return { ok: true };
}

function pushTx(bounty, tx) {
  if (!tx || !tx.signature) return;
  if (bounty.history.some((row) => row.signature === tx.signature && row.purpose === tx.purpose && row.status === tx.status)) return;
  bounty.history.push(clone(tx));
}

function reject(code, detail) {
  return { ok: false, error: code, detail, bounty: null };
}

function remember(bounty, event) {
  const key = event.idempotencyKey;
  bounty.seenEventIds.push(key);
  bounty.seenEvents[key] = eventFingerprint(event);
}

function finish(bounty, event, { replayed = false } = {}) {
  remember(bounty, event);
  const checked = validateBounty(bounty);
  if (!checked.ok) return reject('invalid_result', checked.errors);
  return { ok: true, replayed, bounty };
}

function stageFailure(stage) {
  if (stage.tx && stage.tx.signature) return { ...stage, state: 'reconcile_required' };
  return { ...stage, state: 'failed' };
}

function cancellation(next, event, state = 'cancelled') {
  next.cancellation = {
    state,
    reason: event.payload && event.payload.reason || 'cancelled',
    at: event.ts,
  };
}

export function canTransition(from, type, bounty) {
  if (!isState(from)) return false;
  if (type === 'cancel') return ['draft', 'open', 'funding_pending', 'funded', 'submission_open', 'selection_pending', 'selected'].includes(from);
  if (type === 'fail') return ['funding_pending', 'settlement_pending', 'refund_pending'].includes(from);
  if (type === 'expire') return from === 'open' || from === 'submission_open';
  if (type === 'submit') return from === 'submission_open';
  if (type === 'observe_funding') {
    return from === 'funding_pending' || (from === 'failed' && bounty && bounty.funding && bounty.funding.state === 'reconcile_required');
  }
  if (type === 'observe_settlement') {
    return from === 'settlement_pending' || (from === 'failed' && bounty && bounty.settlement && bounty.settlement.state === 'reconcile_required');
  }
  if (type === 'observe_refund') {
    return from === 'refund_pending' || (from === 'failed' && bounty && bounty.refund && bounty.refund.state === 'reconcile_required');
  }
  if (type.startsWith('reconcile_')) {
    const purpose = type.slice('reconcile_'.length);
    const stage = stageForPurpose(bounty || {}, purpose);
    return from === 'failed' && stage && stage.state === 'reconcile_required';
  }
  const allowed = TABLE[type];
  if (!allowed || !allowed.includes(from)) return false;
  if (type === 'retry_funding') return bounty && bounty.funding && bounty.funding.state === 'failed';
  if (type === 'retry_settlement') return bounty && bounty.settlement && bounty.settlement.state === 'failed';
  if (type === 'retry_refund') return bounty && bounty.refund && bounty.refund.state === 'failed';
  return true;
}

export function createBounty({
  id,
  title,
  description = '',
  creator,
  creatorWallet = null,
  fundingDestination = null,
  settlementSource = null,
  reward = {},
  createdAt = nowIso(),
  deadline = null,
  rules = emptyRules(),
  source = { kind: 'app', community: null, ref: null },
  state = 'draft',
} = {}) {
  const wallet = creatorWallet || (creator && creator.wallet) || null;
  const bounty = {
    schema: BOUNTY_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    id,
    title,
    description,
    creator,
    creatorWallet: wallet,
    fundingDestination,
    settlementSource: settlementSource || wallet,
    reward: {
      asset: reward.asset,
      symbol: reward.symbol,
      mint: reward.mint || null,
      amount: reward.amount,
      chain: reward.chain,
    },
    funding: emptyFunding(),
    createdAt,
    deadline,
    rules: {
      eligibility: rules && rules.eligibility || '',
      submissionFormat: rules && rules.submissionFormat || 'url',
      text: rules && rules.text || '',
    },
    submissions: [],
    winners: [],
    selectedAt: null,
    settlement: emptySettlement(),
    cancellation: emptyCancellation(),
    refund: emptyRefund(),
    history: [],
    seenEventIds: [],
    seenEvents: {},
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

export function apply(bounty, event, now = new Date()) {
  if (!bounty || !isState(bounty.state)) return reject('invalid_bounty', 'bounty is missing or has an unknown state');
  const checked = validateBounty(bounty);
  if (!checked.ok) return reject('invalid_bounty', checked.errors);
  const ev = validateEvent(event);
  if (!ev.ok) return reject('invalid_event', ev.errors);
  if (event.bountyId !== bounty.id) return reject('bounty_mismatch', 'event bountyId must match the bounty being mutated');

  const fingerprint = eventFingerprint(event);
  if (Object.prototype.hasOwnProperty.call(bounty.seenEvents, event.idempotencyKey)) {
    if (bounty.seenEvents[event.idempotencyKey] !== fingerprint) {
      return reject('idempotency_conflict', 'the idempotency key was already used for different event content');
    }
    return { ok: true, replayed: true, bounty: clone(bounty) };
  }

  const next = clone(bounty);
  const type = event.type;

  if (type === 'submit') {
    if (next.deadline && new Date(now).getTime() > Date.parse(next.deadline)) return reject('expired', 'deadline has passed');
    if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot accept submissions`);
    const submission = event.payload && event.payload.submission;
    const v = validateSubmission(submission);
    if (!v.ok) return reject('malformed_submission', v.errors);
    if (submission.bountyId !== next.id) return reject('bounty_mismatch', 'submission bountyId must match the bounty');
    const prior = next.submissions.find((row) => row.id === submission.id);
    if (prior) {
      const normalized = { ...submission, status: submission.status || 'received' };
      if (!sameValue(prior, normalized)) return reject('submission_conflict', 'submission id was reused with different content');
      return finish(next, event, { replayed: true });
    }
    next.submissions.push({ ...submission, status: submission.status || 'received' });
    return finish(next, event);
  }

  if (type === 'observe_funding') {
    const bound = validateBoundTx(next, event.tx, 'funding', ['confirmed']);
    if (!bound.ok) return reject(bound.error, bound.detail);
    if (next.funding.state === 'funded') {
      if (!sameTx(next.funding.tx, event.tx)) return reject('duplicate_funding', 'a different confirmed funding transaction is already recorded');
      return finish(next, event, { replayed: true });
    }
    if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot observe funding`);
    if (next.funding.tx && !sameTx(next.funding.tx, event.tx)) {
      return reject('candidate_transaction_mismatch', 'confirmed funding must match the submitted candidate signature');
    }
    next.funding = { state: 'funded', tx: clone(event.tx), reconciliation: next.funding.reconciliation || null };
    pushTx(next, event.tx);
    if (next.cancellation.state === 'requested') {
      next.state = 'refund_pending';
      next.refund = { state: 'pending', tx: null, reconciliation: null, reason: next.cancellation.reason };
    } else next.state = event.payload && event.payload.openSubmissions ? 'submission_open' : 'funded';
    return finish(next, event);
  }

  if (type === 'observe_settlement') {
    const bound = validateBoundTx(next, event.tx, 'settlement', ['confirmed']);
    if (!bound.ok) return reject(bound.error, bound.detail);
    if (next.settlement.state === 'paid') {
      if (!sameTx(next.settlement.tx, event.tx)) return reject('double_settlement', 'a different confirmed settlement is already recorded');
      return finish(next, event, { replayed: true });
    }
    if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot observe settlement`);
    if (next.settlement.tx && !sameTx(next.settlement.tx, event.tx)) {
      return reject('candidate_transaction_mismatch', 'confirmed settlement must match the submitted candidate signature');
    }
    next.settlement = { state: 'paid', tx: clone(event.tx), reconciliation: next.settlement.reconciliation || null };
    next.state = 'paid';
    pushTx(next, event.tx);
    return finish(next, event);
  }

  if (type === 'observe_refund') {
    const bound = validateBoundTx(next, event.tx, 'refund', ['confirmed']);
    if (!bound.ok) return reject(bound.error, bound.detail);
    if (next.refund.state === 'refunded') {
      if (!sameTx(next.refund.tx, event.tx)) return reject('double_refund', 'a different confirmed refund is already recorded');
      return finish(next, event, { replayed: true });
    }
    if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot observe refund`);
    if (next.refund.tx && !sameTx(next.refund.tx, event.tx)) {
      return reject('candidate_transaction_mismatch', 'confirmed refund must match the submitted candidate signature');
    }
    next.refund = {
      state: 'refunded',
      tx: clone(event.tx),
      reconciliation: next.refund.reconciliation || null,
      reason: next.refund.reason,
    };
    next.state = 'refunded';
    pushTx(next, event.tx);
    return finish(next, event);
  }

  if (type.startsWith('reconcile_')) {
    const purpose = type.slice('reconcile_'.length);
    if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot ${type}`);
    const stage = stageForPurpose(next, purpose);
    const bound = validateBoundTx(next, event.tx, purpose, ['failed', 'not_found']);
    if (!bound.ok) return reject(bound.error, bound.detail);
    if (!stage.tx || !sameTx(stage.tx, event.tx)) {
      return reject('candidate_transaction_mismatch', 'reconciliation must match the ambiguous candidate signature');
    }
    stage.state = 'failed';
    stage.reconciliation = clone(event.tx);
    pushTx(next, event.tx);
    return finish(next, event);
  }

  if (type === 'cancel') {
    if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot cancel`);
    if (next.state === 'funding_pending' && next.funding.tx && next.funding.tx.signature) {
      cancellation(next, event, 'requested');
      next.funding = stageFailure(next.funding);
      next.state = 'failed';
      return finish(next, event);
    }
    cancellation(next, event);
    if (confirmedFunding(next)) {
      next.state = 'refund_pending';
      next.refund = { state: 'pending', tx: null, reconciliation: null, reason: next.cancellation.reason };
    } else next.state = 'cancelled';
    return finish(next, event);
  }

  if (type === 'expire') {
    const due = next.deadline && new Date(now).getTime() > Date.parse(next.deadline);
    if (!due) return reject('not_expired', 'deadline has not passed');
    if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot expire`);
    if (next.state === 'submission_open' && next.submissions.length) {
      next.state = 'selection_pending';
      return finish(next, event);
    }
    cancellation(next, { ...event, payload: { reason: 'expired' } });
    if (confirmedFunding(next)) {
      next.state = 'refund_pending';
      next.refund = { state: 'pending', tx: null, reconciliation: null, reason: 'expired' };
    } else next.state = 'cancelled';
    return finish(next, event);
  }

  if (!canTransition(next.state, type, next)) return reject('invalid_transition', `${next.state} cannot ${type}`);

  if (type === 'publish') next.state = 'open';

  if (type === 'start_funding') {
    if (!next.creatorWallet || !next.fundingDestination) return reject('payment_route_missing', 'funding source and destination must be configured');
    if (event.tx) {
      const bound = validateBoundTx(next, event.tx, 'funding', ['submitted']);
      if (!bound.ok) return reject(bound.error, bound.detail);
      pushTx(next, event.tx);
    }
    next.funding = { state: 'pending', tx: event.tx ? clone(event.tx) : null, reconciliation: null };
    next.state = 'funding_pending';
  }

  if (type === 'open_submissions') next.state = 'submission_open';

  if (type === 'close_submissions') {
    if (!next.submissions.length) return reject('no_submissions', 'cannot close into selection without a submission');
    next.state = 'selection_pending';
  }

  if (type === 'select_winner') {
    const winners = event.payload && event.payload.winners;
    if (!Array.isArray(winners) || winners.length !== 1) return reject('invalid_event', 'v1 requires exactly one winner');
    const requested = winners[0];
    const submission = next.submissions.find((row) => row.id === requested.submissionId);
    if (!submission) return reject('invalid_event', 'winner must reference an existing submission');
    if (!submission.submitter || !submission.submitter.wallet) return reject('winner_wallet_missing', 'the selected submitter needs a payout wallet');
    if (requested.identity && !sameIdentity(requested.identity, submission.submitter)) {
      return reject('winner_identity_mismatch', 'winner identity must match the referenced submitter');
    }
    next.winners = [{ submissionId: submission.id, identity: clone(submission.submitter), selectedAt: event.ts }];
    next.submissions = next.submissions.map((row) => ({ ...row, status: row.id === submission.id ? 'selected' : row.status }));
    next.selectedAt = event.ts;
    next.state = 'selected';
  }

  if (type === 'start_settlement') {
    if (!next.settlementSource) return reject('payment_route_missing', 'settlement source must be configured');
    if (event.tx) {
      const bound = validateBoundTx(next, event.tx, 'settlement', ['submitted']);
      if (!bound.ok) return reject(bound.error, bound.detail);
      pushTx(next, event.tx);
    }
    next.settlement = { state: 'pending', tx: event.tx ? clone(event.tx) : null, reconciliation: null };
    next.state = 'settlement_pending';
  }

  if (type === 'request_refund') {
    if (!confirmedFunding(next)) return reject('invalid_transition', 'only confirmed funding can be refunded');
    if (event.tx) {
      const bound = validateBoundTx(next, event.tx, 'refund', ['submitted']);
      if (!bound.ok) return reject(bound.error, bound.detail);
      if (next.refund.tx && !sameTx(next.refund.tx, event.tx)) {
        return reject('candidate_transaction_mismatch', 'a different refund candidate is already pending');
      }
      pushTx(next, event.tx);
    }
    next.state = 'refund_pending';
    next.refund = {
      state: 'pending',
      tx: event.tx ? clone(event.tx) : next.refund.tx || null,
      reconciliation: next.refund.reconciliation || null,
      reason: event.payload && event.payload.reason || next.refund.reason || next.cancellation.reason || 'refund requested',
    };
  }

  if (type === 'fail') {
    if (next.state === 'funding_pending') next.funding = stageFailure(next.funding);
    else if (next.state === 'settlement_pending') next.settlement = stageFailure(next.settlement);
    else if (next.state === 'refund_pending') next.refund = stageFailure(next.refund);
    else return reject('invalid_transition', `${next.state} cannot fail a payment stage`);
    next.state = 'failed';
  }

  if (type === 'retry_funding') {
    if (event.tx) {
      const bound = validateBoundTx(next, event.tx, 'funding', ['submitted']);
      if (!bound.ok) return reject(bound.error, bound.detail);
      pushTx(next, event.tx);
    }
    next.funding = { state: 'pending', tx: event.tx ? clone(event.tx) : null, reconciliation: next.funding.reconciliation || null };
    next.state = 'funding_pending';
  }

  if (type === 'retry_settlement') {
    if (event.tx) {
      const bound = validateBoundTx(next, event.tx, 'settlement', ['submitted']);
      if (!bound.ok) return reject(bound.error, bound.detail);
      pushTx(next, event.tx);
    }
    next.settlement = { state: 'pending', tx: event.tx ? clone(event.tx) : null, reconciliation: next.settlement.reconciliation || null };
    next.state = 'settlement_pending';
  }

  if (type === 'retry_refund') {
    if (event.tx) {
      const bound = validateBoundTx(next, event.tx, 'refund', ['submitted']);
      if (!bound.ok) return reject(bound.error, bound.detail);
      pushTx(next, event.tx);
    }
    next.refund = {
      state: 'pending',
      tx: event.tx ? clone(event.tx) : null,
      reconciliation: next.refund.reconciliation || null,
      reason: next.refund.reason,
    };
    next.state = 'refund_pending';
  }

  return finish(next, event);
}

export function transitionsFrom(state, bounty) {
  return Object.keys(TABLE)
    .concat([
      'cancel',
      'expire',
      'submit',
      'observe_funding',
      'observe_settlement',
      'observe_refund',
      'reconcile_funding',
      'reconcile_settlement',
      'reconcile_refund',
    ])
    .filter((type) => canTransition(state, type, bounty));
}
