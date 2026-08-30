/**
 * Activity Tape: stable events, source attribution, human render, chain vs app.
 * Copy stays short: "25 USDC bounty" / "Submit work" / "Winner selected" / "Paid on Solana".
 */
import { EVENT_SCHEMA, validateEvent } from './schema.mjs';

const TITLES = Object.freeze({
  publish: 'Bounty posted',
  start_funding: 'Funding started',
  observe_funding: 'Funded on Solana',
  open_submissions: 'Submit work',
  submit: 'Work received',
  close_submissions: 'Submissions closed',
  expire: 'Bounty expired',
  select_winner: 'Winner selected',
  start_settlement: 'Paying on Solana',
  observe_settlement: 'Paid on Solana',
  cancel: 'Bounty cancelled',
  request_refund: 'Refund started',
  observe_refund: 'Refunded on Solana',
  fail: 'Bounty failed',
  retry_funding: 'Funding retry',
  retry_settlement: 'Payment retry',
  retry_refund: 'Refund retry',
});

export function renderEvent(event, bounty) {
  const type = event && event.type;
  const reward = bounty && bounty.reward;
  const amount =
    reward && reward.amount != null && reward.symbol
      ? `${String(reward.amount).replace(/\.0+$/, '')} ${reward.symbol} bounty`
      : null;
  let title = (event && event.render && event.render.title) || TITLES[type] || 'Bounty update';
  if (type === 'publish' && amount) title = amount;
  if (type === 'observe_funding' && amount) title = amount;
  const detail = (event && event.render && event.render.detail) || title;
  const tx = event && event.tx && event.tx.signature ? event.tx.signature : null;
  return {
    id: event && event.id,
    title,
    detail,
    ts: event && event.ts,
    origin: (event && event.origin) || 'app',
    source: event && event.source,
    tx,
    chainObserved: event && event.origin === 'chain' && Boolean(tx),
  };
}

export function makeEvent({
  id,
  type,
  ts,
  bountyId = null,
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
  const seen = new Set();
  const out = [];
  (events || []).forEach((event) => {
    const key = (event && (event.idempotencyKey || event.id)) || '';
    if (!key || seen.has(key)) return;
    seen.add(key);
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
