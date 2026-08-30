/**
 * Activity Tape: stable events, source attribution, human render, chain vs app.
 * Human kinds only: created, funded, submitted, selected, paid, cancelled.
 * Not the /digest price tape. No Helius SDK — observers ingest via eventFromWebhook.
 */
import { EVENT_SCHEMA, validateEvent, nowIso } from './schema.mjs';

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

export const HUMAN_KINDS = Object.freeze(['created', 'funded', 'submitted', 'selected', 'paid', 'cancelled']);

const TYPE_TO_KIND = Object.freeze({
  publish: 'created',
  observe_funding: 'funded',
  submit: 'submitted',
  select_winner: 'selected',
  observe_settlement: 'paid',
  cancel: 'cancelled',
  expire: 'cancelled',
});

const KIND_TO_TYPE = Object.freeze({
  created: 'publish',
  funded: 'observe_funding',
  submitted: 'submit',
  selected: 'select_winner',
  paid: 'observe_settlement',
  cancelled: 'cancel',
});

const KIND_ORDER = Object.freeze({
  created: 0,
  funded: 1,
  submitted: 2,
  selected: 3,
  paid: 4,
  cancelled: 5,
});

function purposeFor(type) {
  if (type === 'observe_funding') return 'funding';
  if (type === 'observe_settlement') return 'settlement';
  if (type === 'observe_refund') return 'refund';
  return 'other';
}

export function humanKind(event) {
  return (event && TYPE_TO_KIND[event.type]) || null;
}

export function actorName(identity) {
  if (!identity) return 'someone';
  if (identity.handle) return String(identity.handle).replace(/^@/, '');
  if (identity.kind === 'github' && identity.id) return String(identity.id);
  const wallet = identity.wallet || (identity.kind === 'wallet' ? identity.id : null);
  if (wallet && wallet.length >= 8) return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
  if (identity.id && String(identity.id).length <= 16) return String(identity.id);
  return 'someone';
}

export function bountyRef(id) {
  const s = String(id || '');
  const numbered = s.match(/(\d+)$/);
  if (numbered) return `#${numbered[1]}`;
  if (s.length && s.length <= 16) return s;
  return s ? s.slice(0, 8) : 'bounty';
}

function rewardText(bounty) {
  const reward = bounty && bounty.reward;
  if (!reward || reward.amount == null) return 'USDC';
  return `${String(reward.amount).replace(/\.0+$/, '')} ${reward.symbol || 'USDC'}`;
}

function payloadActor(event, bounty) {
  const payload = event && event.payload;
  if (payload && payload.actor) return payload.actor;
  if (payload && payload.submission && payload.submission.submitter) return payload.submission.submitter;
  if (payload && payload.winners && payload.winners[0] && payload.winners[0].identity) {
    return payload.winners[0].identity;
  }
  return bounty && bounty.creator;
}

export function renderTapeLine(event, bounty) {
  const kind = humanKind(event);
  const ref = bountyRef((event && event.bountyId) || (bounty && bounty.id));
  const who = actorName(payloadActor(event, bounty));
  if (kind === 'created') return `${who} created bounty ${ref}`;
  if (kind === 'funded') return `${who} funded bounty ${ref}`;
  if (kind === 'submitted') return `${actorName(payloadActor(event, bounty))} submitted work`;
  if (kind === 'selected') return `bounty ${ref} winner selected`;
  if (kind === 'paid') return `bounty ${ref} paid ${rewardText(bounty)}`;
  if (kind === 'cancelled') return `bounty ${ref} cancelled`;
  return '';
}

export function toTapeEntry(event, bounty) {
  const kind = humanKind(event);
  if (!kind) return null;
  const tx = event && event.tx && event.tx.signature ? event.tx.signature : null;
  const origin = (event && event.origin) || 'app';
  return {
    id: event.id,
    idempotencyKey: event.idempotencyKey || event.id,
    kind,
    line: renderTapeLine(event, bounty),
    ts: event.ts,
    origin,
    source: event.source || null,
    tx,
    chainObserved: origin === 'chain' && Boolean(tx),
    bountyId: event.bountyId || (bounty && bounty.id) || null,
  };
}

export function eventFromWebhook(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const type = payload.type || KIND_TO_TYPE[payload.kind] || null;
  if (!type || !TYPE_TO_KIND[type]) return null;
  const id = payload.id || payload.idempotencyKey;
  const idempotencyKey = payload.idempotencyKey || payload.id;
  if (!id || !idempotencyKey) return null;
  const signature = (payload.tx && payload.tx.signature) || payload.signature || null;
  const origin = payload.origin || (signature ? 'chain' : 'app');
  const tx = payload.tx
    ? payload.tx
    : signature
      ? { signature, chain: 'solana', purpose: purposeFor(type), origin }
      : null;
  try {
    return makeEvent({
      id,
      type,
      ts: payload.ts || nowIso(),
      bountyId: payload.bountyId || null,
      origin,
      idempotencyKey,
      tx,
      source: payload.source || { kind: origin === 'chain' ? 'chain' : 'webhook', community: null, ref: payload.ref || null },
      raw: payload.raw || payload,
      payload: payload.payload || (payload.actor ? { actor: payload.actor } : null),
    });
  } catch {
    return null;
  }
}

function sortEntries(entries) {
  return entries.slice().sort((a, b) => {
    const ta = Date.parse(a.ts) || 0;
    const tb = Date.parse(b.ts) || 0;
    if (ta !== tb) return ta - tb;
    return (KIND_ORDER[a.kind] || 0) - (KIND_ORDER[b.kind] || 0);
  });
}

export function mergeTapeEntries(existing, incoming) {
  const seen = new Set();
  const out = [];
  (existing || []).concat(incoming || []).forEach((row) => {
    const key = (row && (row.idempotencyKey || row.id)) || '';
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(row);
  });
  return sortEntries(out);
}

export function ingestTape(entries, incoming, bounty) {
  const batch = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
  const current = Array.isArray(entries) ? entries.slice() : [];
  const seen = new Set(current.map((row) => row.idempotencyKey || row.id));
  let replayed = batch.length > 0;
  const added = [];
  batch.forEach((raw) => {
    const event = raw && raw.schema === EVENT_SCHEMA ? raw : eventFromWebhook(raw);
    if (!event) return;
    const row = toTapeEntry(event, bounty);
    if (!row) return;
    const key = row.idempotencyKey || row.id;
    if (seen.has(key)) return;
    seen.add(key);
    replayed = false;
    current.push(row);
    added.push(row);
  });
  return { ok: true, entries: sortEntries(current), replayed, added: added.length };
}

export function eventsFromBounty(bounty) {
  if (!bounty || !bounty.id) return [];
  const id = bounty.id;
  const source = bounty.source || { kind: 'app', community: null, ref: null };
  const out = [];
  out.push(
    makeEvent({
      id: `created:${id}`,
      type: 'publish',
      ts: bounty.createdAt || nowIso(),
      bountyId: id,
      origin: 'app',
      idempotencyKey: `created:${id}`,
      source,
      payload: { actor: bounty.creator },
    }),
  );
  const fundTx = bounty.funding && bounty.funding.tx;
  if (fundTx && fundTx.signature) {
    const origin = fundTx.origin === 'app' ? 'app' : 'chain';
    out.push(
      makeEvent({
        id: `funded:${id}:${fundTx.signature}`,
        type: 'observe_funding',
        ts: bounty.createdAt || nowIso(),
        bountyId: id,
        origin,
        idempotencyKey: `funded:${id}:${fundTx.signature}`,
        tx: { ...fundTx, purpose: 'funding', origin },
        source: { kind: origin === 'chain' ? 'chain' : 'app', community: null, ref: null },
        payload: { actor: bounty.creator },
      }),
    );
  }
  let lastSubmit = null;
  (bounty.submissions || []).forEach((submission) => {
    const submittedAt = submission.submittedAt || bounty.createdAt || nowIso();
    if (!lastSubmit || Date.parse(submittedAt) > Date.parse(lastSubmit)) lastSubmit = submittedAt;
    out.push(
      makeEvent({
        id: `submitted:${id}:${submission.id}`,
        type: 'submit',
        ts: submittedAt,
        bountyId: id,
        origin: 'app',
        idempotencyKey: `submitted:${id}:${submission.id}`,
        source,
        payload: { actor: submission.submitter, submission },
      }),
    );
  });
  const afterWork = [bounty.selectedAt, lastSubmit, bounty.createdAt].reduce((best, stamp) => {
    if (!stamp) return best;
    if (!best) return stamp;
    return Date.parse(stamp) >= Date.parse(best) ? stamp : best;
  }, null);
  if (bounty.winners && bounty.winners.length) {
    out.push(
      makeEvent({
        id: `selected:${id}`,
        type: 'select_winner',
        ts: afterWork || nowIso(),
        bountyId: id,
        origin: 'app',
        idempotencyKey: `selected:${id}`,
        source,
        payload: { actor: bounty.creator, winners: bounty.winners },
      }),
    );
  }
  const payTx = bounty.settlement && bounty.settlement.tx;
  if (payTx && payTx.signature) {
    const origin = payTx.origin === 'app' ? 'app' : 'chain';
    out.push(
      makeEvent({
        id: `paid:${id}:${payTx.signature}`,
        type: 'observe_settlement',
        ts: afterWork || nowIso(),
        bountyId: id,
        origin,
        idempotencyKey: `paid:${id}:${payTx.signature}`,
        tx: { ...payTx, purpose: 'settlement', origin },
        source: { kind: origin === 'chain' ? 'chain' : 'app', community: null, ref: null },
        payload: { actor: bounty.creator },
      }),
    );
  }
  if (bounty.state === 'cancelled' || bounty.state === 'refund_pending' || bounty.state === 'refunded') {
    out.push(
      makeEvent({
        id: `cancelled:${id}`,
        type: 'cancel',
        ts: (bounty.cancellation && bounty.cancellation.at) || bounty.createdAt || nowIso(),
        bountyId: id,
        origin: 'app',
        idempotencyKey: `cancelled:${id}`,
        source,
        payload: { actor: bounty.creator, reason: bounty.cancellation && bounty.cancellation.reason },
      }),
    );
  }
  return out;
}

export function tapeFromBounties(bounties) {
  let entries = [];
  (bounties || []).forEach((bounty) => {
    entries = ingestTape(entries, eventsFromBounty(bounty), bounty).entries;
  });
  return entries;
}
