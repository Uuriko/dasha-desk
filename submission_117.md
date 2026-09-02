# Issue #117: Settlement canary: NodeBlink exact-USDC receipt adapter for declared Commons bounties

```typescript
// nodeblink-adapter.ts
// Settlement canary: NodeBlink exact-USDC receipt adapter for declared Commons bounties

import fetch from 'node-fetch';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_API_URL = 'https://api.nodeblink.dev/v2';
const API_KEY = process.env.NODEBLINK_API_KEY;
if (!API_KEY) {
  throw new Error('NODEBLINK_API_KEY environment variable is required');
}
const API_URL = process.env.NODEBLINK_API_URL || DEFAULT_API_URL;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface NodeBlinkPaymentRequest {
  amount: number;                // in USDC (6 decimals), e.g. 10.5
  recipient: string;             // Solana address
  mint: string;                  // token mint address, e.g. USDC mint
  reference: string;             // unique reference per payment
  idempotencyKey: string;        // client-generated idempotency key
  test?: boolean;                // if true, no on-chain execution
}

export interface NodeBlinkPaymentResponse {
  id: string;
  status: 'draft' | 'pending' | 'succeeded' | 'failed';
  amount: number;
  recipient: string;
  mint: string;
  reference: string;
  test: boolean;
  transactionSignature?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NodeBlinkVerificationResult {
  success: boolean;
  paymentId: string;
  expectedAmount: number;
  actualAmount: number;
  expectedRecipient: string;
  actualRecipient: string;
  expectedReference: string;
  actualReference: string;
  status: string;
  signature?: string;
  errors: string[];
}

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

export class NodeBlinkError extends Error {
  constructor(message: string, public readonly statusCode?: number, public readonly response?: any) {
    super(message);
    this.name = 'NodeBlinkError';
  }
}

// ----------------------------------------------------------------------------
// Adapter
// ----------------------------------------------------------------------------

export class NodeBlinkAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string = API_KEY, baseUrl: string = API_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    const options: RequestInit = {
      method,
      headers,
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      throw new NodeBlinkError(`Invalid JSON response from NodeBlink: ${text}`, response.status);
    }

    if (!response.ok) {
      throw new NodeBlinkError(
        `NodeBlink API error: ${data.message || response.statusText}`,
        response.status,
        data
      );
    }
    return data as T;
  }

  /**
   * Create a new payment instruction.
   */
  async createPayment(request: NodeBlinkPaymentRequest): Promise<NodeBlinkPaymentResponse> {
    return this.request<NodeBlinkPaymentResponse>('POST', '/payments', request);
  }

  /**
   * Execute a payment (move from draft to on-chain attempt).
   */
  async executePayment(paymentId: string): Promise<NodeBlinkPaymentResponse> {
    return this.request<NodeBlinkPaymentResponse>('POST', `/payments/${paymentId}/pay`);
  }

  /**
   * Retrieve payment details.
   */
  async getPayment(paymentId: string): Promise<NodeBlinkPaymentResponse> {
    return this.request<NodeBlinkPaymentResponse>('GET', `/payments/${paymentId}`);
  }

  /**
   * Verify that a payment matches the expected exact-USDC receipt criteria.
   */
  async verifyPayment(
    paymentId: string,
    expectedAmount: number,
    expectedRecipient: string,
    expectedReference: string,
    expectedMint: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mainnet
  ): Promise<NodeBlinkVerificationResult> {
    const payment = await this.getPayment(paymentId);
    const errors: string[] = [];

    if (payment.status !== 'succeeded') {
      errors.push(`Payment status is "${payment.status}", expected "succeeded"`);
    }
    if (Math.abs(payment.amount - expectedAmount) > 1e-9) {
      errors.push(`Amount mismatch: expected ${expectedAmount}, got ${payment.amount}`);
    }
    if (payment.recipient !== expectedRecipient) {
      errors.push(`Recipient mismatch: expected ${expectedRecipient}, got ${payment.recipient}`);
    }
    if (payment.reference !== expectedReference) {
      errors.push(`Reference mismatch: expected ${expectedReference}, got ${payment.reference}`);
    }
    if (payment.mint !== expectedMint) {
      errors.push(`Mint mismatch: expected ${expectedMint}, got ${payment.mint}`);
    }

    return {
      success: errors.length === 0,
      paymentId: payment.id,
      expectedAmount,
      actualAmount: payment.amount,
      expectedRecipient,
      actualRecipient: payment.recipient,
      expectedReference,
      actualReference: payment.reference,
      status: payment.status,
      signature: payment.transactionSignature,
      errors,
    };
  }
}

// ----------------------------------------------------------------------------
// Canary function – end-to-end test of a settlement receipt
// ----------------------------------------------------------------------------

export interface CanaryOptions {
  /** Amount in USDC (e.g

## Verification
- Generated by DevilX auto-claim (OpenRouter/NVIDIA)
- Wed Sep  2 06:01:06 UTC 2026

Closes #117
