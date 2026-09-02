import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { unlinkSync, existsSync } from 'node:fs';
import {
  CANONICAL_USDC_MINT,
  NODEBLINK_API_VERSION,
  DurableSettlementStore,
  NodeBlinkClient,
  toBaseUnits,
  fromBaseUnits,
  createSettlement,
  verifySettlement,
  verifyWebhook,
  mapExternalReceipt,
  reconcilePayment,
} from './nodeblink-settlement.mjs';

const TEST_DB_PATH = './scratch/test_settlements.json';
const RECIPIENT_ALICE = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
const RECIPIENT_BOB = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const FAKE_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL mint
const VALID_SIG = '5K2gExactSolanaSignature111111111111111111111111111111111111111111111111111111111111111111111111';

test('Base units conversion: precision and integer safety', () => {
  assert.equal(toBaseUnits('25'), 25000000n);
  assert.equal(toBaseUnits('25.5'), 25500000n);
  assert.equal(toBaseUnits('0.000001'), 1n);
  assert.equal(fromBaseUnits(25000000n), '25');
  assert.equal(fromBaseUnits(25500000n), '25.5');
  assert.equal(fromBaseUnits(1n), '0.000001');

  assert.throws(() => toBaseUnits('1.0000001'), /exceeds maximum allowed precision/);
  assert.throws(() => toBaseUnits('-5'), /Invalid positive decimal/);
});

test('M0: DurableSettlementStore persistence and reload', () => {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

  const store1 = new DurableSettlementStore(TEST_DB_PATH);
  createSettlement(
    {
      bountyId: 'b_persist',
      submissionId: 'sub_persist',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_persist_01',
    },
    store1
  );

  const store2 = new DurableSettlementStore(TEST_DB_PATH);
  const loaded = store2.get('idem_persist_01');
  assert.ok(loaded);
  assert.equal(loaded.bountyId, 'b_persist');
  assert.equal(loaded.baseUnits, 25000000n);

  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});

test('M0: NodeBlinkClient test-mode transport execution', async () => {
  const client = new NodeBlinkClient({ apiKey: 'nb_test_key_01', mockMode: true });
  assert.equal(client.apiVersion, NODEBLINK_API_VERSION);

  const res = await client.post('/settlements', { amount: '25' });
  assert.equal(res.status, 'success');
  assert.ok(res.settlementId.startsWith('st_'));
});

test('M0: Selected-submission recipient immutability enforcement', () => {
  const store = new DurableSettlementStore();
  createSettlement(
    {
      bountyId: 'b_freeze',
      submissionId: 'sub_freeze',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_freeze_01',
    },
    store
  );

  assert.throws(() => {
    createSettlement(
      {
        bountyId: 'b_freeze',
        submissionId: 'sub_freeze',
        amount: '25',
        recipient: RECIPIENT_BOB,
        idempotencyKey: 'idem_freeze_02',
      },
      store
    );
  }, /Recipient immutability violation/);
});

test('M0: Webhook timestamp freshness & replay defense', () => {
  const store = new DurableSettlementStore();
  const secret = 'webhook_secret_key_123';
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);
  const rawBody = JSON.stringify({ event: 'settlement.confirmed', data: { settlementId: 'st_123' } });

  const payload = `${nowSeconds}.${rawBody}`;
  const validSig = createHmac('sha256', secret).update(payload).digest('hex');

  const res1 = verifyWebhook(
    {
      headers: {
        'x-nodeblink-signature': validSig,
        'x-nodeblink-timestamp': String(nowSeconds),
      },
      rawBody,
      webhookSecret: secret,
      currentTime: now,
    },
    store
  );
  assert.equal(res1.verified, true);
  assert.equal(res1.event, 'settlement.confirmed');

  const resReplay = verifyWebhook(
    {
      headers: {
        'x-nodeblink-signature': validSig,
        'x-nodeblink-timestamp': String(nowSeconds),
      },
      rawBody,
      webhookSecret: secret,
      currentTime: now,
    },
    store
  );
  assert.equal(resReplay.verified, false);
  assert.equal(resReplay.reason, 'webhook_replay_detected');

  const staleSeconds = nowSeconds - 600;
  const stalePayload = `${staleSeconds}.${rawBody}`;
  const staleSig = createHmac('sha256', secret).update(stalePayload).digest('hex');
  const resStale = verifyWebhook(
    {
      headers: {
        'x-nodeblink-signature': staleSig,
        'x-nodeblink-timestamp': String(staleSeconds),
      },
      rawBody,
      webhookSecret: secret,
      currentTime: now,
    },
    store
  );
  assert.equal(resStale.verified, false);
  assert.equal(resStale.reason, 'webhook_timestamp_stale_or_skewed');
});

test('M0: Idempotency conflict fails closed', () => {
  const store = new DurableSettlementStore();
  createSettlement(
    {
      bountyId: 'b_idem',
      submissionId: 'sub_idem',
      amount: '15',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_key_conflict_01',
    },
    store
  );

  assert.throws(() => {
    createSettlement(
      {
        bountyId: 'b_idem',
        submissionId: 'sub_idem',
        amount: '50',
        recipient: RECIPIENT_ALICE,
        idempotencyKey: 'idem_key_conflict_01',
      },
      store
    );
  }, /Idempotency conflict/);
});

test('M0: Non-canonical mint is rejected immediately', () => {
  const store = new DurableSettlementStore();
  assert.throws(() => {
    createSettlement(
      {
        bountyId: 'b_mint',
        submissionId: 'sub_mint',
        amount: '20',
        mint: FAKE_MINT,
        recipient: RECIPIENT_ALICE,
        idempotencyKey: 'idem_mint_01',
      },
      store
    );
  }, /Non-canonical mint rejected/);
});

test('M0: verifySettlement enters payment_submitted, never paid', () => {
  const store = new DurableSettlementStore();
  const s = createSettlement(
    {
      bountyId: 'b_submit',
      submissionId: 'sub_submit',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_submit_01',
    },
    store
  );

  const res = verifySettlement({ settlementId: s.settlementId, signature: VALID_SIG }, store);
  assert.equal(res.verified, true);
  assert.equal(res.status, 'payment_submitted');
});

test('M1: mapExternalReceipt constructs valid commons.external-receipt/v1 schema', () => {
  const store = new DurableSettlementStore();
  const s = createSettlement(
    {
      bountyId: 'b_receipt',
      submissionId: 'sub_receipt',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_receipt_01',
    },
    store
  );

  const receipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG, webhookDigest: 'abc123digest' });
  assert.equal(receipt.schema, 'commons.external-receipt/v1');
  assert.equal(receipt.apiVersion, NODEBLINK_API_VERSION);
  assert.equal(receipt.expected.mint, CANONICAL_USDC_MINT);
  assert.equal(receipt.expected.baseUnits, '25000000');
});

test('M1 & M2: reconcilePayment requires matching reference and passes', () => {
  const store = new DurableSettlementStore();
  const s = createSettlement(
    {
      bountyId: 'b_ref_01',
      submissionId: 'sub_ref_01',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      reference: 'commons:b_ref_01:sub_ref_01',
      idempotencyKey: 'idem_ref_01',
    },
    store
  );

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: CANONICAL_USDC_MINT,
    amount: '25',
    baseUnits: '25000000',
    recipientOwner: RECIPIENT_ALICE,
    reference: 'commons:b_ref_01:sub_ref_01',
    status: 'finalized',
    success: true,
    observedSlot: 312849100,
    observer: 'helius-solana-rpc',
    observedAt: '2026-09-02T19:00:00Z',
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'paid');
  assert.equal(outcome.reference, 'commons:b_ref_01:sub_ref_01');
  assert.equal(outcome.observedSlot, 312849100);
});

test('M2: reconcilePayment fails closed on reference mismatch', () => {
  const store = new DurableSettlementStore();
  const s = createSettlement(
    {
      bountyId: 'b_ref_02',
      submissionId: 'sub_ref_02',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      reference: 'commons:b_ref_02:sub_ref_02',
      idempotencyKey: 'idem_ref_02',
    },
    store
  );

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: CANONICAL_USDC_MINT,
    amount: '25',
    baseUnits: '25000000',
    recipientOwner: RECIPIENT_ALICE,
    reference: 'commons:tampered_bounty:tampered_sub',
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('reference_mismatch'));
});

test('M2: reconcilePayment fails closed on recipient substitution', () => {
  const store = new DurableSettlementStore();
  const s = createSettlement(
    {
      bountyId: 'b_subst',
      submissionId: 'sub_subst',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_subst_01',
    },
    store
  );

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: CANONICAL_USDC_MINT,
    amount: '25',
    baseUnits: '25000000',
    recipientOwner: RECIPIENT_BOB,
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('recipient_owner_mismatch'));
});

test('M2: reconcilePayment fails closed on counterfeit token mint', () => {
  const store = new DurableSettlementStore();
  const s = createSettlement(
    {
      bountyId: 'b_fake_mint',
      submissionId: 'sub_fake_mint',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_fake_mint_01',
    },
    store
  );

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: FAKE_MINT,
    amount: '25',
    baseUnits: '25000000',
    recipientOwner: RECIPIENT_ALICE,
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('mint_mismatch_or_non_canonical'));
});

test('M2: reconcilePayment fails closed on base units underpayment mismatch', () => {
  const store = new DurableSettlementStore();
  const s = createSettlement(
    {
      bountyId: 'b_underpay',
      submissionId: 'sub_underpay',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_underpay_01',
    },
    store
  );

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: CANONICAL_USDC_MINT,
    amount: '24.999999',
    baseUnits: '24999999',
    recipientOwner: RECIPIENT_ALICE,
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.some((r) => r.startsWith('base_units_mismatch')));
});
