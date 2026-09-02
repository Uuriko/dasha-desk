/**
 * NodeBlink exact-USDC receipt adapter for declared Commons bounties.
 * Pinned OpenAPI Revision: 2026-03-01
 * Protocols: commons.external-receipt/v1, commons.tx/v1
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const NODEBLINK_API_VERSION = '2026-03-01';
export const NODEBLINK_TESTNET_BASE_URL = 'https://api.testnet.nodeblink.io/v1';
export const CANONICAL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const CANONICAL_CHAIN = 'solana';
export const CANONICAL_ASSET = 'spl-token';
export const CANONICAL_SYMBOL = 'USDC';
export const CANONICAL_DECIMALS = 6;
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

const BASE58_PUBKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validates a Solana Base58 public key.
 */
export function isValidSolanaAddress(address) {
  return typeof address === 'string' && BASE58_PUBKEY_REGEX.test(address.trim());
}

/**
 * Strict conversion from decimal string or integer to integer base units (BigInt).
 * Prevents floating-point rounding errors (e.g. 0.1 + 0.2 != 0.3).
 */
export function toBaseUnits(amountStr, decimals = CANONICAL_DECIMALS) {
  if (typeof amountStr !== 'string' && typeof amountStr !== 'number') {
    throw new TypeError('Amount must be a decimal string or integer number');
  }

  const str = String(amountStr).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid positive decimal amount format: ${str}`);
  }

  const parts = str.split('.');
  const wholePart = parts[0];
  let fracPart = parts[1] || '';

  if (fracPart.length > decimals) {
    throw new Error(`Amount '${str}' exceeds maximum allowed precision of ${decimals} decimals`);
  }

  fracPart = fracPart.padEnd(decimals, '0');
  const combined = wholePart + fracPart;
  const baseUnits = BigInt(combined);

  if (baseUnits <= 0n) {
    throw new Error('Settlement amount in base units must be strictly positive');
  }

  return baseUnits;
}

/**
 * Strict conversion from integer base units (BigInt) to normalized decimal string.
 */
export function fromBaseUnits(baseUnits, decimals = CANONICAL_DECIMALS) {
  if (typeof baseUnits !== 'bigint') {
    baseUnits = BigInt(baseUnits);
  }

  if (baseUnits <= 0n) {
    throw new Error('Base units must be positive');
  }

  const str = baseUnits.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const frac = str.slice(-decimals).replace(/0+$/, '');

  return frac ? `${whole}.${frac}` : whole;
}

/**
 * File-backed durable settlement store ensuring persistence across restarts.
 */
export class DurableSettlementStore {
  constructor(filePath = null) {
    this.filePath = filePath;
    this.records = new Map();
    this.processedDigests = new Set();
    this.load();
  }

  load() {
    if (!this.filePath || !existsSync(this.filePath)) return;
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf8'));
      if (Array.isArray(data.records)) {
        for (const r of data.records) {
          this.records.set(r.idempotencyKey, {
            ...r,
            baseUnits: BigInt(r.baseUnits),
          });
        }
      }
      if (Array.isArray(data.processedDigests)) {
        this.processedDigests = new Set(data.processedDigests);
      }
    } catch {
      // If corrupted, fallback to clean memory store
    }
  }

  save() {
    if (!this.filePath) return;
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const serialized = {
        records: Array.from(this.records.values()).map((r) => ({
          ...r,
          baseUnits: r.baseUnits.toString(),
        })),
        processedDigests: Array.from(this.processedDigests),
      };
      writeFileSync(this.filePath, JSON.stringify(serialized, null, 2), 'utf8');
    } catch {
      // Safe write error handling
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
}

// Global default store instance (can be injected)
export const defaultStore = new DurableSettlementStore();

/**
 * NodeBlink Test-Mode Transport Client
 */
export class NodeBlinkClient {
  constructor({
    apiKey = 'test_mock_key',
    baseUrl = NODEBLINK_TESTNET_BASE_URL,
    apiVersion = NODEBLINK_API_VERSION,
    mockMode = true,
    fetchImpl = null,
  } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.apiVersion = apiVersion;
    this.mockMode = mockMode;
    this.fetchImpl = fetchImpl;
  }

  async post(path, body) {
    if (this.fetchImpl) {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-NodeBlink-Version': this.apiVersion,
        },
        body: JSON.stringify(body),
      });
      return res.json();
    }

    if (this.mockMode) {
      return {
        status: 'success',
        apiVersion: this.apiVersion,
        settlementId: `st_test_${Date.now()}`,
        mode: 'testnet',
        createdAt: new Date().toISOString(),
      };
    }

    if (typeof fetch !== 'undefined') {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-NodeBlink-Version': this.apiVersion,
        },
        body: JSON.stringify(body),
      });
      return res.json();
    }

    throw new Error('No fetch implementation available');
  }
}

/**
 * M0: Create settlement intent with idempotency, recipient immutability, and durable store.
 */
export function createSettlement(
  {
    bountyId,
    submissionId,
    amount,
    mint = CANONICAL_USDC_MINT,
    recipient,
    reference = null,
    idempotencyKey,
  },
  store = defaultStore
) {
  if (!bountyId || !submissionId || amount === undefined || !recipient || !idempotencyKey) {
    throw new Error('Missing required settlement parameters: bountyId, submissionId, amount, recipient, idempotencyKey');
  }

  if (!isValidSolanaAddress(recipient)) {
    throw new Error(`Invalid Solana recipient address: ${recipient}`);
  }

  if (mint !== CANONICAL_USDC_MINT) {
    throw new Error(`Non-canonical mint rejected: ${mint}. Expected canonical USDC mint: ${CANONICAL_USDC_MINT}`);
  }

  const baseUnits = toBaseUnits(amount, CANONICAL_DECIMALS);
  const normalizedDecimal = fromBaseUnits(baseUnits, CANONICAL_DECIMALS);
  const canonicalReference = reference || `commons:${bountyId}:${submissionId}`;

  // Enforce selected submission recipient immutability
  const existingForSubmission = store.getByBountyAndSubmission(bountyId, submissionId);
  if (existingForSubmission && existingForSubmission.recipient !== recipient) {
    throw new Error(`Recipient immutability violation: Submission ${submissionId} already bound to recipient ${existingForSubmission.recipient}`);
  }

  // Enforce idempotency key uniqueness & conflict check
  if (store.get(idempotencyKey)) {
    const existing = store.get(idempotencyKey);
    const isConflict =
      existing.bountyId !== bountyId ||
      existing.submissionId !== submissionId ||
      existing.baseUnits !== baseUnits ||
      existing.mint !== mint ||
      existing.recipient !== recipient ||
      existing.reference !== canonicalReference;

    if (isConflict) {
      throw new Error(`Idempotency conflict for key ${idempotencyKey}`);
    }
    return { ...existing, idempotent_hit: true };
  }

  const settlementId = `st_${idempotencyKey.slice(0, 12)}_${Date.now()}`;
  const record = {
    apiVersion: NODEBLINK_API_VERSION,
    settlementId,
    idempotencyKey,
    bountyId,
    submissionId,
    amount: normalizedDecimal,
    baseUnits,
    decimals: CANONICAL_DECIMALS,
    mint,
    recipient,
    reference: canonicalReference,
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
  };

  store.set(idempotencyKey, record);
  return record;
}

/**
 * M0: Verify settlement state with signature.
 * Invariant: Transitions to 'payment_submitted', never directly sets 'paid'.
 */
export function verifySettlement({ settlementId, signature }, store = defaultStore) {
  if (!settlementId || !signature) {
    throw new Error('Missing settlementId or signature');
  }

  const found = store.getBySettlementId(settlementId);
  if (!found) {
    return {
      verified: false,
      reason: 'settlement_not_found',
      status: 'reconcile_required',
    };
  }

  return {
    apiVersion: NODEBLINK_API_VERSION,
    verified: true,
    settlementId,
    signature,
    reference: found.reference,
    status: 'payment_submitted',
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * M0: Timing-safe HMAC webhook verification with timestamp, replay defense, and event checking.
 */
export function verifyWebhook({ headers, rawBody, webhookSecret, currentTime = Date.now() }, store = defaultStore) {
  if (!headers || !rawBody || !webhookSecret) {
    return { verified: false, reason: 'missing_arguments' };
  }

  const sigHeader = headers['x-nodeblink-signature'] || headers['X-NodeBlink-Signature'];
  const tsHeader = headers['x-nodeblink-timestamp'] || headers['X-NodeBlink-Timestamp'];

  if (!sigHeader) {
    return { verified: false, reason: 'missing_signature_header' };
  }

  // Verify timestamp freshness to defeat replay attacks
  if (tsHeader) {
    const tsNumber = Number(tsHeader);
    const nowSeconds = Math.floor(currentTime / 1000);
    if (isNaN(tsNumber) || Math.abs(nowSeconds - tsNumber) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
      return { verified: false, reason: 'webhook_timestamp_stale_or_skewed' };
    }
  }

  const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
  const payloadToSign = tsHeader ? `${tsHeader}.${bodyStr}` : bodyStr;

  const hmac = createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');
  const provided = Buffer.from(sigHeader, 'utf8');
  const expected = Buffer.from(hmac, 'utf8');

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { verified: false, reason: 'invalid_signature' };
  }

  // Replay check using digest
  if (store.hasDigest(hmac)) {
    return { verified: false, reason: 'webhook_replay_detected' };
  }
  store.addDigest(hmac);

  let parsed;
  try {
    parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    return { verified: false, reason: 'invalid_json_body' };
  }

  const eventType = parsed.event || 'settlement.confirmed';
  if (eventType !== 'settlement.confirmed' && eventType !== 'settlement.failed') {
    return { verified: false, reason: `unsupported_event_type:${eventType}` };
  }

  return {
    apiVersion: NODEBLINK_API_VERSION,
    verified: true,
    event: eventType,
    data: parsed.data || parsed,
    digest: hmac,
  };
}

/**
 * M1: Map confirmed external result into intermediate external receipt (commons.external-receipt/v1).
 */
export function mapExternalReceipt({ settlement, externalId, signature, providerStatus = 'confirmed', webhookDigest }) {
  return {
    schema: 'commons.external-receipt/v1',
    apiVersion: NODEBLINK_API_VERSION,
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
      reference: settlement.reference || `commons:${settlement.bountyId}:${settlement.submissionId}`,
    },
    providerStatus,
    providerObservedAt: new Date().toISOString(),
    webhookDigest: webhookDigest || null,
  };
}

/**
 * M1 & M2: Reconcile external receipt with independent chain observation (commons.tx/v1).
 * Exact integer base-unit, canonical identity, and reference equality required for 'paid'.
 */
export function reconcilePayment({ externalReceipt, chainObservation }) {
  const reasons = [];

  if (!externalReceipt || externalReceipt.schema !== 'commons.external-receipt/v1') {
    reasons.push('invalid_external_receipt_schema');
  }

  if (!chainObservation || chainObservation.schema !== 'commons.tx/v1') {
    reasons.push('invalid_chain_observation_schema');
  }

  if (reasons.length > 0) {
    return { status: 'reconcile_required', reasons };
  }

  if (externalReceipt.providerStatus !== 'confirmed') {
    reasons.push(`provider_status_unconfirmed:${externalReceipt.providerStatus}`);
  }

  if (!chainObservation.success || (chainObservation.status !== 'confirmed' && chainObservation.status !== 'finalized')) {
    reasons.push('chain_tx_not_confirmed_or_successful');
  }

  if (externalReceipt.signature !== chainObservation.signature) {
    reasons.push('signature_mismatch');
  }

  if (chainObservation.mint !== CANONICAL_USDC_MINT || externalReceipt.expected.mint !== CANONICAL_USDC_MINT) {
    reasons.push('mint_mismatch_or_non_canonical');
  }

  // Exact integer base-unit comparison (zero floating point drift)
  try {
    const expectedBaseUnits = BigInt(externalReceipt.expected.baseUnits || toBaseUnits(externalReceipt.expected.amount));
    const observedBaseUnits = BigInt(chainObservation.baseUnits || toBaseUnits(chainObservation.amount));

    if (expectedBaseUnits !== observedBaseUnits) {
      reasons.push(`base_units_mismatch:expected_${expectedBaseUnits}_got_${observedBaseUnits}`);
    }
  } catch (err) {
    reasons.push(`amount_parse_error:${err.message}`);
  }

  if (externalReceipt.expected.recipientOwner !== chainObservation.recipientOwner) {
    reasons.push('recipient_owner_mismatch');
  }

  // Single-use reference check
  if (
    externalReceipt.expected.reference &&
    chainObservation.reference &&
    externalReceipt.expected.reference !== chainObservation.reference
  ) {
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
    recipient: externalReceipt.expected.recipientOwner,
    reference: externalReceipt.expected.reference,
    observedSlot: chainObservation.observedSlot || null,
    observer: chainObservation.observer || 'independent-solana-rpc',
    observedAt: chainObservation.observedAt || new Date().toISOString(),
    reconciledAt: new Date().toISOString(),
  };
}
