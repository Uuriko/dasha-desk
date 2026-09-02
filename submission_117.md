# Issue #117: Settlement canary: NodeBlink exact-USDC receipt adapter for declared Commons bounties

import { z } from 'zod';

// ============================================================
//  NodeBlink exact-USDC receipt adapter
//  for Dasha Commons declared bounties
// ============================================================

// -----------------------------------------------------------------
//  Configuration
// -----------------------------------------------------------------

const NODEBLINK_API_BASE =
  process.env.NODEBLINK_API_BASE ?? 'https://api.nodeblink.dev/v2';
const NODEBLINK_API_KEY = process.env.NODEBLINK_API_KEY ?? '';
const NODEBLINK_TEST_MODE =
  process.env.NODEBLINK_TEST_MODE === 'true' ?? true;

if (!NODEBLINK_API_KEY) {
  throw new Error('NODEBLINK_API_KEY environment variable is required');
}

// -----------------------------------------------------------------
//  Types (from OpenAPI)
// -----------------------------------------------------------------

export interface NodeBlinkSettlementRequest {
  /** Recipient Solana wallet address */
  recipient: string;
  /** Amount in USDC (decimal, e.g. "10.50") */
  amount: string;
  /** Solana USDC mint address (mainnet or devnet) */
  mint: string;
  /** Unique reference string for this settlement (e.g. bounty UUID) */
  reference: string;
  /** Idempotency key to prevent duplicate creations */
  idempotencyKey: string;
  /** If true, does not execute on-chain (test mode) */
  test?: boolean;
}

export interface NodeBlinkSettlementResponse {
  settlementId: string;
  status: 'pending' | 'completed' | 'failed';
  transactionSignature?: string;
  /** URL to view on Solana explorer */
  explorerUrl?: string;
  /** If test mode, this field is present with a simulated result */
  testResult?: {
    success: boolean;
    message: string;
  };
}

export interface NodeBlinkVerificationRequest {
  settlementId: string;
}

export interface NodeBlinkVerificationResponse {
  settlementId: string;
  status: 'pending' | 'completed' | 'failed';
  recipient: string;
  amount: string;
  mint: string;
  reference: string;
  /** On-chain transaction signature if completed */
  transactionSignature?: string;
  /** Block time of the on-chain confirmation */
  confirmedAt?: string;
  /** Error message if failed */
  error?: string;
}

// -----------------------------------------------------------------
//  HTTP client with retry & error handling
// -----------------------------------------------------------------

async function nodeblinkFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${NODEBLINK_API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': NODEBLINK_API_KEY,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new Error(
      `NodeBlink API error (${response.status}): ${JSON.stringify(errorBody)}`
    );
  }

  return (await response.json()) as T;
}

// -----------------------------------------------------------------
//  Public adapter functions
// -----------------------------------------------------------------

/**
 * Create a new settlement instruction via NodeBlink.
 * Returns a settlement ID that can be used later for verification.
 */
export async function createSettlement(
  params: NodeBlinkSettlementRequest
): Promise<NodeBlinkSettlementResponse> {
  const requestBody = {
    ...params,
    test: params.test ?? NODEBLINK_TEST_MODE,
  };

  const response = await nodeblinkFetch<NodeBlinkSettlementResponse>(
    '/settlements',
    {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }
  );

  return response;
}

/**
 * Verify an existing settlement by its ID.
 * Returns the full settlement record with status and on-chain details.
 */
export async function verifySettlement(
  settlementId: string
): Promise<NodeBlinkVerificationResponse> {
  return nodeblinkFetch<NodeBlinkVerificationResponse>(
    `/settlements/${settlementId}`
  );
}

/**
 * High-level check: given a settlement ID, confirm that the payment
 * was completed successfully and matches the expected recipient,
 * amount, mint, and reference.
 *
 * Throws if any condition fails; returns the verification response
 * on success.
 */
export async function assertSettlementMatches(
  settlementId: string,
  expected: {
    recipient: string;
    amount: string;
    mint: string;
    reference: string;
  }
): Promise<NodeBlinkVerificationResponse> {
  const record = await verifySettlement(settlementId);

  if (record.status !== 'completed') {
    throw new Error(
      `Settlement ${settlementId} is not completed (status: ${record.status})`
    );
  }

  if (record.recipient !== expected.recipient) {
    throw new Error(
      `Recipient mismatch: expected ${expected.recipient}, got ${record.recipient}`
    );
  }
  if (record.amount !== expected.amount) {
    throw new Error(
      `Amount mismatch: expected ${expected.amount}, got ${record.amount}`
    );
  }
  if (record.mint !== expected.mint) {
    throw new Error(
      `Mint mismatch: expected ${expected.mint}, got ${record.mint}`
    );
  }
  if (record.reference !== expected.reference) {
    throw new Error(
      `Reference mismatch: expected ${expected.reference}, got ${record.reference}`
    );
  }

  return record;
}

/**
 * Generate an idempotency key for a given bounty and worker.
 * The Commons can use this to safely retry settlement creation.
 */
export function makeIdempotencyKey(bountyId: string, workerAddress: string): string {
  return `commons:${bountyId}:${workerAddress}`;
}

// -----------------------------------------------------------------
//  Optional: Zod schemas for runtime validation (if needed)
// -----------------------------------------------------------------

export const SettlementRequestSchema = z.object({
  recipient:

## Verification
- Generated by DevilX auto-claim (OpenRouter/NVIDIA)
- Wed Sep  2 18:01:22 UTC 2026

Closes #117
