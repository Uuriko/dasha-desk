// bounties/nodeblink-adapter.mjs
// Settlement canary: NodeBlink exact-USDC receipt adapter for declared Commons bounties (Issue #117)
// Direct-settlement verifier conforming to M0-M2 specifications.
// Strictly non-custodial, test-mode safe, dual-leg evidence reconciliation.

import { createHmac, timingSafeEqual } from "node:crypto";

export const CANONICAL_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;
export const RECEIPT_SCHEMA = "commons.external-receipt/v1";
export const TX_OBSERVATION_SCHEMA = "commons.tx/v1";
export const SOLANA_CHAIN = "solana";
export const ASSET_SPL_TOKEN = "spl-token";
export const CURRENCY_SYMBOL = "USDC";

export const SETTLEMENT_STATUS = {
  DECLARED_NON_ESCROWED: "declared_non_escrowed",
  WINNER_SELECTED: "winner_selected",
  PAYMENT_SUBMITTED: "payment_submitted",
  PAID: "paid",
  RECONCILE_REQUIRED: "reconcile_required",
  CANCELLED: "cancelled",
};

export const ALLOWED_UI_COPY = {
  BEFORE_PAYMENT: "Declared bounty — payment is not escrowed.",
  WINNER_SELECTED: "Winner selected; direct payment has not been confirmed.",
  PAYMENT_SUBMITTED: "Payment submitted; checking the exact Solana transaction.",
  RECONCILE_REQUIRED: "Payment needs reconciliation; do not retry yet.",
};

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;

/**
 * Validates base58 Solana address shape.
 */
export function isValidSolanaAddress(addr) {
  return typeof addr === "string" && BASE58_RE.test(addr.trim());
}

/**
 * Validates Solana transaction signature format.
 */
export function isValidSignature(sig) {
  return typeof sig === "string" && SIGNATURE_RE.test(sig.trim());
}

/**
 * Converts decimal USDC amount string or number to integer base units (micro-USDC).
 */
export function toBaseUnits(amount) {
  const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid USDC amount: ${amount}`);
  }
  return Math.round(n * 10 ** USDC_DECIMALS);
}

/**
 * Format base units back to canonical decimal USDC string.
 */
export function fromBaseUnits(baseUnits) {
  const n = Number(baseUnits);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid base units: ${baseUnits}`);
  }
  return (n / 10 ** USDC_DECIMALS).toString();
}

/**
 * In-memory / durable state store for Commons settlement intents and idempotency mapping.
 */
export class SettlementStore {
  constructor() {
    this.settlementsById = new Map();
    this.settlementsByIdempotency = new Map();
    this.paymentEvents = new Map(); // bountyId -> Array of canonical events
  }

  saveSettlement(intent) {
    this.settlementsById.set(intent.settlementId, intent);
    this.settlementsByIdempotency.set(intent.idempotencyKey, intent);
  }

  getById(settlementId) {
    return this.settlementsById.get(settlementId) ?? null;
  }

  getByIdempotencyKey(idempotencyKey) {
    return this.settlementsByIdempotency.get(idempotencyKey) ?? null;
  }

  recordEvent(bountyId, event) {
    const list = this.paymentEvents.get(bountyId) ?? [];
    // Ensure deduplication: duplicate terminal inputs create one canonical event
    const duplicate = list.some(
      (e) => e.signature === event.signature && e.type === event.type
    );
    if (!duplicate) {
      list.push(event);
      this.paymentEvents.set(bountyId, list);
    }
    return !duplicate;
  }

  getEvents(bountyId) {
    return this.paymentEvents.get(bountyId) ?? [];
  }
}

/**
 * NodeBlink Settlement Adapter (M0-M2 implementation)
 */
export class NodeBlinkSettlementAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || "test_key_fixture";
    this.webhookSecret = options.webhookSecret || "test_secret_fixture";
    this.isTestMode = options.isTestMode ?? true;
    this.store = options.store || new SettlementStore();
    this.endpoint = options.endpoint || "https://test-api.nodeblink.dev/v2";

    // M2 Guard #19: Prevent mainnet keys/endpoints in test/CI mode
    if (this.isTestMode) {
      if (this.apiKey.startsWith("live_") || this.apiKey.startsWith("pk_live")) {
        throw new Error("Security violation: Mainnet API key supplied to test-mode adapter");
      }
      if (this.endpoint.includes("api.nodeblink.dev/v2") && !this.endpoint.includes("test")) {
        // Only allow explicit test endpoint in test mode
        if (!options.allowLiveEndpoint) {
          throw new Error("Security violation: Live endpoint specified with isTestMode=true");
        }
      }
    }
  }

  /**
   * M0: Create settlement intent with idempotency & parameter enforcement.
   */
  async createSettlement(params) {
    const {
      bountyId,
      submissionId,
      amount,
      mint = CANONICAL_USDC_MINT,
      recipient,
      idempotencyKey,
      reference,
    } = params;

    if (!bountyId || typeof bountyId !== "string") {
      throw new Error("Missing or invalid bountyId");
    }
    if (!submissionId || typeof submissionId !== "string") {
      throw new Error("Missing or invalid submissionId");
    }
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new Error("Missing or invalid idempotencyKey");
    }
    if (!isValidSolanaAddress(recipient)) {
      throw new Error(`Invalid recipient Solana address: ${recipient}`);
    }
    if (mint !== CANONICAL_USDC_MINT) {
      throw new Error(`Invalid token mint. Expected canonical USDC ${CANONICAL_USDC_MINT}, got ${mint}`);
    }

    const baseUnits = toBaseUnits(amount);
    const decimalAmount = (baseUnits / 10 ** USDC_DECIMALS).toString();

    // Check idempotency store (M0 / M2 #7, #8)
    const existing = this.store.getByIdempotencyKey(idempotencyKey);
    if (existing) {
      const isIdentical =
        existing.bountyId === bountyId &&
        existing.submissionId === submissionId &&
        existing.recipient === recipient &&
        existing.mint === mint &&
        existing.baseUnits === baseUnits;

      if (isIdentical) {
        // Return existing logical settlement
        return {
          ok: true,
          settlementId: existing.settlementId,
          idempotencyKey,
          reused: true,
          paymentInstructions: existing.paymentInstructions,
        };
      }
      // Conflicting reuse fails closed
      throw new Error(`Conflicting idempotency key reuse for key: ${idempotencyKey}`);
    }

    const settlementId = `st_test_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
    const paymentInstructions = {
      chain: SOLANA_CHAIN,
      recipient,
      mint: CANONICAL_USDC_MINT,
      amount: decimalAmount,
      baseUnits,
      reference: reference || `ref_${bountyId}_${Date.now()}`,
      directPayment: true,
      escrowed: false,
    };

    const record = {
      settlementId,
      idempotencyKey,
      bountyId,
      submissionId,
      recipient,
      mint,
      amount: decimalAmount,
      baseUnits,
      status: "created",
      paymentInstructions,
      createdAt: new Date().toISOString(),
      rawProviderPayload: {
        id: settlementId,
        test_mode: this.isTestMode,
        created_at: new Date().toISOString(),
      },
    };

    this.store.saveSettlement(record);

    return {
      ok: true,
      settlementId,
      idempotencyKey,
      reused: false,
      paymentInstructions,
    };
  }

  /**
   * M0/M1: Construct external receipt from provider verification result.
   */
  createExternalReceipt(settlementId, signature, providerStatus = "confirmed", webhookDigest = null) {
    const settlement = this.store.getById(settlementId);
    if (!settlement) {
      throw new Error(`Unknown settlementId: ${settlementId}`);
    }

    // M2 Guard #20: Do NOT include raw private credentials or internal headers
    return {
      schema: RECEIPT_SCHEMA,
      provider: "nodeblink",
      purpose: "winner_payment",
      bountyId: settlement.bountyId,
      submissionId: settlement.submissionId,
      externalId: settlementId,
      signature: signature || null,
      expected: {
        chain: SOLANA_CHAIN,
        asset: ASSET_SPL_TOKEN,
        symbol: CURRENCY_SYMBOL,
        mint: CANONICAL_USDC_MINT,
        amount: settlement.amount,
        baseUnits: settlement.baseUnits,
        recipientOwner: settlement.recipient,
        reference: settlement.paymentInstructions.reference,
      },
      providerStatus,
      providerObservedAt: new Date().toISOString(),
      webhookDigest: webhookDigest || null,
    };
  }

  /**
   * M0/M2 #9: Authenticate and verify signed incoming webhook.
   */
  verifyWebhook({ headers, rawBody, toleranceSeconds = 300 }) {
    if (!headers || !rawBody) {
      return { ok: false, reason: "Missing headers or rawBody" };
    }

    const signatureHeader = headers["x-nodeblink-signature"] || headers["X-NodeBlink-Signature"];
    const timestampHeader = headers["x-nodeblink-timestamp"] || headers["X-NodeBlink-Timestamp"];

    if (!signatureHeader || !timestampHeader) {
      return { ok: false, reason: "Missing required signature/timestamp headers" };
    }

    // Stale timestamp / replay check
    const reqTime = Number(timestampHeader);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(reqTime) || Math.abs(now - reqTime) > toleranceSeconds) {
      return { ok: false, reason: "Timestamp outside tolerance window (replay check failed)" };
    }

    // Compute expected HMAC
    const payload = `${timestampHeader}.${rawBody}`;
    const expectedSig = createHmac("sha256", this.webhookSecret).update(payload).digest("hex");

    try {
      const sigBuf = Buffer.from(signatureHeader, "hex");
      const expectedBuf = Buffer.from(expectedSig, "hex");
      if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
        return { ok: false, reason: "Invalid HMAC signature" };
      }
    } catch {
      return { ok: false, reason: "HMAC comparison failure" };
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "Malformed JSON payload" };
    }

    if (!parsed.event_type || !parsed.data) {
      return { ok: false, reason: "Invalid webhook payload shape" };
    }

    return {
      ok: true,
      eventType: parsed.event_type,
      data: parsed.data,
      digest: createHmac("sha256", "digest_key").update(rawBody).digest("hex").slice(0, 16),
    };
  }

  /**
   * M1 / M2: Reconcile external provider receipt with independent Solana chain observation.
   */
  reconcile({ externalReceipt, chainObservation, declaredBounty, selectedSubmission }) {
    // Both evidence objects are required
    if (!externalReceipt || externalReceipt.schema !== RECEIPT_SCHEMA) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: "Missing or invalid commons.external-receipt/v1 evidence leg",
      };
    }

    if (!chainObservation || chainObservation.schema !== TX_OBSERVATION_SCHEMA) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: "Missing or invalid commons.tx/v1 observation evidence leg",
      };
    }

    // Check declared bounty state — late confirmation after cancellation must not pay
    if (declaredBounty?.status === SETTLEMENT_STATUS.CANCELLED) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: "Declared bounty was cancelled prior to confirmation",
      };
    }

    // 1. Check provider confirmation
    if (externalReceipt.providerStatus !== "confirmed") {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: `Provider status is '${externalReceipt.providerStatus}', expected 'confirmed'`,
      };
    }

    // 2. Check Solana transaction success
    if (chainObservation.status !== "success" || chainObservation.err !== null) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: "Solana transaction execution was not successful",
      };
    }

    // 3. Check commitment level
    const validCommitments = ["confirmed", "finalized"];
    if (!validCommitments.includes(chainObservation.commitment)) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: `Insufficient commitment: ${chainObservation.commitment}`,
      };
    }

    // 4. Verify signature match across legs
    if (!externalReceipt.signature || !chainObservation.signature) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: "Missing signature on one or both evidence legs",
      };
    }
    if (externalReceipt.signature !== chainObservation.signature) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: "Signature mismatch between provider receipt and chain observation",
      };
    }

    // 5. Verify recipient owner matches selected submission
    const expectedRecipient = selectedSubmission?.payoutAddress || declaredBounty?.payTo || externalReceipt.expected.recipientOwner;
    if (chainObservation.recipientOwner !== expectedRecipient) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: `Recipient owner mismatch: observed ${chainObservation.recipientOwner}, expected ${expectedRecipient}`,
      };
    }

    // 6. Verify destination token account belongs to expected owner
    if (chainObservation.destinationOwner && chainObservation.destinationOwner !== expectedRecipient) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: `Destination token account owned by ${chainObservation.destinationOwner}, expected ${expectedRecipient}`,
      };
    }

    // 7. Verify exact canonical USDC mint
    if (chainObservation.mint !== CANONICAL_USDC_MINT || externalReceipt.expected.mint !== CANONICAL_USDC_MINT) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: `Mint mismatch: observed ${chainObservation.mint}, expected ${CANONICAL_USDC_MINT}`,
      };
    }

    // 8. Verify exact amount & base units
    const expectedBaseUnits = externalReceipt.expected.baseUnits || toBaseUnits(externalReceipt.expected.amount);
    if (chainObservation.baseUnits !== expectedBaseUnits) {
      return {
        status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
        paid: false,
        reason: `Amount mismatch: observed ${chainObservation.baseUnits} base units, expected ${expectedBaseUnits}`,
      };
    }

    // 9. Verify reference evidence if required by settlement
    if (externalReceipt.expected.reference) {
      if (!chainObservation.references || !chainObservation.references.includes(externalReceipt.expected.reference)) {
        return {
          status: SETTLEMENT_STATUS.RECONCILE_REQUIRED,
          paid: false,
          reason: `Missing expected reference: ${externalReceipt.expected.reference}`,
        };
      }
    }

    // 10. Record canonical payment event idempotently
    const canonicalEvent = {
      type: "payment_settled",
      bountyId: externalReceipt.bountyId,
      submissionId: externalReceipt.submissionId,
      signature: chainObservation.signature,
      recipient: chainObservation.recipientOwner,
      amount: fromBaseUnits(expectedBaseUnits),
      mint: CANONICAL_USDC_MINT,
      slot: chainObservation.slot,
      settledAt: new Date().toISOString(),
    };

    this.store.recordEvent(externalReceipt.bountyId, canonicalEvent);

    return {
      status: SETTLEMENT_STATUS.PAID,
      paid: true,
      canonicalEvent,
      message: `Paid ${fromBaseUnits(expectedBaseUnits)} USDC to ${chainObservation.recipientOwner}`,
    };
  }

  /**
   * UI & Copy rules validator.
   */
  static getUiCopy(status, details = {}) {
    // Prohibited words check helper
    const checkProhibited = (text) => {
      const prohibitedRegex = /\b(Funded|Escrowed|guaranteed|trustless|Verified by Solana)\b/i;
      if (prohibitedRegex.test(text)) {
        throw new Error(`Prohibited copy detected: "${text}"`);
      }
    };

    switch (status) {
      case SETTLEMENT_STATUS.DECLARED_NON_ESCROWED:
        return ALLOWED_UI_COPY.BEFORE_PAYMENT;
      case SETTLEMENT_STATUS.WINNER_SELECTED:
        return ALLOWED_UI_COPY.WINNER_SELECTED;
      case SETTLEMENT_STATUS.PAYMENT_SUBMITTED:
        return ALLOWED_UI_COPY.PAYMENT_SUBMITTED;
      case SETTLEMENT_STATUS.RECONCILE_REQUIRED:
        return ALLOWED_UI_COPY.RECONCILE_REQUIRED;
      case SETTLEMENT_STATUS.PAID: {
        const copy = `Paid ${details.amount || "25"} USDC to the selected contributor.`;
        checkProhibited(copy);
        return copy;
      }
      default:
        return ALLOWED_UI_COPY.BEFORE_PAYMENT;
    }
  }
}
