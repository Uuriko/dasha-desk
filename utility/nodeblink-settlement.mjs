/**
 * NodeBlink exact-USDC receipt adapter for declared Commons bounties.
 * Pinned OpenAPI Version: 2026-03-01
 * Schema: commons.external-receipt/v1
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const NODEBLINK_API_VERSION = '2026-03-01';
export const CANONICAL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const CANONICAL_CHAIN = 'solana';
export const CANONICAL_ASSET = 'spl-token';
export const CANONICAL_SYMBOL = 'USDC';
export const CANONICAL_DECIMALS = 6;

const BASE58_PUBKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// In-memory settlement registry for test-mode fixtures
const settlementStore = new Map();

/**
 * Validates a Solana Base58 public key.
 */
export function isValidSolanaAddress(address) {
  return typeof address === 'string' && BASE58_PUBKEY_REGEX.test(address.trim());
}

/**
 * Strict conversion from decimal string to integer base units (BigInt).
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
 * M0: Create settlement intent with idempotency guarantees and integer base-unit validation.
 */
export function createSettlement({
  bountyId,
  submissionId,
  amount,
  mint = CANONICAL_USDC_MINT,
  recipient,
  idempotencyKey,
}) {
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

  // Check idempotency
  if (settlementStore.has(idempotencyKey)) {
    const existing = settlementStore.get(idempotencyKey);
    const isConflict =
      existing.bountyId !== bountyId ||
      existing.submissionId !== submissionId ||
      existing.baseUnits !== baseUnits ||
      existing.mint !== mint ||
      existing.recipient !== recipient;

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
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
  };

  settlementStore.set(idempotencyKey, record);
  return record;
}

/**
 * M0: Verify settlement state with signature.
 * Invariant: Transitions to 'payment_submitted', never directly sets 'paid'.
 */
export function verifySettlement({ settlementId, signature }) {
  if (!settlementId || !signature) {
    throw new Error('Missing settlementId or signature');
  }

  let found = null;
  for (const s of settlementStore.values()) {
    if (s.settlementId === settlementId) {
      found = s;
      break;
    }
  }

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
    status: 'payment_submitted',
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * M0: Timing-safe HMAC webhook verification against pinned revision.
 */
export function verifyWebhook({ headers, rawBody, webhookSecret }) {
  if (!headers || !rawBody || !webhookSecret) {
    return { verified: false, reason: 'missing_arguments' };
  }

  const sigHeader = headers['x-nodeblink-signature'] || headers['X-NodeBlink-Signature'];
  if (!sigHeader) {
    return { verified: false, reason: 'missing_signature_header' };
  }

  const hmac = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const provided = Buffer.from(sigHeader, 'utf8');
  const expected = Buffer.from(hmac, 'utf8');

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { verified: false, reason: 'invalid_signature' };
  }

  let parsed;
  try {
    parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    return { verified: false, reason: 'invalid_json_body' };
  }

  return {
    apiVersion: NODEBLINK_API_VERSION,
    verified: true,
    event: parsed.event || 'settlement.confirmed',
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
      reference: settlement.submissionId,
    },
    providerStatus,
    providerObservedAt: new Date().toISOString(),
    webhookDigest: webhookDigest || null,
  };
}

/**
 * M1 & M2: Reconcile external receipt with independent chain observation (commons.tx/v1).
 * Exact integer base-unit and canonical identity equality required for 'paid'.
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
    observedAt: chainObservation.observedAt || new Date().toISOString(),
    reconciledAt: new Date().toISOString(),
  };
}
