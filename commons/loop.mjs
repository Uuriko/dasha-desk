/**
 * User-signed create → fund → submit → select → pay.
 * Wallet is requested only inside fund/pay. No escrow. No auto-sign.
 *
 * Visible labels are schema words only:
 * unfunded | declared | funded | selected | paid | cancelled | failed
 */
import { apply, createBounty } from './machine.mjs';
import { USDC_MINT } from './adapter.mjs';
import { makeEvent } from './tape.mjs';
import { nowIso } from './schema.mjs';
import { TX_ERRORS } from './tx.mjs';

let seq = 0;
function eid(type, bountyId) {
  seq += 1;
  return `loop-${type}-${bountyId}-${seq}`;
}

function ev(type, bountyId, extra = {}) {
  return makeEvent({
    id: extra.id || eid(type, bountyId),
    type,
    ts: extra.ts || nowIso(),
    bountyId,
    origin: extra.origin || (extra.tx ? extra.tx.origin || 'app' : 'app'),
    idempotencyKey: extra.idempotencyKey || `${type}:${bountyId}`,
    tx: extra.tx || null,
    payload: extra.payload || null,
  });
}

function failOut(result) {
  return result;
}

export function visibleState(bounty) {
  if (!bounty) return 'unfunded';
  const s = bounty.state;
  if (s === 'paid') return 'paid';
  if (s === 'cancelled' || s === 'refund_pending' || s === 'refunded') return 'cancelled';
  if (s === 'failed') return 'failed';
  if (s === 'selected' || s === 'settlement_pending') return 'selected';
  if (s === 'funded' || s === 'submission_open' || s === 'selection_pending') return 'funded';
  if (bounty.funding && bounty.funding.state === 'declared') return 'declared';
  return 'unfunded';
}

export function visibleCopy(bounty) {
  const reward = bounty && bounty.reward;
  const amount =
    reward && reward.amount != null && reward.symbol
      ? `${String(reward.amount).replace(/\.0+$/, '')} ${reward.symbol} bounty`
      : 'bounty';
  const state = visibleState(bounty);
  const title =
    state === 'funded'
      ? 'Submit work'
      : state === 'selected'
        ? 'Winner selected'
        : state === 'paid'
          ? 'Paid on Solana'
          : amount;
  return { state, title, amount };
}

export function createOpenBounty({
  id,
  title,
  amount = '25',
  symbol = 'USDC',
  mint = USDC_MINT,
  creator,
  creatorWallet = null,
  deadline = null,
  createdAt,
} = {}) {
  const wallet = creatorWallet || (creator && creator.wallet) || null;
  const ident = creator || { kind: wallet ? 'wallet' : 'opaque', id: wallet || id, wallet, handle: null };
  let bounty = createBounty({
    id,
    title: title || `${amount} ${symbol} bounty`,
    creator: ident,
    creatorWallet: wallet,
    reward: { asset: 'spl', symbol, mint, amount: String(amount), chain: 'solana' },
    createdAt,
    deadline,
    source: { kind: 'local', community: null, ref: null },
  });
  const published = apply(bounty, ev('publish', bounty.id, { idempotencyKey: `publish:${bounty.id}` }));
  if (!published.ok) throw new Error(published.error);
  return published.bounty;
}

async function signAndObserve({ bounty, tx, startType, observeType, purpose, openSubmissions, retryType }) {
  if (!tx || typeof tx.requestSignature !== 'function') {
    return { ok: false, error: 'no_tx_provider', bounty, detail: 'Fund and Pay need a signer the user clicked' };
  }
  if (tx.autoSign) return { ok: false, error: 'auto_sign_forbidden', bounty };
  if (tx.custody) return { ok: false, error: 'custody_forbidden', bounty };

  let current = bounty;
  const vis = visibleState(current);
  if (startType === 'start_funding' && current.state === 'failed' && retryType) {
    const retried = apply(current, ev(retryType, current.id, { idempotencyKey: `${retryType}:${current.id}:${current.seenEventIds.length}` }));
    if (!retried.ok) return failOut(retried);
    current = retried.bounty;
  } else if (startType === 'start_settlement' && current.state === 'failed' && retryType) {
    const retried = apply(current, ev(retryType, current.id, { idempotencyKey: `${retryType}:${current.id}:${current.seenEventIds.length}` }));
    if (!retried.ok) return failOut(retried);
    current = retried.bounty;
  } else if (startType === 'start_funding' && current.state === 'open') {
    const started = apply(current, ev(startType, current.id, { idempotencyKey: `${startType}:${current.id}` }));
    if (!started.ok) return failOut(started);
    current = started.bounty;
  } else if (startType === 'start_settlement' && (current.state === 'selected' || vis === 'selected')) {
    const started = apply(current, ev(startType, current.id, { idempotencyKey: `${startType}:${current.id}` }));
    if (!started.ok) return failOut(started);
    current = started.bounty;
  }

  try {
    const signed = await tx.requestSignature({
      purpose,
      bountyId: current.id,
      amount: current.reward && current.reward.amount,
      mint: current.reward && current.reward.mint,
      from: current.creatorWallet,
      to: purpose === 'settlement' ? winnerWallet(current) : current.creatorWallet,
    });
    const confirmed = await tx.confirm(signed.signature);
    const observed = apply(
      current,
      ev(observeType, current.id, {
        idempotencyKey: `${observeType}:${current.id}:${signed.signature}`,
        origin: confirmed.origin || 'chain',
        tx: { signature: signed.signature, chain: 'solana', purpose, origin: confirmed.origin || 'chain' },
        payload: openSubmissions ? { openSubmissions: true } : null,
      }),
    );
    return observed;
  } catch (err) {
    const code = err && err.code;
    const failed = apply(current, ev('fail', current.id, { idempotencyKey: `fail:${purpose}:${current.id}:${current.seenEventIds.length}` }));
    const next = failed.ok ? failed.bounty : current;
    if (code === TX_ERRORS.user_rejected || code === TX_ERRORS.simulation_failed || code === TX_ERRORS.confirmation_timeout) {
      return { ok: false, error: code, bounty: next, detail: err.message };
    }
    return { ok: false, error: 'tx_failed', bounty: next, detail: err && err.message };
  }
}

function winnerWallet(bounty) {
  const winner = bounty && bounty.winners && bounty.winners[0];
  if (winner && winner.identity && winner.identity.wallet) return winner.identity.wallet;
  const sub = bounty && bounty.submissions && bounty.submissions[0];
  if (sub && sub.submitter && sub.submitter.wallet) return sub.submitter.wallet;
  return null;
}

function peekSig(tx, purpose) {
  if (!tx) return null;
  if (typeof tx.peekSignature === 'function') return tx.peekSignature(purpose) || null;
  if (tx.signature) return tx.signature;
  if (tx.signatures && purpose) return tx.signatures[purpose] || null;
  return null;
}

function recordedSig(bounty, purpose) {
  if (purpose === 'settlement') return settlementTx(bounty);
  return fundingTx(bounty);
}

function alreadyRecorded(bounty, tx, purpose, duplicateError) {
  const existing = recordedSig(bounty, purpose);
  if (!existing) return null;
  const incoming = peekSig(tx, purpose);
  if (!incoming || incoming === existing) {
    return { ok: true, replayed: true, bounty };
  }
  return { ok: false, error: duplicateError, bounty, detail: 'a different signature is already recorded' };
}

export async function fundBounty(bounty, tx) {
  const replay = alreadyRecorded(bounty, tx, 'funding', 'duplicate_funding');
  if (replay) return replay;
  return signAndObserve({
    bounty,
    tx,
    startType: 'start_funding',
    observeType: 'observe_funding',
    purpose: 'funding',
    openSubmissions: true,
    retryType: 'retry_funding',
  });
}

export async function payBounty(bounty, tx) {
  const replay = alreadyRecorded(bounty, tx, 'settlement', 'double_settlement');
  if (replay) return replay;
  return signAndObserve({
    bounty,
    tx,
    startType: 'start_settlement',
    observeType: 'observe_settlement',
    purpose: 'settlement',
    retryType: 'retry_settlement',
  });
}

export function submitWork(bounty, submission, now) {
  return apply(
    bounty,
    ev('submit', bounty.id, {
      idempotencyKey: `submit:${bounty.id}:${submission && submission.id}`,
      payload: { submission },
    }),
    now,
  );
}

export function selectWinner(bounty, submissionId, identity) {
  const closed = apply(bounty, ev('close_submissions', bounty.id, { idempotencyKey: `close:${bounty.id}` }));
  if (!closed.ok) return closed;
  return apply(
    closed.bounty,
    ev('select_winner', bounty.id, {
      idempotencyKey: `select:${bounty.id}`,
      payload: { winners: [{ submissionId, identity: identity || null }] },
    }),
  );
}

export function cancelBounty(bounty, reason) {
  return apply(bounty, ev('cancel', bounty.id, { payload: { reason: reason || 'cancelled' } }));
}

export function expireBounty(bounty, now) {
  return apply(bounty, ev('expire', bounty.id, { idempotencyKey: `expire:${bounty.id}` }), now);
}

export function fundingTx(bounty) {
  return (bounty && bounty.funding && bounty.funding.tx && bounty.funding.tx.signature) || null;
}

export function settlementTx(bounty) {
  return (bounty && bounty.settlement && bounty.settlement.tx && bounty.settlement.tx.signature) || null;
}
