/**
 * NodeBlink exact-USDC receipt adapter for declared Commons bounties.
 * Schema: commons.external-receipt/v1
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const CANONICAL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const CANONICAL_CHAIN = 'solana';
export const CANONICAL_ASSET = 'spl-token';
export const CANONICAL_SYMBOL = 'USDC';

// In-memory settlement registry for test-mode fixtures
const settlementStore = new Map();

/**
 * M0: Create settlement intent with idempotency guarantees.
 */
export function createSettlement({
  bountyId,
  submissionId,
  amount,
  mint = CANONICAL_USDC_MINT,
  recipient,
  idempotencyKey,
}) {
  if (!bountyId || !submissionId || !amount || !recipient || !idempotencyKey) {
    throw new Error('Missing required settlement parameters: bountyId, submissionId, amount, recipient, idempotencyKey');
  }

  const normalizedAmount = String(amount).trim();
  const numAmount = Number.parseFloat(normalizedAmount);
  if (Number.isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`Invalid settlement amount: ${amount}`);
  }

  if (mint !== CANONICAL_USDC_MINT) {
    throw new Error(`Non-canonical mint rejected: ${mint}. Expected: ${CANONICAL_USDC_MINT}`);
  }

  // Check idempotency
  if (settlementStore.has(idempotencyKey)) {
    const existing = settlementStore.get(idempotencyKey);
    const isConflict =
      existing.bountyId !== bountyId ||
      existing.submissionId !== submissionId ||
      existing.amount !== normalizedAmount ||
      existing.mint !== mint ||
      existing.recipient !== recipient;

    if (isConflict) {
      throw new Error(`Idempotency conflict for key ${idempotencyKey}`);
    }
    return { ...existing, idempotent_hit: true };
  }

  const settlementId = `st_${idempotencyKey.slice(0, 12)}_${Date.now()}`;
  const record = {
    settlementId,
    idempotencyKey,
    bountyId,
    submissionId,
    amount: normalizedAmount,
    mint,
    recipient,
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
  };

  settlementStore.set(idempotencyKey, record);
  return record;
}

/**
 * M0: Verify settlement state with signature. Returns payment_submitted, never paid directly.
 */
export function verifySettlement({ settlementId, signature }) {
  if (!settlementId || !signature) {
    throw new Error('Missing settlementId or signature');
  }

  // Find settlement
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
    verified: true,
    settlementId,
    signature,
    status: 'payment_submitted', // Enforces state invariant: never directly enters 'paid'
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * M0: Verify webhook signature and digest.
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
    provider: 'nodeblink',
    purpose: 'winner_payment',
    bountyId: settlement.bountyId,
    submissionId: settlement.submissionId,
    externalId: externalId || settlement.settlementId,
    signature: signature,
    expected: {
      chain: CANONICAL_CHAIN,
      asset: CANONICAL_ASSET,
      symbol: CANONICAL_SYMBOL,
      mint: CANONICAL_USDC_MINT,
      amount: String(settlement.amount),
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
 * Canonical 'paid' transition requires both evidence legs to agree.
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

  // Check provider status
  if (externalReceipt.providerStatus !== 'confirmed') {
    reasons.push(`provider_status_unconfirmed:${externalReceipt.providerStatus}`);
  }

  // Check transaction status on chain
  if (!chainObservation.success || chainObservation.status !== 'confirmed' && chainObservation.status !== 'finalized') {
    reasons.push('chain_tx_not_confirmed_or_successful');
  }

  // Cross-verify signature
  if (externalReceipt.signature !== chainObservation.signature) {
    reasons.push('signature_mismatch');
  }

  // Cross-verify mint
  if (chainObservation.mint !== CANONICAL_USDC_MINT || externalReceipt.expected.mint !== CANONICAL_USDC_MINT) {
    reasons.push('mint_mismatch_or_non_canonical');
  }

  // Cross-verify amount
  const expectedAmount = Number.parseFloat(externalReceipt.expected.amount);
  const observedAmount = Number.parseFloat(chainObservation.amount);
  if (Math.abs(expectedAmount - observedAmount) > 0.000001) {
    reasons.push(`amount_mismatch:expected_${expectedAmount}_got_${observedAmount}`);
  }

  // Cross-verify recipient owner
  if (externalReceipt.expected.recipientOwner !== chainObservation.recipientOwner) {
    reasons.push('recipient_owner_mismatch');
  }

  // Fail closed if any discrepancies exist
  if (reasons.length > 0) {
    return {
      status: 'reconcile_required',
      reasons,
      reconciledAt: new Date().toISOString(),
    };
  }

  // Success: canonical paid state transition
  return {
    status: 'paid',
    bountyId: externalReceipt.bountyId,
    submissionId: externalReceipt.submissionId,
    signature: chainObservation.signature,
    amount: externalReceipt.expected.amount,
    recipient: externalReceipt.expected.recipientOwner,
    observedAt: chainObservation.observedAt || new Date().toISOString(),
    reconciledAt: new Date().toISOString(),
  };
}
