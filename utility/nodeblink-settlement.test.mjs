import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import test from 'node:test';
import { validateBounty } from '../commons/schema.mjs';
import {
  CANONICAL_USDC_MINT,
  DurableSettlementStore,
  NODEBLINK_API_BASE_URL,
  NODEBLINK_IDEMPOTENCY_HEADER,
  NODEBLINK_SDK_INTEGRITY,
  NODEBLINK_SDK_JS_SHA256,
  NODEBLINK_SDK_VERSION,
  NODEBLINK_SETTLEMENTS_PATH,
  NODEBLINK_WEBHOOK_HEADER,
  NodeBlinkClient,
  NodeBlinkTransportError,
  assertNoSecretLeak,
  assertTestSafeCredentials,
  buildCommonsTx,
  createSettlement,
  fromBaseUnits,
  mapExternalReceipt,
  recordCanonicalSettlement,
  reconcilePayment,
  signNodeBlinkWebhook,
  toBaseUnits,
  verifySettlement,
  verifyWebhook,
} from './nodeblink-settlement.mjs';

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/nodeblink-test-mode-create-verify.json', import.meta.url), 'utf8'),
);

const TEST_DB_PATH = './scratch/test_settlements.json';
const RECIPIENT_ALICE = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
const RECIPIENT_BOB = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const SOURCE = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBTjhGenhuDh3Bw';
const ALICE_ATA = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const BOB_ATA = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const FAKE_MINT = 'So11111111111111111111111111111111111111112';
const VALID_SIG = FIXTURE.verifyRequest.body.signature;
const OTHER_SIG = '2n3m4k5j6h7g8f9d2s3a4b5c6d7e8f9g1h2j3k4m5n6p7q8r9s1t2u3v4w5x6y7z8A9B1C2D3E4F5G6H7J8K9L1';
const TEST_KEY = 'nb_test_recorded_fixture_key';
const WEBHOOK_SECRET = 'whsec_test_recorded_fixture';

function cleanDb(path = TEST_DB_PATH) {
  if (existsSync(path)) unlinkSync(path);
  if (existsSync(`${path}.tmp`)) unlinkSync(`${path}.tmp`);
}

function ephemeralStore() {
  return new DurableSettlementStore(null, { ephemeral: true });
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  };
}

function officialFetch({
  createBody = FIXTURE.createResponse.body,
  createStatus = 200,
  verifyBody = FIXTURE.verifyResponse.body,
  verifyStatus = 200,
  verifyDelayMs = 0,
  log = [],
} = {}) {
  return async (url, init) => {
    log.push({
      url,
      method: init.method,
      headers: { ...init.headers },
      body: init.body ? JSON.parse(init.body) : null,
    });
    if (url === `${NODEBLINK_API_BASE_URL}${NODEBLINK_SETTLEMENTS_PATH}` && init.method === 'POST') {
      const idKey = init.headers[NODEBLINK_IDEMPOTENCY_HEADER];
      const suffix = idKey && idKey !== 'commons:b_canary:sub_canary' ? `_${idKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}` : '';
      const parsedBody = init.body ? JSON.parse(init.body) : {};
      const amount = parsedBody.amount || createBody.amount;
      const [whole, frac = ''] = String(amount).split('.');
      const amountMinor = `${whole}${frac.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '') || '0';
      const body = {
        ...createBody,
        id: `${createBody.id}${suffix}`,
        amount,
        amount_minor: amountMinor,
        recipient_amount_minor: amountMinor,
        reference: parsedBody.reference || createBody.reference,
        recipient: parsedBody.recipient || createBody.recipient,
      };
      if (idKey) body.metadata = { idempotencyKey: idKey };
      return jsonResponse(createStatus, createStatus >= 300 ? { error: { message: 'create failed', code: 'bad_request' } } : body);
    }
    const verifyMatch = url.match(/\/api\/v2\/settlements\/([^/]+)\/verify$/);
    if (verifyMatch && init.method === 'POST') {
      if (verifyDelayMs) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
      if (verifyStatus >= 300) {
        return jsonResponse(verifyStatus, { error: { message: 'verify failed', code: 'upstream' } });
      }
      return jsonResponse(verifyStatus, {
        ...verifyBody,
        id: verifyMatch[1],
        signature: init.body ? JSON.parse(init.body).signature : verifyBody.signature,
      });
    }
    return jsonResponse(404, { error: { message: 'not found', code: 'not_found' } });
  };
}

function testClient(overrides = {}) {
  const log = overrides.log || [];
  return {
    client: new NodeBlinkClient({
      apiKey: TEST_KEY,
      fetchImpl: officialFetch({ ...overrides, log }),
    }),
    log,
  };
}

async function openIntent(store, overrides = {}) {
  const { client } = testClient();
  return createSettlement(
    {
      bountyId: overrides.bountyId || 'b_canary',
      submissionId: overrides.submissionId || 'sub_canary',
      amount: overrides.amount || '25',
      recipient: overrides.recipient || RECIPIENT_ALICE,
      destinationTokenAccount: overrides.destinationTokenAccount || ALICE_ATA,
      reference: overrides.reference || 'commons:b_canary:sub_canary',
      idempotencyKey: overrides.idempotencyKey || 'commons:b_canary:sub_canary',
      mint: overrides.mint,
    },
    { store, client },
  );
}

function observation(overrides = {}) {
  return buildCommonsTx({
    signature: overrides.signature || VALID_SIG,
    source: overrides.source || SOURCE,
    destination: overrides.destination || RECIPIENT_ALICE,
    amount: overrides.amount || '25',
    mint: overrides.mint || CANONICAL_USDC_MINT,
    purpose: overrides.purpose || 'settlement',
    status: overrides.status || 'confirmed',
    success: overrides.success === undefined ? true : overrides.success,
    slot: overrides.slot === undefined ? 312849100 : overrides.slot,
    commitment: overrides.commitment || 'finalized',
    observedBy: overrides.observedBy || 'independent-solana-rpc',
    reference: overrides.reference === undefined ? 'commons:b_canary:sub_canary' : overrides.reference,
    destinationTokenAccount: overrides.destinationTokenAccount || ALICE_ATA,
  });
}

function settlementPendingBounty({
  bountyId = 'b_canary',
  submissionId = 'sub_canary',
  recipient = RECIPIENT_ALICE,
  source = SOURCE,
  amount = '25',
} = {}) {
  const ts = '2026-09-02T18:00:00.000Z';
  const fundingTx = buildCommonsTx({
    signature: OTHER_SIG,
    source,
    destination: source,
    amount,
    purpose: 'funding',
    status: 'confirmed',
    slot: 100,
    commitment: 'finalized',
    observedBy: 'independent-solana-rpc',
  });
  const submitter = { kind: 'wallet', id: recipient, wallet: recipient };
  const bounty = {
    schema: 'commons.bounty/v1',
    schemaVersion: 1,
    id: bountyId,
    title: 'NodeBlink canary',
    description: '',
    creator: { kind: 'wallet', id: source, wallet: source },
    creatorWallet: source,
    fundingDestination: source,
    settlementSource: source,
    reward: { asset: 'spl', symbol: 'USDC', mint: CANONICAL_USDC_MINT, amount, chain: 'solana' },
    funding: { state: 'funded', tx: fundingTx, reconciliation: null },
    createdAt: ts,
    deadline: null,
    rules: { eligibility: '', submissionFormat: 'url', text: '' },
    submissions: [
      {
        schema: 'commons.submission/v1',
        id: submissionId,
        bountyId,
        submitter,
        submittedAt: ts,
        format: 'url',
        proof: { url: 'https://github.com/Uuriko/dasha-desk' },
        status: 'selected',
      },
    ],
    winners: [{ submissionId, identity: submitter, selectedAt: ts }],
    selectedAt: ts,
    settlement: { state: 'pending', tx: null, reconciliation: null },
    cancellation: { state: 'none', reason: null, at: null },
    refund: { state: 'none', tx: null, reconciliation: null, reason: null },
    history: [fundingTx],
    seenEventIds: [],
    seenEvents: {},
    state: 'settlement_pending',
    source: { kind: 'app', community: null, ref: null },
  };
  const checked = validateBounty(bounty);
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  return bounty;
}

test('Pinned SDK revision matches official nodeblink-sdk 2.1.0', () => {
  assert.equal(NODEBLINK_SDK_VERSION, '2.1.0');
  assert.equal(NODEBLINK_SDK_INTEGRITY, FIXTURE.pinned.integrity);
  assert.equal(NODEBLINK_SDK_JS_SHA256, FIXTURE.pinned.sdkJsSha256);
  assert.equal(NODEBLINK_API_BASE_URL, 'https://api.nodeblink.dev');
  assert.equal(NODEBLINK_SETTLEMENTS_PATH, '/api/v2/settlements');
  assert.equal(NODEBLINK_WEBHOOK_HEADER, 'NodeBlink-Signature');
  assert.equal(FIXTURE.pinned.apiBase, NODEBLINK_API_BASE_URL);
});

test('Base units conversion: precision and integer safety', () => {
  assert.equal(toBaseUnits('25'), 25000000n);
  assert.equal(toBaseUnits('25.5'), 25500000n);
  assert.equal(toBaseUnits('0.000001'), 1n);
  assert.equal(fromBaseUnits(25000000n), '25');
  assert.equal(fromBaseUnits(25500000n), '25.5');
  assert.equal(fromBaseUnits(1n), '0.000001');
  assert.throws(() => toBaseUnits('1.0000001'), /canonical/);
  assert.throws(() => toBaseUnits('-5'), /canonical/);
  assert.throws(() => toBaseUnits('25.50'), /canonical/);
});

test('M0: DurableSettlementStore persistence and reload', async () => {
  cleanDb();
  const store1 = new DurableSettlementStore(TEST_DB_PATH);
  await openIntent(store1);
  const store2 = new DurableSettlementStore(TEST_DB_PATH);
  const loaded = store2.get('commons:b_canary:sub_canary');
  assert.ok(loaded);
  assert.equal(loaded.bountyId, 'b_canary');
  assert.equal(loaded.baseUnits, 25000000n);
  assert.equal(loaded.settlementId, FIXTURE.createResponse.body.id);
  assert.match(loaded.rawProviderCreate, /set_test_recorded_01HZXCANARY0001/);
  cleanDb();
});

test('M0: persistence fails closed on corrupt IO', () => {
  cleanDb();
  mkdirSync(dirname(TEST_DB_PATH), { recursive: true });
  writeFileSync(TEST_DB_PATH, '{not-json', 'utf8');
  assert.throws(() => new DurableSettlementStore(TEST_DB_PATH), /Corrupt settlement store/);
  writeFileSync(TEST_DB_PATH, JSON.stringify({ records: { nope: true } }), 'utf8');
  assert.throws(() => new DurableSettlementStore(TEST_DB_PATH), /missing records array/);
  writeFileSync(TEST_DB_PATH, JSON.stringify({ records: [{ idempotencyKey: 'x' }] }), 'utf8');
  assert.throws(() => new DurableSettlementStore(TEST_DB_PATH), /missing idempotencyKey or settlementId/);
  assert.throws(() => new DurableSettlementStore(), /requires a filePath/);
  cleanDb();
});

test('M0: official test-mode create→verify transport', async () => {
  const store = ephemeralStore();
  const log = [];
  const client = new NodeBlinkClient({ apiKey: TEST_KEY, fetchImpl: officialFetch({ log }) });
  const created = await createSettlement(
    {
      bountyId: 'b_canary',
      submissionId: 'sub_canary',
      amount: '25',
      recipient: RECIPIENT_ALICE,
      destinationTokenAccount: ALICE_ATA,
      reference: 'commons:b_canary:sub_canary',
      idempotencyKey: 'commons:b_canary:sub_canary',
    },
    { store, client },
  );

  assert.equal(created.settlementId, FIXTURE.createResponse.body.id);
  assert.equal(created.status, 'pending_payment');
  assert.equal(created.providerMode, 'test');
  assert.ok(!created.rawProviderCreate);
  assert.equal(log[0].url, `${NODEBLINK_API_BASE_URL}${NODEBLINK_SETTLEMENTS_PATH}`);
  assert.equal(log[0].headers[NODEBLINK_IDEMPOTENCY_HEADER], 'commons:b_canary:sub_canary');
  assert.equal(log[0].headers.Authorization, `Bearer ${TEST_KEY}`);
  assert.deepEqual(log[0].body, {
    amount: '25',
    recipient: RECIPIENT_ALICE,
    reference: 'commons:b_canary:sub_canary',
  });

  const verified = await verifySettlement(
    { settlementId: created.settlementId, signature: VALID_SIG },
    { store, client },
  );
  assert.equal(verified.verified, true);
  assert.equal(verified.status, 'payment_submitted');
  assert.ok(verified.status !== 'paid');
  assert.equal(log[1].url, `${NODEBLINK_API_BASE_URL}${NODEBLINK_SETTLEMENTS_PATH}/${created.settlementId}/verify`);
  assert.deepEqual(log[1].body, { signature: VALID_SIG });
  assert.equal(store.get(created.idempotencyKey).rawProviderVerify.includes('"result":"confirmed"'), true);
});

test('M0: non-2xx create and verify fail closed', async () => {
  const store = ephemeralStore();
  const failingCreate = new NodeBlinkClient({
    apiKey: TEST_KEY,
    fetchImpl: officialFetch({ createStatus: 503 }),
  });
  await assert.rejects(
    () =>
      createSettlement(
        {
          bountyId: 'b_fail',
          submissionId: 'sub_fail',
          amount: '25',
          recipient: RECIPIENT_ALICE,
          idempotencyKey: 'idem_fail_create',
        },
        { store, client: failingCreate },
      ),
    (err) => err instanceof NodeBlinkTransportError && err.status === 503,
  );
  assert.equal(store.get('idem_fail_create'), undefined);

  const created = await openIntent(store, { bountyId: 'b_fail2', submissionId: 'sub_fail2', idempotencyKey: 'idem_fail_verify' });
  const failingVerify = new NodeBlinkClient({
    apiKey: TEST_KEY,
    fetchImpl: officialFetch({ verifyStatus: 500 }),
  });
  const res = await verifySettlement(
    { settlementId: created.settlementId, signature: VALID_SIG },
    { store, client: failingVerify },
  );
  assert.equal(res.verified, false);
  assert.equal(res.status, 'reconcile_required');
});

test('M0: Selected-submission recipient immutability enforcement', async () => {
  const store = ephemeralStore();
  await openIntent(store, { bountyId: 'b_freeze', submissionId: 'sub_freeze', idempotencyKey: 'idem_freeze_01' });
  await assert.rejects(
    () =>
      openIntent(store, {
        bountyId: 'b_freeze',
        submissionId: 'sub_freeze',
        recipient: RECIPIENT_BOB,
        idempotencyKey: 'idem_freeze_02',
      }),
    /Recipient immutability violation/,
  );
});

test('M0: official webhook timestamp, raw bytes, bind-before-replay', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const { client } = testClient();
  await verifySettlement({ settlementId: created.settlementId, signature: VALID_SIG }, { store, client });

  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);
  const rawBody = JSON.stringify({
    ...FIXTURE.webhookEvent,
    data: { object: { ...FIXTURE.webhookEvent.data.object, id: created.settlementId } },
  });
  const sig = signNodeBlinkWebhook(rawBody, WEBHOOK_SECRET, nowSeconds);

  const res1 = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: sig },
      rawBody: Buffer.from(rawBody, 'utf8'),
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(res1.verified, true);
  assert.equal(res1.event, 'settlement.confirmed');
  assert.equal(res1.settlementId, created.settlementId);

  const resReplay = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: sig },
      rawBody,
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(resReplay.verified, false);
  assert.equal(resReplay.reason, 'webhook_replay_detected');

  const staleSeconds = nowSeconds - 600;
  const staleSig = signNodeBlinkWebhook(rawBody, WEBHOOK_SECRET, staleSeconds);
  const resStale = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: staleSig },
      rawBody,
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(resStale.verified, false);
  assert.equal(resStale.reason, 'webhook_timestamp_stale_or_skewed');

  const noTs = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: `v1=${sig.split('v1=')[1]}` },
      rawBody,
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(noTs.verified, false);
  assert.equal(noTs.reason, 'missing_timestamp_or_signature');

  const objectBody = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: sig },
      rawBody: JSON.parse(rawBody),
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(objectBody.verified, false);
  assert.equal(objectBody.reason, 'raw_body_required');

  const missingEvent = JSON.stringify({ data: { object: { id: created.settlementId } } });
  const missingEventSig = signNodeBlinkWebhook(missingEvent, WEBHOOK_SECRET, nowSeconds);
  const resMissingEvent = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: missingEventSig },
      rawBody: missingEvent,
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(resMissingEvent.verified, false);
  assert.equal(resMissingEvent.reason, 'missing_event_type');

  const unbound = JSON.stringify({
    ...FIXTURE.webhookEvent,
    data: { object: { ...FIXTURE.webhookEvent.data.object, id: 'set_unknown_not_stored' } },
  });
  const unboundSig = signNodeBlinkWebhook(unbound, WEBHOOK_SECRET, nowSeconds);
  const resUnbound = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: unboundSig },
      rawBody: unbound,
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(resUnbound.verified, false);
  assert.equal(resUnbound.reason, 'settlement_not_bound');
  assert.equal(store.hasDigest(`${nowSeconds}.${unboundSig.split('v1=')[1]}`), false);
});

test('M0: identical idempotency replay returns the provider settlement', async () => {
  const store = ephemeralStore();
  const first = await openIntent(store);
  const second = await openIntent(store);
  assert.equal(second.idempotent_hit, true);
  assert.equal(second.settlementId, first.settlementId);
});

test('M0: Idempotency conflict fails closed', async () => {
  const store = ephemeralStore();
  await openIntent(store, { amount: '15', idempotencyKey: 'idem_key_conflict_01', bountyId: 'b_idem', submissionId: 'sub_idem', reference: 'commons:b_idem:sub_idem' });
  await assert.rejects(
    () =>
      openIntent(store, {
        amount: '50',
        idempotencyKey: 'idem_key_conflict_01',
        bountyId: 'b_idem',
        submissionId: 'sub_idem',
        reference: 'commons:b_idem:sub_idem',
      }),
    /Idempotency conflict/,
  );
});

test('M0: Non-canonical mint is rejected immediately', async () => {
  const store = ephemeralStore();
  await assert.rejects(
    () =>
      openIntent(store, {
        bountyId: 'b_mint',
        submissionId: 'sub_mint',
        mint: FAKE_MINT,
        idempotencyKey: 'idem_mint_01',
      }),
    /Non-canonical mint rejected/,
  );
});

test('M0: verifySettlement enters payment_submitted, never paid', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store, { bountyId: 'b_submit', submissionId: 'sub_submit', idempotencyKey: 'idem_submit_01', reference: 'commons:b_submit:sub_submit' });
  const { client } = testClient();
  const res = await verifySettlement({ settlementId: created.settlementId, signature: VALID_SIG }, { store, client });
  assert.equal(res.verified, true);
  assert.equal(res.status, 'payment_submitted');
});

test('M1: mapExternalReceipt constructs valid commons.external-receipt/v1 schema', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store, { bountyId: 'b_receipt', submissionId: 'sub_receipt', idempotencyKey: 'idem_receipt_01', reference: 'commons:b_receipt:sub_receipt' });
  const receipt = mapExternalReceipt({ settlement: created, signature: VALID_SIG, webhookDigest: 'abc123digest' });
  assert.equal(receipt.schema, 'commons.external-receipt/v1');
  assert.equal(receipt.expected.mint, CANONICAL_USDC_MINT);
  assert.equal(receipt.expected.baseUnits, '25000000');
  assert.equal(receipt.expected.asset, 'spl');
});

test('M1 & M2: reconcilePayment requires Commons tx/v1 and matching reference', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const externalReceipt = mapExternalReceipt({ settlement: created, signature: VALID_SIG });
  const outcome = reconcilePayment({
    externalReceipt,
    chainObservation: observation(),
  });
  assert.equal(outcome.status, 'paid');
  assert.equal(outcome.reference, 'commons:b_canary:sub_canary');
  assert.equal(outcome.slot, 312849100);
});

test('M2: destination token-account substitution fails closed', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const outcome = reconcilePayment({
    externalReceipt: mapExternalReceipt({ settlement: created, signature: VALID_SIG }),
    chainObservation: observation({ destinationTokenAccount: BOB_ATA }),
  });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('destination_token_account_mismatch'));
});

test('M2: reconcilePayment fails closed on reference mismatch or missing reference', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const receipt = mapExternalReceipt({ settlement: created, signature: VALID_SIG });
  const altered = reconcilePayment({
    externalReceipt: receipt,
    chainObservation: observation({ reference: 'commons:tampered_bounty:tampered_sub' }),
  });
  assert.equal(altered.status, 'reconcile_required');
  assert.ok(altered.reasons.includes('reference_mismatch'));

  const missing = reconcilePayment({
    externalReceipt: receipt,
    chainObservation: observation({ reference: null }),
  });
  assert.ok(missing.reasons.includes('reference_missing'));
});

test('M2: reconcilePayment fails closed on recipient substitution', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const outcome = reconcilePayment({
    externalReceipt: mapExternalReceipt({ settlement: created, signature: VALID_SIG }),
    chainObservation: observation({ destination: RECIPIENT_BOB, destinationTokenAccount: BOB_ATA }),
  });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('recipient_owner_mismatch'));
});

test('M2: reconcilePayment fails closed on counterfeit token mint', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const outcome = reconcilePayment({
    externalReceipt: mapExternalReceipt({ settlement: created, signature: VALID_SIG }),
    chainObservation: observation({ mint: FAKE_MINT }),
  });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.includes('mint_mismatch_or_non_canonical'));
});

test('M2: reconcilePayment fails closed on base units underpayment mismatch', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const outcome = reconcilePayment({
    externalReceipt: mapExternalReceipt({ settlement: created, signature: VALID_SIG }),
    chainObservation: observation({ amount: '24.999999' }),
  });
  assert.equal(outcome.status, 'reconcile_required');
  assert.ok(outcome.reasons.some((r) => r.startsWith('base_units_mismatch')));
});

test('M2: signature belongs to a different settlement', async () => {
  const store = ephemeralStore();
  const first = await openIntent(store, { bountyId: 'b_one', submissionId: 'sub_one', idempotencyKey: 'idem_one', reference: 'commons:b_one:sub_one' });
  const second = await openIntent(store, { bountyId: 'b_two', submissionId: 'sub_two', idempotencyKey: 'idem_two', reference: 'commons:b_two:sub_two' });
  const { client } = testClient();
  await verifySettlement({ settlementId: first.settlementId, signature: VALID_SIG }, { store, client });
  const mismatch = await verifySettlement({ settlementId: second.settlementId, signature: VALID_SIG }, { store, client });
  assert.equal(mismatch.verified, false);
  assert.equal(mismatch.reason, 'signature_settlement_mismatch');
  assert.equal(mismatch.status, 'reconcile_required');
});

test('M2: webhook arrives before payment_submitted', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);
  const rawBody = JSON.stringify({
    ...FIXTURE.webhookEvent,
    data: { object: { ...FIXTURE.webhookEvent.data.object, id: created.settlementId } },
  });
  const res = verifyWebhook(
    {
      headers: { [NODEBLINK_WEBHOOK_HEADER]: signNodeBlinkWebhook(rawBody, WEBHOOK_SECRET, nowSeconds) },
      rawBody,
      webhookSecret: WEBHOOK_SECRET,
      currentTime: now,
    },
    store,
  );
  assert.equal(res.verified, true);
  assert.equal(res.status, 'reconcile_required');
  assert.equal(res.reason, 'webhook_before_payment_submitted');
  assert.equal(store.get(created.idempotencyKey).status, 'reconcile_required');
});

test('M2: provider confirmed while RPC is pending or mismatched', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const receipt = mapExternalReceipt({ settlement: created, signature: VALID_SIG, providerStatus: 'confirmed' });

  const pending = reconcilePayment({
    externalReceipt: receipt,
    chainObservation: observation({ status: 'submitted', success: undefined, slot: undefined, commitment: undefined }),
  });
  assert.equal(pending.status, 'reconcile_required');
  assert.ok(pending.reasons.includes('invalid_chain_observation_schema') || pending.reasons.includes('chain_tx_not_confirmed_or_successful'));

  const mismatch = reconcilePayment({
    externalReceipt: receipt,
    chainObservation: observation({ amount: '5' }),
  });
  assert.equal(mismatch.status, 'reconcile_required');
  assert.ok(mismatch.reasons.some((r) => r.startsWith('base_units_mismatch')));
});

test('M2: RPC confirmed while provider verify is delayed', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const delayed = new NodeBlinkClient({
    apiKey: TEST_KEY,
    fetchImpl: officialFetch({ verifyDelayMs: 1 }),
  });
  const first = await verifySettlement({ settlementId: created.settlementId, signature: VALID_SIG }, { store, client: delayed });
  assert.equal(first.verified, false);
  assert.equal(first.reason, 'verify_timeout');
  assert.equal(first.status, 'reconcile_required');

  const receipt = mapExternalReceipt({ settlement: store.get(created.idempotencyKey), signature: VALID_SIG, providerStatus: 'pending' });
  const rpcOnly = reconcilePayment({
    externalReceipt: receipt,
    chainObservation: observation(),
  });
  assert.equal(rpcOnly.status, 'reconcile_required');
  assert.ok(rpcOnly.reasons.some((r) => r.startsWith('provider_status_unconfirmed')));

  const { client } = testClient();
  const later = await verifySettlement({ settlementId: created.settlementId, signature: VALID_SIG }, { store, client });
  assert.equal(later.verified, true);
  assert.equal(later.status, 'payment_submitted');
});

test('M2: late confirmation after cancel stays reconcile_required', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store, { bountyId: 'b_cancel', submissionId: 'sub_cancel', idempotencyKey: 'idem_cancel', reference: 'commons:b_cancel:sub_cancel' });
  const record = store.get(created.idempotencyKey);
  record.status = 'cancelled';
  store.set(created.idempotencyKey, record);
  const { client } = testClient();
  const res = await verifySettlement({ settlementId: created.settlementId, signature: VALID_SIG }, { store, client });
  assert.equal(res.status, 'reconcile_required');
  assert.equal(res.reason, 'late_confirmation_after_cancel');
});

test('M2: duplicate webhook and poll converge to one Commons paid event', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const { client } = testClient();
  await verifySettlement({ settlementId: created.settlementId, signature: VALID_SIG }, { store, client });
  const receipt = mapExternalReceipt({ settlement: created, signature: VALID_SIG });
  const chainObservation = observation();
  const bounty = settlementPendingBounty();
  const first = recordCanonicalSettlement({
    bounty,
    chainObservation,
    externalReceipt: receipt,
    idempotencyKey: `commons.observe_settlement:${VALID_SIG}`,
    ts: '2026-09-02T19:05:00.000Z',
    store,
  });
  assert.equal(first.status, 'paid');
  assert.equal(first.replayed, false);

  const second = recordCanonicalSettlement({
    bounty: first.bounty,
    chainObservation,
    externalReceipt: receipt,
    idempotencyKey: `commons.observe_settlement:${VALID_SIG}`,
    ts: '2026-09-02T19:05:00.000Z',
    store,
  });
  assert.equal(second.status, 'paid');
  assert.equal(second.replayed, true);
});

test('M2: payout identity cannot change after settlement creation', async () => {
  const store = ephemeralStore();
  await openIntent(store, { bountyId: 'b_id', submissionId: 'sub_id', idempotencyKey: 'idem_id', reference: 'commons:b_id:sub_id' });
  await assert.rejects(
    () =>
      openIntent(store, {
        bountyId: 'b_id',
        submissionId: 'sub_id',
        recipient: RECIPIENT_BOB,
        destinationTokenAccount: BOB_ATA,
        idempotencyKey: 'idem_id_new',
        reference: 'commons:b_id:sub_id',
      }),
    /Recipient immutability/,
  );
});

test('M2: mainnet key and undocumented test host are rejected', () => {
  assert.throws(
    () => assertTestSafeCredentials({ apiKey: 'nb_live_mainnet_secret', baseUrl: NODEBLINK_API_BASE_URL }),
    /Mainnet\/live NodeBlink key rejected/,
  );
  assert.throws(
    () =>
      new NodeBlinkClient({
        apiKey: TEST_KEY,
        baseUrl: 'https://api.testnet.nodeblink.io/v1',
        fetchImpl: officialFetch(),
      }),
    /Undocumented NodeBlink host rejected/,
  );
  assert.throws(
    () =>
      new NodeBlinkClient({
        apiKey: 'sk-not-a-test-key',
        fetchImpl: officialFetch(),
      }),
    /Mainnet\/live NodeBlink key rejected/,
  );
});

test('M2: API key, webhook secret, and raw private payload stay off public objects', async () => {
  const store = ephemeralStore();
  const created = await openIntent(store);
  const { client } = testClient();
  const verified = await verifySettlement({ settlementId: created.settlementId, signature: VALID_SIG }, { store, client });
  const receipt = mapExternalReceipt({ settlement: created, signature: VALID_SIG, webhookDigest: 'digest' });
  const paid = reconcilePayment({ externalReceipt: receipt, chainObservation: observation() });
  const secrets = [TEST_KEY, WEBHOOK_SECRET, store.get(created.idempotencyKey).rawProviderCreate];
  assertNoSecretLeak(created, secrets);
  assertNoSecretLeak(verified, secrets);
  assertNoSecretLeak(receipt, secrets);
  assertNoSecretLeak(paid, secrets);
  assert.ok(store.get(created.idempotencyKey).rawProviderCreate.includes(created.settlementId));
});
