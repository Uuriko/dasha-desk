/** Activity Tape: stable events, source attribution, and short human copy. */
import { EVENT_SCHEMA, validateEvent } from './schema.mjs';

const TITLES = Object.freeze({
  publish: 'Bounty posted',
  start_funding: 'Funding started',
  observe_funding: 'Funded on chain',
  open_submissions: 'Submit work',
  submit: 'Work received',
  close_submissions: 'Submissions closed',
  expire: 'Bounty expired',
  select_winner: 'Winner selected',
  start_settlement: 'Payment started',
  observe_settlement: 'Paid on chain',
  cancel: 'Bounty cancelled',
  request_refund: 'Refund started',
  observe_refund: 'Refunded on chain',
  fail: 'Payment state uncertain',
  reconcile_funding: 'Funding reconciled',
  reconcile_settlement: 'Payment reconciled',
  reconcile_refund: 'Refund reconciled',
  retry_funding: 'Funding retry',
  retry_settlement: 'Payment retry',
  retry_refund: 'Refund retry',
});

export function renderEvent(event, bounty) {
  const type = event && event.type;
  const reward = bounty && bounty.reward;
  const amount = reward && reward.amount && reward.symbol ? `${reward.amount} ${reward.symbol} bounty` : null;
  let title = event && event.render && event.render.title || TITLES[type] || 'Bounty update';
  if ((type === 'publish' || type === 'observe_funding') && amount) title = amount;
  const tx = event && event.tx || null;
  const chainObserved = Boolean(
    event &&
      event.origin === 'chain' &&
      tx &&
      tx.status === 'confirmed' &&
      tx.success === true &&
      Number.isSafeInteger(tx.slot) &&
      ['confirmed', 'finalized'].includes(tx.commitment),
  );
  return {
    id: event && event.id,
    title,
    detail: event && event.render && event.render.detail || title,
    ts: event && event.ts,
    origin: event && event.origin || 'app',
    source: event && event.source,
    tx: tx && tx.signature || null,
    chainObserved,
  };
}

export function makeEvent({
  id,
  type,
  ts,
  bountyId,
  origin = 'app',
  idempotencyKey,
  tx = null,
  source = { kind: 'app', community: null, ref: null },
  raw = null,
  payload = null,
}) {
  const event = {
    schema: EVENT_SCHEMA,
    id,
    type,
    bountyId,
    ts,
    origin,
    idempotencyKey: idempotencyKey || id,
    tx,
    source,
    raw,
    payload,
    render: renderEvent({ id, type, ts, origin, tx, source }, null),
  };
  const v = validateEvent(event);
  if (!v.ok) {
    const err = new Error(v.errors.map((e) => `${e.path}: ${e.msg}`).join('; '));
    err.errors = v.errors;
    throw err;
  }
  return event;
}

export function dedupeEvents(events) {
  const seen = new Map();
  const out = [];
  (events || []).forEach((event) => {
    const key = event && (event.idempotencyKey || event.id) || '';
    if (!key || seen.has(key)) return;
    seen.set(key, event);
    out.push(event);
  });
  return out;
}

export function isStaleFeed(feed, now = new Date(), maxAgeMs = 6 * 60 * 60 * 1000) {
  const stamp = feed && (feed.generatedAt || feed.fetchedAt || feed.updatedAt);
  if (!stamp) return { stale: false, unknown: true, ageMs: null };
  const at = Date.parse(stamp);
  if (!Number.isFinite(at)) return { stale: false, unknown: true, ageMs: null };
  const ageMs = new Date(now).getTime() - at;
  return { stale: ageMs > maxAgeMs, unknown: false, ageMs };
}
