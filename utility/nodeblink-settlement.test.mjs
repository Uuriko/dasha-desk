import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  CANONICAL_USDC_MINT,
  NODEBLINK_API_VERSION,
  toBaseUnits,
  fromBaseUnits,
  createSettlement,
  verifySettlement,
  verifyWebhook,
  mapExternalReceipt,
  reconcilePayment,
} from './nodeblink-settlement.mjs';

// Canonical Solana identities for test fixtures
const RECIPIENT_ALICE = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
const RECIPIENT_BOB = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const FAKE_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL mint, not USDC
const VALID_SIG = '5K2gExactSolanaSignature111111111111111111111111111111111111111111111111111111111111111111111111';

test('Base units conversion: precision and integer safety', () => {
  assert.equal(toBaseUnits('25'), 25000000n);
  assert.equal(toBaseUnits('25.5'), 25500000n);
  assert.equal(toBaseUnits('0.000001'), 1n);
  assert.equal(fromBaseUnits(25000000n), '25');
  assert.equal(fromBaseUnits(25500000n), '25.5');
  assert.equal(fromBaseUnits(1n), '0.000001');

  // Precision overflow rejection (> 6 decimals for USDC)
  assert.throws(() => toBaseUnits('1.0000001'), /exceeds maximum allowed precision/);
  // Negative or non-numeric rejection
  assert.throws(() => toBaseUnits('-5'), /Invalid positive decimal/);
});

test('M0: createSettlement happy path with canonical Base58 Solana identity', () => {
  const s = createSettlement({
    bountyId: 'bounty_101',
    submissionId: 'sub_202',
    amount: '25',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_001',
  });

  assert.equal(s.apiVersion, NODEBLINK_API_VERSION);
  assert.equal(s.bountyId, 'bounty_101');
  assert.equal(s.amount, '25');
  assert.equal(s.baseUnits, 25000000n);
  assert.equal(s.mint, CANONICAL_USDC_MINT);
  assert.equal(s.status, 'pending_payment');
  assert.ok(s.settlementId.startsWith('st_'));
});

test('M0: createSettlement rejects invalid Solana recipient address', () => {
  assert.throws(() => {
    createSettlement({
      bountyId: 'bounty_102',
      submissionId: 'sub_203',
      amount: '25',
      recipient: '0xInvalidEthereumAddressNotSolana000000000000',
      idempotencyKey: 'idem_key_002',
    });
  }, /Invalid Solana recipient address/);
});

test('M0: createSettlement idempotency replay returns identical record', () => {
  const s1 = createSettlement({
    bountyId: 'bounty_103',
    submissionId: 'sub_204',
    amount: '10.5',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_003',
  });

  const s2 = createSettlement({
    bountyId: 'bounty_103',
    submissionId: 'sub_204',
    amount: '10.5',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_003',
  });

  assert.equal(s1.settlementId, s2.settlementId);
  assert.equal(s2.idempotent_hit, true);
});

test('M0: createSettlement idempotency conflict fails closed', () => {
  createSettlement({
    bountyId: 'bounty_104',
    submissionId: 'sub_205',
    amount: '15',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_004',
  });

  assert.throws(() => {
    createSettlement({
      bountyId: 'bounty_104',
      submissionId: 'sub_205',
      amount: '50', // Conflicting amount!
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_key_004',
    });
  }, /Idempotency conflict/);
});

test('M0: Non-canonical mint is rejected immediately', () => {
  assert.throws(() => {
    createSettlement({
      bountyId: 'bounty_105',
      submissionId: 'sub_206',
      amount: '20',
      mint: FAKE_MINT,
      recipient: RECIPIENT_ALICE,
      idempotencyKey: 'idem_key_005',
    });
  }, /Non-canonical mint rejected/);
});

test('M0: verifySettlement enters payment_submitted, never paid', () => {
  const s = createSettlement({
    bountyId: 'bounty_106',
    submissionId: 'sub_207',
    amount: '25',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_006',
  });

  const res = verifySettlement({
    settlementId: s.settlementId,
    signature: VALID_SIG,
  });

  assert.equal(res.verified, true);
  assert.equal(res.status, 'payment_submitted');
});

test('M0: verifyWebhook validates signature and HMAC against pinned revision', () => {
  const secret = 'test_nodeblink_webhook_secret_key_123';
  const rawBody = JSON.stringify({ event: 'settlement.confirmed', data: { settlementId: 'st_123' } });
  const validSig = createHmac('sha256', secret).update(rawBody).digest('hex');

  const v1 = verifyWebhook({
    headers: { 'x-nodeblink-signature': validSig },
    rawBody,
    webhookSecret: secret,
  });
  assert.equal(v1.verified, true);
  assert.equal(v1.apiVersion, NODEBLINK_API_VERSION);
  assert.equal(v1.event, 'settlement.confirmed');

  const v2 = verifyWebhook({
    headers: { 'x-nodeblink-signature': 'tampered_signature_999' },
    rawBody,
    webhookSecret: secret,
  });
  assert.equal(v2.verified, false);
  assert.equal(v2.reason, 'invalid_signature');
});

test('M1: mapExternalReceipt constructs valid commons.external-receipt/v1 schema', () => {
  const s = createSettlement({
    bountyId: 'bounty_107',
    submissionId: 'sub_208',
    amount: '25',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_007',
  });

  const receipt = mapExternalReceipt({
    settlement: s,
    signature: VALID_SIG,
    webhookDigest: 'abc123digest',
  });

  assert.equal(receipt.schema, 'commons.external-receipt/v1');
  assert.equal(receipt.apiVersion, NODEBLINK_API_VERSION);
  assert.equal(receipt.provider, 'nodeblink');
  assert.equal(receipt.expected.mint, CANONICAL_USDC_MINT);
  assert.equal(receipt.expected.amount, '25');
  assert.equal(receipt.expected.baseUnits, '25000000');
  assert.equal(receipt.expected.recipientOwner, RECIPIENT_ALICE);
});

test('M1 & M2: reconcilePayment transitions to paid when all base units & facts match', () => {
  const s = createSettlement({
    bountyId: 'bounty_108',
    submissionId: 'sub_209',
    amount: '25',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_008',
  });

  const externalReceipt = mapExternalReceipt({
    settlement: s,
    signature: VALID_SIG,
  });

  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: CANONICAL_USDC_MINT,
    amount: '25',
    baseUnits: '25000000',
    recipientOwner: RECIPIENT_ALICE,
    status: 'confirmed',
    success: true,
    observedAt: '2026-09-02T12:00:00Z',
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'paid');
  assert.equal(outcome.bountyId, 'bounty_108');
  assert.equal(outcome.signature, VALID_SIG);
});

test('M2: reconcilePayment fails closed on wrong recipient owner substitution', () => {
  const s = createSettlement({
    bountyId: 'bounty_109',
    submissionId: 'sub_210',
    amount: '25',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_009',
  });

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: CANONICAL_USDC_MINT,
    amount: '25',
    baseUnits: '25000000',
    recipientOwner: RECIPIENT_BOB, // Substituted recipient!
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('recipient_owner_mismatch'));
});

test('M2: reconcilePayment fails closed on counterfeit token mint', () => {
  const s = createSettlement({
    bountyId: 'bounty_110',
    submissionId: 'sub_211',
    amount: '25',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_010',
  });

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: FAKE_MINT, // Fake mint!
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
  const s = createSettlement({
    bountyId: 'bounty_111',
    submissionId: 'sub_212',
    amount: '25',
    recipient: RECIPIENT_ALICE,
    idempotencyKey: 'idem_key_011',
  });

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: VALID_SIG });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: VALID_SIG,
    mint: CANONICAL_USDC_MINT,
    amount: '24.999999',
    baseUnits: '24999999', // 1 base unit underpayment!
    recipientOwner: RECIPIENT_ALICE,
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.some((r) => r.startsWith('base_units_mismatch')));
});
