/**
 * NodeBlink exact-USDC receipt adapter for declared Commons bounties.
 *
 * Pinned official contract: nodeblink-sdk@2.1.0
 * Host/routes: https://api.nodeblink.dev POST /api/v2/settlements
 *              POST /api/v2/settlements/:id/verify
 * Webhook: NodeBlink-Signature t=<unix>,v1=<hex hmac of `${t}.${rawBody}`>
 *
 * Provider receipts never set canonical paid. That requires a Commons-valid
 * commons.tx/v1 observation that agrees with the stored intent.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  EVENT_SCHEMA,
  TX_SCHEMA,
  isCanonicalAmount,
  isSolanaAddress,
  validateTx,
} from '../commons/schema.mjs';
import { apply as applyEvent } from '../commons/machine.mjs';

export {
  EVENT_SCHEMA,
  TX_SCHEMA,
  applyEvent,
  isCanonicalAmount,
  isSolanaAddress,
  validateTx,
};

export const NODEBLINK_SDK_NAME = 'nodeblink-sdk';
export const NODEBLINK_SDK_VERSION = '2.1.0';
export const NODEBLINK_SDK_INTEGRITY =
  'sha512-Eavhk3mKxAHR0O6ORWrW8i7Fzq6oTrBM/BGg8GSxzmcIKHqORmz15537eMnUNQoRMxWpqDInDaQXR8gIetltwA==';
export const NODEBLINK_SDK_JS_SHA256 =
  'c263eafdbed2857969a57196fcff1770a2c7a902d48ce6fb02e8ab9c0645474f';
export const NODEBLINK_API_BASE_URL = 'https://api.nodeblink.dev';
export const NODEBLINK_SETTLEMENTS_PATH = '/api/v2/settlements';
export const NODEBLINK_WEBHOOK_HEADER = 'NodeBlink-Signature';
export const NODEBLINK_IDEMPOTENCY_HEADER = 'Idempotency-Key';

export const CANONICAL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const CANONICAL_CHAIN = 'solana';
export const CANONICAL_ASSET = 'spl';
export const CANONICAL_SYMBOL = 'USDC';
export const CANONICAL_DECIMALS = 6;
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

export const SETTLEMENT_WEBHOOK_TYPES = Object.freeze([
  'settlement.detected',
  'settlement.confirmed',
  'settlement.finalized',
  'settlement.failed',
  'settlement.expired',
]);

const CONFIRMING_WEBHOOK_TYPES = new Set(['settlement.confirmed', 'settlement.finalized']);
const FORBIDDEN_HOSTS = new Set(['api.testnet.nodeblink.io', 'api.testnet.nodeblink.dev']);
const TEST_KEY_PREFIX = 'nb_test_';
const LIVE_KEY_PREFIX = 'nb_live_';

export class NodeBlinkTransportError extends Error {
  constructor(message, { status = 0, code = 'error' } = {}) {
    super(message);
    this.name = 'NodeBlinkTransportError';
    this.status = status;
    this.code = code;
  }
}

export function toBaseUnits(amountStr, decimals = CANONICAL_DECIMALS) {
  if (typeof amountStr !== 'string') {
    throw new TypeError('Amount must be a canonical decimal string');
  }
  if (!isCanonicalAmount(amountStr, decimals)) {
    throw new Error(`Amount is not a canonical positive decimal with at most ${decimals} places: ${amountStr}`);
  }
  const [wholePart, rawFrac = ''] = amountStr.split('.');
  const fracPart = rawFrac.padEnd(decimals, '0');
  const baseUnits = BigInt(wholePart + fracPart);
  if (baseUnits <= 0n) {
    throw new Error('Settlement amount in base units must be strictly positive');
  }
  return baseUnits;
}

export function fromBaseUnits(baseUnits, decimals = CANONICAL_DECIMALS) {
  if (typeof baseUnits !== 'bigint') baseUnits = BigInt(baseUnits);
  if (baseUnits <= 0n) throw new Error('Base units must be positive');
  const str = baseUnits.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const frac = str.slice(-decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

function publicView(record) {
  if (!record) return record;
  const {
    rawProviderCreate,
    rawProviderVerify,
    rawWebhook,
    ...visible
  } = record;
  return { ...visible };
}

function header(headers, name) {
  if (!headers) return undefined;
  const want = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want) return value;
  }
  return undefined;
}

function assertOfficialHost(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid NodeBlink base URL: ${baseUrl}`);
  }
  if (FORBIDDEN_HOSTS.has(parsed.hostname)) {
    throw new Error(`Undocumented NodeBlink host rejected: ${parsed.hostname}`);
  }
  if (parsed.hostname !== 'api.nodeblink.dev') {
    throw new Error(`Unsupported NodeBlink host: ${parsed.hostname}. Official host is api.nodeblink.dev`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('NodeBlink transport requires https');
  }
}

export function assertTestSafeCredentials({ apiKey, baseUrl = NODEBLINK_API_BASE_URL, allowLive = false } = {}) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('NodeBlink apiKey is required');
  }
  assertOfficialHost(baseUrl);
  if (allowLive) return;
  if (apiKey.startsWith(LIVE_KEY_PREFIX) || !apiKey.startsWith(TEST_KEY_PREFIX)) {
    throw new Error('Mainnet/live NodeBlink key rejected outside an explicit live canary');
  }
}

function serializeStore(records, processedDigests) {
  return {
    records: Array.from(records.values()).map((r) => {
      const { rawProviderCreate, rawProviderVerify, rawWebhook, ...rest } = r;
      return {
        ...rest,
        baseUnits: r.baseUnits.toString(),
        rawProviderCreate: rawProviderCreate ?? null,
        rawProviderVerify: rawProviderVerify ?? null,
        rawWebhook: rawWebhook ?? null,
      };
    }),
    processedDigests: Array.from(processedDigests),
  };
}

function hydrateRecord(row) {
  if (!row || typeof row !== 'object' || typeof row.idempotencyKey !== 'string' || !row.settlementId) {
    throw new Error('Corrupt settlement store: record missing idempotencyKey or settlementId');
  }
  if (row.baseUnits == null) {
    throw new Error('Corrupt settlement store: record missing baseUnits');
  }
  return {
    ...row,
    baseUnits: BigInt(row.baseUnits),
  };
}

/**
 * File-backed durable settlement store. Persistence errors fail closed.
 * In-memory use is opt-in via { ephemeral: true }.
 */
export class DurableSettlementStore {
  constructor(filePath, { ephemeral = false } = {}) {
    if (!ephemeral && (!filePath || typeof filePath !== 'string')) {
      throw new Error('DurableSettlementStore requires a filePath; ephemeral memory must be explicit');
    }
    this.filePath = filePath || null;
    this.ephemeral = ephemeral;
    this.records = new Map();
    this.processedDigests = new Set();
    this.canonicalEvents = new Map();
    this.load();
  }

  load() {
    if (!this.filePath) return;
    if (!existsSync(this.filePath)) return;
    let text;
    try {
      text = readFileSync(this.filePath, 'utf8');
    } catch (err) {
      throw new Error(`Settlement store read failed: ${err.message}`);
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(`Corrupt settlement store: ${err.message}`);
    }
    if (!data || !Array.isArray(data.records)) {
      throw new Error('Corrupt settlement store: missing records array');
    }
    this.records = new Map();
    for (const row of data.records) {
      const record = hydrateRecord(row);
      this.records.set(record.idempotencyKey, record);
    }
    if (data.processedDigests != null) {
      if (!Array.isArray(data.processedDigests)) {
        throw new Error('Corrupt settlement store: processedDigests must be an array');
      }
      this.processedDigests = new Set(data.processedDigests);
    }
    if (data.canonicalEvents != null) {
      if (!Array.isArray(data.canonicalEvents)) {
        throw new Error('Corrupt settlement store: canonicalEvents must be an array');
      }
      this.canonicalEvents = new Map(data.canonicalEvents);
    }
  }

  save() {
    if (!this.filePath) {
      if (this.ephemeral) return;
      throw new Error('Cannot persist settlement store without filePath');
    }
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const serialized = {
      ...serializeStore(this.records, this.processedDigests),
      canonicalEvents: Array.from(this.canonicalEvents.entries()),
    };
    const tmp = `${this.filePath}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(serialized, null, 2), 'utf8');
      renameSync(tmp, this.filePath);
    } catch (err) {
      throw new Error(`Settlement store write failed: ${err.message}`);
    }
  }

  get(idempotencyKey) {
    return this.records.get(idempotencyKey);
  }

  getBySettlementId(settlementId) {
    for (const r of this.records.values()) {
      if (r.settlementId === settlementId) return r;
    }
    return null;
  }

  getByBountyAndSubmission(bountyId, submissionId) {
    for (const r of this.records.values()) {
      if (r.bountyId === bountyId && r.submissionId === submissionId) return r;
    }
    return null;
  }

  getBySignature(signature) {
    for (const r of this.records.values()) {
      if (r.signature === signature) return r;
    }
    return null;
  }

  set(idempotencyKey, record) {
    this.records.set(idempotencyKey, record);
    this.save();
  }

  hasDigest(digest) {
    return this.processedDigests.has(digest);
  }

  addDigest(digest) {
    this.processedDigests.add(digest);
    this.save();
  }

  rememberCanonical(key, event) {
    if (this.canonicalEvents.has(key)) return this.canonicalEvents.get(key);
    this.canonicalEvents.set(key, event);
    this.save();
    return event;
  }

  getCanonical(key) {
    return this.canonicalEvents.get(key) || null;
  }
}

export class NodeBlinkClient {
  constructor({
    apiKey,
    baseUrl = NODEBLINK_API_BASE_URL,
    fetchImpl = null,
    timeoutMs = 20_000,
    allowLive = false,
  } = {}) {
    assertTestSafeCredentials({ apiKey, baseUrl, allowLive });
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.allowLive = allowLive;
    this.fetchImpl = fetchImpl || globalThis.fetch;
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('NodeBlink client requires fetch');
    }
  }

  async request(method, path, { body, idempotencyKey } = {}) {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers[NODEBLINK_IDEMPOTENCY_HEADER] = idempotencyKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      throw new NodeBlinkTransportError(`NodeBlink request failed: ${err.name === 'AbortError' ? 'timeout' : 'network'}`, {
        status: 0,
        code: err.name === 'AbortError' ? 'timeout' : 'network',
      });
    } finally {
      clearTimeout(timer);
    }

    let rawText = '';
    try {
      rawText = await res.text();
    } catch (err) {
      throw new NodeBlinkTransportError(`NodeBlink response body unreadable: ${err.message}`, {
        status: res.status,
        code: 'body_read_failed',
      });
    }

    let payload = {};
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        throw new NodeBlinkTransportError('NodeBlink response was not JSON', {
          status: res.status,
          code: 'invalid_json',
        });
      }
    }

    if (res.status < 200 || res.status >= 300) {
      const err = payload && payload.error;
      throw new NodeBlinkTransportError(err?.message || `Request failed with ${res.status}`, {
        status: res.status,
        code: err?.code || 'error',
      });
    }

    return { payload, rawText, status: res.status };
  }

  createSettlement(params) {
    const { idempotencyKey, ...body } = params;
    return this.request('POST', NODEBLINK_SETTLEMENTS_PATH, { body, idempotencyKey });
  }

  verifySettlement(id, params) {
    return this.request('POST', `${NODEBLINK_SETTLEMENTS_PATH}/${id}/verify`, { body: params });
  }
}

function assertCreateParams({ bountyId, submissionId, amount, mint, recipient, idempotencyKey }) {
  if (!bountyId || !submissionId || amount === undefined || !recipient || !idempotencyKey) {
    throw new Error('Missing required settlement parameters: bountyId, submissionId, amount, recipient, idempotencyKey');
  }
  if (!isSolanaAddress(recipient)) {
    throw new Error(`Invalid Solana recipient address: ${recipient}`);
  }
  if (mint !== CANONICAL_USDC_MINT) {
    throw new Error(`Non-canonical mint rejected: ${mint}. Expected canonical USDC mint: ${CANONICAL_USDC_MINT}`);
  }
  if (!isCanonicalAmount(amount, CANONICAL_DECIMALS)) {
    throw new Error(`Amount is not a canonical USDC decimal string: ${amount}`);
  }
}

function intentConflict(existing, next) {
  return (
    existing.bountyId !== next.bountyId ||
    existing.submissionId !== next.submissionId ||
    existing.baseUnits !== next.baseUnits ||
    existing.mint !== next.mint ||
    existing.recipient !== next.recipient ||
    existing.reference !== next.reference ||
    (next.destinationTokenAccount && existing.destinationTokenAccount !== next.destinationTokenAccount)
  );
}

/**
 * Create one NodeBlink test-mode settlement for an accepted Commons payout.
 * Stores the provider-returned id and raw payload. Never invents st_ ids.
 */
export async function createSettlement(
  {
    bountyId,
    submissionId,
    amount,
    mint = CANONICAL_USDC_MINT,
    recipient,
    reference = null,
    destinationTokenAccount = null,
    idempotencyKey,
  },
  { store, client } = {},
) {
  if (!store) throw new Error('Durable store is required');
  if (!client) throw new Error('NodeBlink client is required');

  assertCreateParams({ bountyId, submissionId, amount, mint, recipient, idempotencyKey });
  if (destinationTokenAccount && !isSolanaAddress(destinationTokenAccount)) {
    throw new Error(`Invalid destination token account: ${destinationTokenAccount}`);
  }

  const baseUnits = toBaseUnits(amount, CANONICAL_DECIMALS);
  const normalizedDecimal = fromBaseUnits(baseUnits, CANONICAL_DECIMALS);
  const canonicalReference = reference || `commons:${bountyId}:${submissionId}`;
  const nextIntent = {
    bountyId,
    submissionId,
    baseUnits,
    mint,
    recipient,
    reference: canonicalReference,
    destinationTokenAccount,
  };

  const existingForSubmission = store.getByBountyAndSubmission(bountyId, submissionId);
  if (existingForSubmission && existingForSubmission.recipient !== recipient) {
    throw new Error(
      `Recipient immutability violation: Submission ${submissionId} already bound to recipient ${existingForSubmission.recipient}`,
    );
  }
  if (existingForSubmission && destinationTokenAccount && existingForSubmission.destinationTokenAccount && existingForSubmission.destinationTokenAccount !== destinationTokenAccount) {
    throw new Error(`Destination token account immutability violation for submission ${submissionId}`);
  }

  const existing = store.get(idempotencyKey);
  if (existing) {
    if (intentConflict(existing, nextIntent)) {
      throw new Error(`Idempotency conflict for key ${idempotencyKey}`);
    }
    return { ...publicView(existing), idempotent_hit: true };
  }

  const { payload, rawText } = await client.createSettlement({
    amount: normalizedDecimal,
    recipient,
    reference: canonicalReference,
    idempotencyKey,
  });

  if (!payload || typeof payload.id !== 'string' || !payload.id) {
    throw new Error('Provider create response missing settlement id');
  }
  if (payload.object && payload.object !== 'settlement') {
    throw new Error('Provider create response was not a settlement');
  }
  if (payload.mode === 'live' && !client.allowLive) {
    throw new Error('Live-mode NodeBlink settlement rejected outside an explicit live canary');
  }
  if (payload.recipient && payload.recipient !== recipient) {
    throw new Error('Provider recipient does not match the frozen Commons payout identity');
  }
  if (payload.mint && payload.mint !== CANONICAL_USDC_MINT) {
    throw new Error('Provider mint is not canonical USDC');
  }
  if (payload.amount_minor && BigInt(payload.amount_minor) !== baseUnits) {
    throw new Error('Provider amount_minor does not match the declared Commons amount');
  }

  const providerReference = payload.payment?.reference || payload.reference_key || null;
  const record = {
    sdk: `${NODEBLINK_SDK_NAME}@${NODEBLINK_SDK_VERSION}`,
    settlementId: payload.id,
    idempotencyKey,
    bountyId,
    submissionId,
    amount: normalizedDecimal,
    baseUnits,
    decimals: CANONICAL_DECIMALS,
    mint,
    recipient,
    destinationTokenAccount,
    reference: canonicalReference,
    providerReference,
    status: 'pending_payment',
    signature: null,
    createdAt: payload.created_at || new Date().toISOString(),
    providerStatus: payload.status || 'requires_payment',
    providerMode: payload.mode || 'test',
    rawProviderCreate: rawText,
    rawProviderVerify: null,
    rawWebhook: null,
  };
  store.set(idempotencyKey, record);
  return publicView(record);
}

/**
 * Ask NodeBlink to verify a signature against the stored settlement.
 * A provider-confirmed result is payment_submitted, never canonical paid.
 */
export async function verifySettlement({ settlementId, signature }, { store, client } = {}) {
  if (!settlementId || !signature) {
    throw new Error('Missing settlementId or signature');
  }
  if (!store) throw new Error('Durable store is required');
  if (!client) throw new Error('NodeBlink client is required');

  const found = store.getBySettlementId(settlementId);
  if (!found) {
    return {
      verified: false,
      reason: 'settlement_not_found',
      status: 'reconcile_required',
    };
  }

  const boundToSignature = store.getBySignature(signature);
  if (boundToSignature && boundToSignature.settlementId !== settlementId) {
    return {
      verified: false,
      reason: 'signature_settlement_mismatch',
      status: 'reconcile_required',
    };
  }

  if (found.status === 'cancelled') {
    return {
      verified: false,
      reason: 'late_confirmation_after_cancel',
      status: 'reconcile_required',
      settlementId,
    };
  }

  let transport;
  try {
    transport = await client.verifySettlement(settlementId, { signature });
  } catch (err) {
    found.status = 'reconcile_required';
    found.verifyError = err.code || err.message;
    store.set(found.idempotencyKey, found);
    return {
      verified: false,
      reason: err.code === 'timeout' ? 'verify_timeout' : 'provider_verify_failed',
      status: 'reconcile_required',
      settlementId,
    };
  }

  const payload = transport.payload || {};
  found.rawProviderVerify = transport.rawText;
  found.signature = signature;
  found.providerStatus = payload.status || payload.result || found.providerStatus;
  found.providerResult = payload.result || null;

  if (payload.mode === 'live' && !client.allowLive) {
    found.status = 'reconcile_required';
    store.set(found.idempotencyKey, found);
    return {
      verified: false,
      reason: 'live_mode_rejected',
      status: 'reconcile_required',
      settlementId,
    };
  }

  const providerConfirmed = payload.result === 'confirmed' || payload.status === 'confirmed';
  if (!providerConfirmed) {
    found.status = payload.result === 'pending' || payload.status === 'pending' ? 'payment_submitted' : 'reconcile_required';
    store.set(found.idempotencyKey, found);
    return {
      verified: false,
      reason: payload.reason || payload.result || 'provider_not_confirmed',
      status: found.status,
      settlementId,
      signature,
    };
  }

  found.status = 'payment_submitted';
  found.verifiedAt = new Date().toISOString();
  store.set(found.idempotencyKey, found);

  return {
    sdk: `${NODEBLINK_SDK_NAME}@${NODEBLINK_SDK_VERSION}`,
    verified: true,
    settlementId,
    signature,
    reference: found.reference,
    status: 'payment_submitted',
    providerResult: payload.result || 'confirmed',
    verifiedAt: found.verifiedAt,
  };
}

function rawBodyString(rawBody) {
  if (typeof rawBody === 'string') return rawBody;
  if (Buffer.isBuffer(rawBody) || rawBody instanceof Uint8Array) {
    return Buffer.from(rawBody).toString('utf8');
  }
  return null;
}

export function signNodeBlinkWebhook(rawBody, secret, timestampSeconds) {
  const raw = rawBodyString(rawBody);
  if (raw == null) throw new Error('Webhook signing requires raw bytes or a string');
  const v1 = createHmac('sha256', secret).update(`${timestampSeconds}.${raw}`).digest('hex');
  return `t=${timestampSeconds},v1=${v1}`;
}

/**
 * Official NodeBlink webhook verification (nodeblink-sdk 2.1.0 scheme).
 * Fails closed on missing timestamp/event, object reserialization, or unbound settlement.
 */
export function verifyWebhook(
  { headers, rawBody, webhookSecret, currentTime = Date.now() },
  store,
) {
  if (!headers || rawBody == null || rawBody === '' || !webhookSecret) {
    return { verified: false, reason: 'missing_arguments' };
  }
  if (!store) {
    return { verified: false, reason: 'store_required' };
  }

  const raw = rawBodyString(rawBody);
  if (raw == null) {
    return { verified: false, reason: 'raw_body_required' };
  }

  const sigHeader = header(headers, NODEBLINK_WEBHOOK_HEADER);
  if (!sigHeader) {
    return { verified: false, reason: 'missing_signature_header' };
  }

  let timestamp = null;
  let v1 = null;
  for (const part of String(sigHeader).split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = Number(value);
    else if (key === 'v1') v1 = value;
  }
  if (timestamp == null || !Number.isFinite(timestamp) || !v1) {
    return { verified: false, reason: 'missing_timestamp_or_signature' };
  }

  const nowSeconds = Math.floor(currentTime / 1000);
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    return { verified: false, reason: 'webhook_timestamp_stale_or_skewed' };
  }

  const expectedHex = createHmac('sha256', webhookSecret).update(`${timestamp}.${raw}`).digest('hex');
  let provided;
  let expected;
  try {
    provided = Buffer.from(v1, 'hex');
    expected = Buffer.from(expectedHex, 'hex');
  } catch {
    return { verified: false, reason: 'invalid_signature' };
  }
  if (provided.length !== expected.length || provided.length === 0 || !timingSafeEqual(provided, expected)) {
    return { verified: false, reason: 'invalid_signature' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { verified: false, reason: 'invalid_json_body' };
  }

  const eventType = parsed && parsed.type;
  if (!eventType) {
    return { verified: false, reason: 'missing_event_type' };
  }
  if (!SETTLEMENT_WEBHOOK_TYPES.includes(eventType)) {
    return { verified: false, reason: `unsupported_event_type:${eventType}` };
  }

  const object = parsed.data && parsed.data.object;
  const settlementId = object && object.id;
  if (!settlementId) {
    return { verified: false, reason: 'webhook_missing_settlement_id' };
  }

  const found = store.getBySettlementId(settlementId);
  if (!found) {
    return { verified: false, reason: 'settlement_not_bound' };
  }
  if (object.recipient && object.recipient !== found.recipient) {
    return { verified: false, reason: 'webhook_recipient_mismatch', status: 'reconcile_required' };
  }
  if (object.mint && object.mint !== found.mint) {
    return { verified: false, reason: 'webhook_mint_mismatch', status: 'reconcile_required' };
  }
  if (object.amount_minor && BigInt(object.amount_minor) !== found.baseUnits) {
    return { verified: false, reason: 'webhook_amount_mismatch', status: 'reconcile_required' };
  }

  const digest = `${timestamp}.${expectedHex}`;
  if (store.hasDigest(digest)) {
    return {
      verified: false,
      reason: 'webhook_replay_detected',
      settlementId,
      event: eventType,
    };
  }
  store.addDigest(digest);
  found.rawWebhook = raw;
  found.lastWebhookType = eventType;

  if (found.status === 'cancelled') {
    found.status = 'reconcile_required';
    store.set(found.idempotencyKey, found);
    return {
      verified: true,
      event: eventType,
      settlementId,
      status: 'reconcile_required',
      reason: 'late_confirmation_after_cancel',
      digest,
    };
  }

  if (CONFIRMING_WEBHOOK_TYPES.has(eventType) && found.status === 'pending_payment') {
    found.status = 'reconcile_required';
    store.set(found.idempotencyKey, found);
    return {
      verified: true,
      event: eventType,
      settlementId,
      status: 'reconcile_required',
      reason: 'webhook_before_payment_submitted',
      digest,
      data: object,
    };
  }

  if (CONFIRMING_WEBHOOK_TYPES.has(eventType) && found.status === 'payment_submitted') {
    found.providerStatus = object.status || 'confirmed';
    store.set(found.idempotencyKey, found);
  } else {
    store.set(found.idempotencyKey, found);
  }

  return {
    sdk: `${NODEBLINK_SDK_NAME}@${NODEBLINK_SDK_VERSION}`,
    verified: true,
    event: eventType,
    settlementId,
    data: object,
    digest,
    status: found.status,
  };
}

export function mapExternalReceipt({
  settlement,
  externalId,
  signature,
  providerStatus = 'confirmed',
  webhookDigest,
}) {
  return {
    schema: 'commons.external-receipt/v1',
    sdk: `${NODEBLINK_SDK_NAME}@${NODEBLINK_SDK_VERSION}`,
    provider: 'nodeblink',
    purpose: 'winner_payment',
    bountyId: settlement.bountyId,
    submissionId: settlement.submissionId,
    externalId: externalId || settlement.settlementId,
    signature,
    expected: {
      chain: CANONICAL_CHAIN,
      asset: CANONICAL_ASSET,
      symbol: CANONICAL_SYMBOL,
      mint: CANONICAL_USDC_MINT,
      decimals: CANONICAL_DECIMALS,
      amount: String(settlement.amount),
      baseUnits: String(settlement.baseUnits !== undefined ? settlement.baseUnits : toBaseUnits(settlement.amount)),
      recipientOwner: settlement.recipient,
      destination: settlement.recipient,
      destinationTokenAccount: settlement.destinationTokenAccount || null,
      reference: settlement.reference || `commons:${settlement.bountyId}:${settlement.submissionId}`,
      providerReference: settlement.providerReference || null,
    },
    providerStatus,
    providerObservedAt: new Date().toISOString(),
    webhookDigest: webhookDigest || null,
  };
}

export function buildCommonsTx({
  signature,
  source,
  destination,
  amount,
  mint = CANONICAL_USDC_MINT,
  purpose = 'settlement',
  status = 'confirmed',
  success,
  slot,
  commitment,
  observedBy,
  reference = null,
  destinationTokenAccount = null,
  sourceTokenAccount = null,
} = {}) {
  const tx = {
    schema: TX_SCHEMA,
    signature,
    chain: CANONICAL_CHAIN,
    purpose,
    status,
    source,
    destination,
    asset: CANONICAL_ASSET,
    symbol: CANONICAL_SYMBOL,
    amount,
    mint,
    reference,
    destinationTokenAccount,
    sourceTokenAccount,
  };
  if (status === 'submitted') return tx;
  tx.success = success === undefined ? status === 'confirmed' : success;
  if (slot !== undefined) tx.slot = slot;
  if (commitment) tx.commitment = commitment;
  if (observedBy) tx.observedBy = observedBy;
  if (status === 'confirmed') {
    if (tx.slot === undefined) tx.slot = 0;
    if (!tx.commitment) tx.commitment = 'finalized';
    if (!tx.observedBy) tx.observedBy = 'independent-solana-rpc';
  }
  return tx;
}

/**
 * Reconcile a NodeBlink receipt with an independent commons.tx/v1 observation.
 * Uses Commons validateTx / canonical amounts. Never promotes receipt-only facts to paid.
 */
export function reconcilePayment({ externalReceipt, chainObservation }) {
  const reasons = [];

  if (!externalReceipt || externalReceipt.schema !== 'commons.external-receipt/v1') {
    reasons.push('invalid_external_receipt_schema');
  }
  const tx = validateTx(chainObservation, { required: true, statuses: ['submitted', 'confirmed', 'failed', 'not_found'] });
  if (!tx.ok) {
    reasons.push('invalid_chain_observation_schema');
    for (const err of tx.errors) reasons.push(`tx.${err.path || 'value'}:${err.msg}`);
  }
  if (reasons.length > 0) {
    return { status: 'reconcile_required', reasons };
  }

  if (externalReceipt.providerStatus !== 'confirmed') {
    reasons.push(`provider_status_unconfirmed:${externalReceipt.providerStatus}`);
  }
  if (chainObservation.status !== 'confirmed' || chainObservation.success !== true) {
    reasons.push('chain_tx_not_confirmed_or_successful');
  }
  if (!['confirmed', 'finalized'].includes(chainObservation.commitment)) {
    reasons.push('chain_commitment_not_confirmed_or_finalized');
  }
  if (chainObservation.purpose !== 'settlement') {
    reasons.push('wrong_transaction_purpose');
  }
  if (externalReceipt.signature !== chainObservation.signature) {
    reasons.push('signature_mismatch');
  }
  if (chainObservation.mint !== CANONICAL_USDC_MINT || externalReceipt.expected.mint !== CANONICAL_USDC_MINT) {
    reasons.push('mint_mismatch_or_non_canonical');
  }
  if (chainObservation.symbol !== CANONICAL_SYMBOL) {
    reasons.push('symbol_mismatch');
  }

  try {
    if (!isCanonicalAmount(externalReceipt.expected.amount, CANONICAL_DECIMALS)) {
      reasons.push('expected_amount_not_canonical');
    }
    if (!isCanonicalAmount(chainObservation.amount, CANONICAL_DECIMALS)) {
      reasons.push('observed_amount_not_canonical');
    }
    const expectedBaseUnits = BigInt(externalReceipt.expected.baseUnits || toBaseUnits(externalReceipt.expected.amount));
    const observedBaseUnits = toBaseUnits(chainObservation.amount);
    if (expectedBaseUnits !== observedBaseUnits) {
      reasons.push(`base_units_mismatch:expected_${expectedBaseUnits}_got_${observedBaseUnits}`);
    }
  } catch (err) {
    reasons.push(`amount_parse_error:${err.message}`);
  }

  const expectedOwner = externalReceipt.expected.recipientOwner || externalReceipt.expected.destination;
  if (expectedOwner !== chainObservation.destination) {
    reasons.push('recipient_owner_mismatch');
  }
  if (externalReceipt.expected.destinationTokenAccount) {
    if (!chainObservation.destinationTokenAccount) {
      reasons.push('destination_token_account_missing');
    } else if (externalReceipt.expected.destinationTokenAccount !== chainObservation.destinationTokenAccount) {
      reasons.push('destination_token_account_mismatch');
    }
  }

  if (!chainObservation.reference) {
    reasons.push('reference_missing');
  } else if (externalReceipt.expected.reference !== chainObservation.reference) {
    reasons.push('reference_mismatch');
  }

  if (reasons.length > 0) {
    return {
      status: 'reconcile_required',
      reasons,
      reconciledAt: new Date().toISOString(),
    };
  }

  return {
    status: 'paid',
    bountyId: externalReceipt.bountyId,
    submissionId: externalReceipt.submissionId,
    signature: chainObservation.signature,
    amount: externalReceipt.expected.amount,
    baseUnits: externalReceipt.expected.baseUnits,
    recipient: expectedOwner,
    reference: externalReceipt.expected.reference,
    slot: chainObservation.slot,
    observer: chainObservation.observedBy,
    observedAt: new Date().toISOString(),
    reconciledAt: new Date().toISOString(),
  };
}

/**
 * Drive the Commons observe_settlement transition. Duplicate webhook + poll
 * inputs that share an idempotency key produce one canonical paid event.
 */
export function recordCanonicalSettlement({
  bounty,
  chainObservation,
  externalReceipt,
  idempotencyKey,
  eventId,
  ts,
  store = null,
}) {
  const reconciled = reconcilePayment({ externalReceipt, chainObservation });
  if (reconciled.status !== 'paid') return reconciled;

  const key = idempotencyKey || `commons.observe_settlement:${chainObservation.signature}`;
  if (store) {
    const prior = store.getCanonical(key);
    if (prior) {
      return { ...prior, replayed: true };
    }
  }

  const result = applyEvent(bounty, {
    schema: EVENT_SCHEMA,
    id: eventId || `evt-${key}`.replace(/[^A-Za-z0-9._:/-]/g, '').slice(0, 80),
    type: 'observe_settlement',
    bountyId: bounty.id,
    ts,
    idempotencyKey: key,
    origin: 'chain',
    tx: chainObservation,
  });

  if (!result.ok) {
    return {
      status: 'reconcile_required',
      reasons: [result.error],
      detail: result.detail,
      replayed: Boolean(result.replayed),
    };
  }

  const event = {
    status: result.bounty.settlement.state === 'paid' ? 'paid' : 'reconcile_required',
    replayed: Boolean(result.replayed),
    bountyId: result.bounty.id,
    signature: chainObservation.signature,
    settlementState: result.bounty.settlement.state,
  };
  if (store) store.rememberCanonical(key, event);
  return { ...event, bounty: result.bounty };
}

export function redactSecrets(value, secrets = []) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return secrets.reduce((acc, secret) => {
    if (!secret) return acc;
    return acc.split(String(secret)).join('[redacted]');
  }, text);
}

function inspectPublic(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export function assertNoSecretLeak(value, secrets) {
  const text = inspectPublic(value);
  for (const secret of secrets) {
    if (secret && text.includes(String(secret))) {
      throw new Error('Secret or private payload leaked into public output');
    }
  }
}
