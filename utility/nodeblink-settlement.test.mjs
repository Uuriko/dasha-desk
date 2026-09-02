import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  CANONICAL_USDC_MINT,
  createSettlement,
  verifySettlement,
  verifyWebhook,
  mapExternalReceipt,
  reconcilePayment,
} from './nodeblink-settlement.mjs';

test('M0: createSettlement basic happy path', () => {
  const s = createSettlement({
    bountyId: 'bounty_101',
    submissionId: 'sub_202',
    amount: '25',
    recipient: '7N5vB8s9H3qK3qL1m2N4o5P6Q7R8S9T0U1V2W3X4Y5Z6',
    idempotencyKey: 'idem_key_001',
  });

  assert.equal(s.bountyId, 'bounty_101');
  assert.equal(s.amount, '25');
  assert.equal(s.mint, CANONICAL_USDC_MINT);
  assert.equal(s.status, 'pending_payment');
  assert.ok(s.settlementId.startsWith('st_'));
});

test('M0: createSettlement idempotency replay returns same settlement', () => {
  const s1 = createSettlement({
    bountyId: 'bounty_102',
    submissionId: 'sub_203',
    amount: '10',
    recipient: '7N5vB8s9H3qK3qL1m2N4o5P6Q7R8S9T0U1V2W3X4Y5Z6',
    idempotencyKey: 'idem_key_002',
  });

  const s2 = createSettlement({
    bountyId: 'bounty_102',
    submissionId: 'sub_203',
    amount: '10',
    recipient: '7N5vB8s9H3qK3qL1m2N4o5P6Q7R8S9T0U1V2W3X4Y5Z6',
    idempotencyKey: 'idem_key_002',
  });

  assert.equal(s1.settlementId, s2.settlementId);
  assert.equal(s2.idempotent_hit, true);
});

test('M0: createSettlement idempotency conflict fails closed', () => {
  createSettlement({
    bountyId: 'bounty_103',
    submissionId: 'sub_204',
    amount: '15',
    recipient: '7N5vB8s9H3qK3qL1m2N4o5P6Q7R8S9T0U1V2W3X4Y5Z6',
    idempotencyKey: 'idem_key_003',
  });

  assert.throws(() => {
    createSettlement({
      bountyId: 'bounty_103',
      submissionId: 'sub_204',
      amount: '50', // Conflicting amount!
      recipient: '7N5vB8s9H3qK3qL1m2N4o5P6Q7R8S9T0U1V2W3X4Y5Z6',
      idempotencyKey: 'idem_key_003',
    });
  }, /Idempotency conflict/);
});

test('M0: Non-canonical mint is rejected immediately', () => {
  assert.throws(() => {
    createSettlement({
      bountyId: 'bounty_104',
      submissionId: 'sub_205',
      amount: '20',
      mint: 'FakeUsdcMint1111111111111111111111111111111',
      recipient: '7N5vB8s9H3qK3qL1m2N4o5P6Q7R8S9T0U1V2W3X4Y5Z6',
      idempotencyKey: 'idem_key_004',
    });
  }, /Non-canonical mint rejected/);
});

test('M0: verifySettlement enters payment_submitted, never paid', () => {
  const s = createSettlement({
    bountyId: 'bounty_105',
    submissionId: 'sub_206',
    amount: '25',
    recipient: '7N5vB8s9H3qK3qL1m2N4o5P6Q7R8S9T0U1V2W3X4Y5Z6',
    idempotencyKey: 'idem_key_005',
  });

  const res = verifySettlement({
    settlementId: s.settlementId,
    signature: '5K2gSignatureXYZ1234567890',
  });

  assert.equal(res.verified, true);
  assert.equal(res.status, 'payment_submitted'); // Prohibits entering 'paid' directly
});

test('M0: verifyWebhook validates signature and HMAC properly', () => {
  const secret = 'test_webhook_secret_key';
  const rawBody = JSON.stringify({ event: 'settlement.confirmed', data: { settlementId: 'st_123' } });
  const validSig = createHmac('sha256', secret).update(rawBody).digest('hex');

  // Valid webhook
  const v1 = verifyWebhook({
    headers: { 'x-nodeblink-signature': validSig },
    rawBody,
    webhookSecret: secret,
  });
  assert.equal(v1.verified, true);
  assert.equal(v1.event, 'settlement.confirmed');

  // Bad signature
  const v2 = verifyWebhook({
    headers: { 'x-nodeblink-signature': 'bad_tampered_signature' },
    rawBody,
    webhookSecret: secret,
  });
  assert.equal(v2.verified, false);
  assert.equal(v2.reason, 'invalid_signature');
});

test('M1: mapExternalReceipt constructs valid commons.external-receipt/v1 schema', () => {
  const s = createSettlement({
    bountyId: 'bounty_106',
    submissionId: 'sub_207',
    amount: '25',
    recipient: 'RecipientSolanaAddress1111111111111111111',
    idempotencyKey: 'idem_key_006',
  });

  const receipt = mapExternalReceipt({
    settlement: s,
    signature: '5K2gSignatureXYZ1234567890',
    webhookDigest: 'abc123digest',
  });

  assert.equal(receipt.schema, 'commons.external-receipt/v1');
  assert.equal(receipt.provider, 'nodeblink');
  assert.equal(receipt.purpose, 'winner_payment');
  assert.equal(receipt.expected.mint, CANONICAL_USDC_MINT);
  assert.equal(receipt.expected.amount, '25');
  assert.equal(receipt.expected.recipientOwner, 'RecipientSolanaAddress1111111111111111111');
});

test('M1 & M2: reconcilePayment transitions to paid when all facts match', () => {
  const s = createSettlement({
    bountyId: 'bounty_107',
    submissionId: 'sub_208',
    amount: '25',
    recipient: 'RecipientOwner1111111111111111111111111',
    idempotencyKey: 'idem_key_007',
  });

  const externalReceipt = mapExternalReceipt({
    settlement: s,
    signature: '5K2gExactSig1111111111111111111111111',
  });

  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: '5K2gExactSig1111111111111111111111111',
    mint: CANONICAL_USDC_MINT,
    amount: '25',
    recipientOwner: 'RecipientOwner1111111111111111111111111',
    status: 'confirmed',
    success: true,
    observedAt: '2026-09-02T12:00:00Z',
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'paid');
  assert.equal(outcome.bountyId, 'bounty_107');
  assert.equal(outcome.signature, '5K2gExactSig1111111111111111111111111');
});

test('M2: reconcilePayment fails closed on wrong recipient owner', () => {
  const s = createSettlement({
    bountyId: 'bounty_108',
    submissionId: 'sub_209',
    amount: '25',
    recipient: 'ExpectedOwner11111111111111111111111111',
    idempotencyKey: 'idem_key_008',
  });

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: 'sig_123' });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: 'sig_123',
    mint: CANONICAL_USDC_MINT,
    amount: '25',
    recipientOwner: 'AttackerSubstitutedOwner222222222222222', // Substituted owner!
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('recipient_owner_mismatch'));
});

test('M2: reconcilePayment fails closed on counterfeit USDC mint', () => {
  const s = createSettlement({
    bountyId: 'bounty_109',
    submissionId: 'sub_210',
    amount: '25',
    recipient: 'RecipientOwner1111111111111111111111111',
    idempotencyKey: 'idem_key_009',
  });

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: 'sig_124' });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: 'sig_124',
    mint: 'CounterfeitUsdcMint99999999999999999999', // Counterfeit mint!
    amount: '25',
    recipientOwner: 'RecipientOwner1111111111111111111111111',
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('mint_mismatch_or_non_canonical'));
});

test('M2: reconcilePayment fails closed on amount mismatch', () => {
  const s = createSettlement({
    bountyId: 'bounty_110',
    submissionId: 'sub_211',
    amount: '25',
    recipient: 'RecipientOwner1111111111111111111111111',
    idempotencyKey: 'idem_key_010',
  });

  const externalReceipt = mapExternalReceipt({ settlement: s, signature: 'sig_125' });
  const chainObservation = {
    schema: 'commons.tx/v1',
    signature: 'sig_125',
    mint: CANONICAL_USDC_MINT,
    amount: '5', // Wrong amount (underpaid)!
    recipientOwner: 'RecipientOwner1111111111111111111111111',
    status: 'confirmed',
    success: true,
  };

  const outcome = reconcilePayment({ externalReceipt, chainObservation });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.some((r) => r.startsWith('amount_mismatch')));
});
