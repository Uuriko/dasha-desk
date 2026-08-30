/**
 * OCM core-loop end-to-end tests.
 *
 * Drives the real gateway over a real WebSocket with stub hosts: the host holds a
 * socket, the developer POSTs, the gateway routes and streams, the ledger clears.
 * That is the whole of the PDF's §05 first version.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGateway } from '../gateway/server.mjs';

const HOST_TOKEN = 'host-test-token';
const API_KEY = 'ocm_test_key';

async function startGateway() {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-'));
  const gw = await createGateway({
    hostToken: HOST_TOKEN,
    keys: new Map([[API_KEY, 'test-dev']]),
    ledgerPath: join(dir, 'usage.jsonl'),
    grantTokens: 10_000,
  });
  return new Promise((resolve) => {
    gw.server.listen(0, '127.0.0.1', () => {
      resolve({ ...gw, base: `http://127.0.0.1:${gw.server.address().port}`,
                wsBase: `ws://127.0.0.1:${gw.server.address().port}` });
    });
  });
}

/**
 * A stub host. `behaviour(job, api)` decides what this host does with a job,
 * which is how failure modes are exercised deterministically.
 */
function connectHost(gw, { id, models = ['qwen3-8b'], behaviour }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${gw.wsBase}/host/connect?token=${HOST_TOKEN}`);
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        t: 'hello',
        agent: { id, models, chip: 'stub', memory_gb: 24, region: 'local' },
      }));
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.t === 'welcome') { resolve({ ws, id }); return; }
      if (msg.t === 'job') {
        behaviour(msg, {
          chunk: (delta) => ws.send(JSON.stringify({ t: 'chunk', id: msg.id, delta })),
          done: (usage) => ws.send(JSON.stringify({ t: 'done', id: msg.id, usage })),
          error: (message) => ws.send(JSON.stringify({ t: 'error', id: msg.id, message })),
          drop: () => ws.close(),
        });
      }
    });
  });
}

const post = (gw, body, key = API_KEY) => fetch(`${gw.base}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify(body),
});

const ask = (content = 'hello') => ({ model: 'qwen3-8b', messages: [{ role: 'user', content }] });

const echoHost = (job, api) => {
  for (const part of ['Hello', ', ', 'world']) api.chunk(part);
  api.done();
};

test('health, models and network reflect connected hosts', async () => {
  const gw = await startGateway();
  try {
    assert.equal((await (await fetch(`${gw.base}/healthz`)).json()).hosts, 0);
    await connectHost(gw, { id: 'h1', models: ['qwen3-8b', 'codellama'], behaviour: echoHost });

    const models = await (await fetch(`${gw.base}/v1/models`)).json();
    assert.deepEqual(models.data.map((m) => m.id), ['codellama', 'qwen3-8b']);
    assert.equal(models.object, 'list');

    const net = await (await fetch(`${gw.base}/v1/network`)).json();
    assert.equal(net.hosts.length, 1);
    assert.equal(net.hosts[0].chip, 'stub');
  } finally { await gw.close(); }
});

test('rejects a bad key and an unknown model', async () => {
  const gw = await startGateway();
  try {
    await connectHost(gw, { id: 'h1', behaviour: echoHost });
    assert.equal((await post(gw, ask(), 'nope')).status, 401);
    assert.equal((await post(gw, { model: 'not-served', messages: [{ role: 'user', content: 'x' }] })).status, 503);
    assert.equal((await post(gw, { model: 'qwen3-8b' })).status, 400);
  } finally { await gw.close(); }
});

test('complete (non-streamed) response is OpenAI-shaped', async () => {
  const gw = await startGateway();
  try {
    await connectHost(gw, { id: 'h1', behaviour: echoHost });
    const body = await (await post(gw, ask())).json();
    assert.equal(body.object, 'chat.completion');
    assert.equal(body.choices[0].message.content, 'Hello, world');
    assert.equal(body.choices[0].finish_reason, 'stop');
    assert.ok(body.usage.completion_tokens > 0);
    assert.equal(body.usage.total_tokens, body.usage.prompt_tokens + body.usage.completion_tokens);
  } finally { await gw.close(); }
});

test('streamed response emits OpenAI chunks through [DONE]', async () => {
  const gw = await startGateway();
  try {
    await connectHost(gw, { id: 'h1', behaviour: echoHost });
    const res = await post(gw, { ...ask(), stream: true });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const raw = await res.text();

    const frames = raw.split('\n\n').filter(Boolean).map((l) => l.replace(/^data: /, ''));
    assert.equal(frames.at(-1), '[DONE]');
    const parsed = frames.slice(0, -1).map((f) => JSON.parse(f));
    assert.ok(parsed.every((p) => p.object === 'chat.completion.chunk'));
    assert.equal(parsed.map((p) => p.choices[0].delta.content || '').join(''), 'Hello, world');
    assert.equal(parsed.at(-1).choices[0].finish_reason, 'stop');
  } finally { await gw.close(); }
});

test('the ledger bills the gateway count, never the host\'s claim', async () => {
  const gw = await startGateway();
  try {
    // This host reports a wildly inflated usage figure, as a dishonest host would.
    await connectHost(gw, {
      id: 'h1',
      behaviour: (job, api) => { api.chunk('abcd'); api.done({ completion_tokens: 999_999 }); },
    });
    const before = await gw.ledger.balance('test-dev');
    await (await post(gw, ask())).json();

    const entry = (await gw.ledger.summary()).recent[0];
    assert.equal(entry.host, 'h1');
    assert.equal(entry.completionTokens, 1, 'four characters must meter as one token, not 999999');
    assert.equal(await gw.ledger.balance('test-dev'), before - entry.tokens);
    assert.equal(await gw.ledger.credited('h1'), 1);
  } finally { await gw.close(); }
});

test('a host failing before first token is retried on another host', async () => {
  const gw = await startGateway();
  try {
    let badCalls = 0;
    await connectHost(gw, { id: 'bad', behaviour: (job, api) => { badCalls++; api.error('runtime not ready'); } });
    await connectHost(gw, { id: 'good', behaviour: echoHost });

    const body = await (await post(gw, ask())).json();
    assert.equal(body.choices[0].message.content, 'Hello, world');
    assert.equal(badCalls, 1, 'the failing host should have been tried once');
    assert.equal((await gw.ledger.summary()).recent[0].host, 'good', 'only the host that delivered is credited');
    assert.equal(await gw.ledger.credited('bad'), 0, 'a host that delivered nothing earns nothing');
  } finally { await gw.close(); }
});

test('a non-streamed request whose host dies mid-generation is retried, not billed', async () => {
  const gw = await startGateway();
  try {
    await connectHost(gw, {
      id: 'flaky',
      behaviour: (job, api) => { api.chunk('partial'); api.drop(); },
    });
    await connectHost(gw, { id: 'good', behaviour: echoHost });

    const body = await (await post(gw, ask())).json();
    assert.equal(body.choices[0].message.content, 'Hello, world',
      'the client must see a whole answer, not the dead host\'s partial one');
    assert.equal(await gw.ledger.credited('flaky'), 0,
      'tokens the client never received are not billable');
  } finally { await gw.close(); }
});

test('every host being unavailable is a 503, not a hang', async () => {
  const gw = await startGateway();
  try {
    await connectHost(gw, { id: 'bad1', behaviour: (j, api) => api.error('nope') });
    await connectHost(gw, { id: 'bad2', behaviour: (j, api) => api.error('nope') });
    const res = await post(gw, ask());
    assert.equal(res.status, 503);
    assert.match((await res.json()).error.message, /no healthy host|all candidate hosts/);
  } finally { await gw.close(); }
});

test('a disconnected host is removed from the registry', async () => {
  const gw = await startGateway();
  try {
    const host = await connectHost(gw, { id: 'h1', behaviour: echoHost });
    assert.equal(gw.registry.online().length, 1);
    host.ws.close();
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(gw.registry.online().length, 0);
    assert.equal((await post(gw, ask())).status, 503);
  } finally { await gw.close(); }
});

test('a host reconnecting with the same id is not deregistered by its stale socket', async () => {
  const gw = await startGateway();
  try {
    // First socket for this host id.
    const first = await connectHost(gw, { id: 'flappy', behaviour: echoHost });
    assert.equal(gw.registry.online().length, 1);

    // It reconnects — same id — before the old socket has finished closing.
    const second = await connectHost(gw, { id: 'flappy', behaviour: echoHost });
    assert.equal(gw.registry.online().length, 1, 'same id must not double-register');

    // Now the stale socket finally closes. The live registration must survive.
    first.ws.close();
    await new Promise((r) => setTimeout(r, 300));

    assert.equal(gw.registry.online().length, 1,
      'the stale socket deregistered the live host — a reconnecting host would vanish');
    const body = await (await post(gw, ask())).json();
    assert.equal(body.choices[0].message.content, 'Hello, world',
      'the host must still serve after its old socket closed');
    void second;
  } finally { await gw.close(); }
});

test('the console is anonymous-safe and stats reflect real state', async () => {
  const gw = await startGateway();
  try {
    await connectHost(gw, { id: 'console-host', behaviour: echoHost });
    await (await post(gw, ask())).json();

    const res = await fetch(`${gw.base}/console`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /Open-Compute Marketplace/);
    assert.match(html, /Sign in/, 'an anonymous visitor gets the landing page');
    assert.doesNotMatch(html, /console-host/,
      'provider identities must not be exposed to anonymous visitors');
    assert.match(html, /no confidentiality is\s*claimed/i,
      'the console must not overstate privacy');
    assert.doesNotMatch(html, /undefined|NaN/, 'template holes leaked into the page');

    const s = await (await fetch(`${gw.base}/console/stats.json`)).json();
    assert.equal(s.hosts.length, 1);
    assert.equal(s.totals.requests, 1);
    assert.ok(s.totals.completion_tokens > 0);
    assert.equal(s.consumers[0].consumer, 'test-dev');
  } finally { await gw.close(); }
});

// ---------------------------------------------------------------------------
// Accounts and credentials
// ---------------------------------------------------------------------------

const admin = (gw, path, body) => fetch(`${gw.base}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer test-admin' },
  body: JSON.stringify(body),
});

function startGatewayWithAdmin() {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-'));
  return createGateway({
    hostToken: HOST_TOKEN,
    adminToken: 'test-admin',
    keys: new Map([[API_KEY, 'test-dev']]),
    ledgerPath: join(dir, 'usage.jsonl'),
    grantTokens: 10_000,
  }).then((gw) => new Promise((resolve) => {
    gw.server.listen(0, '127.0.0.1', () => resolve({ ...gw,
      base: `http://127.0.0.1:${gw.server.address().port}`,
      wsBase: `ws://127.0.0.1:${gw.server.address().port}` }));
  }));
}

test('admin routes require the admin token', async () => {
  const gw = await startGatewayWithAdmin();
  try {
    const res = await fetch(`${gw.base}/admin/accounts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c' }),
    });
    assert.equal(res.status, 401, 'admin routes must not be open');
  } finally { await gw.close(); }
});

test('an issued developer key authorises requests and is billed to its account', async () => {
  const gw = await startGatewayWithAdmin();
  try {
    await connectHost(gw, { id: 'h1', behaviour: echoHost });
    const acct = await (await admin(gw, '/admin/accounts', { email: 'Dev@Example.com' })).json();
    assert.match(acct.id, /^acct_/);
    assert.equal(acct.email, 'dev@example.com', 'email should be normalised');

    const cred = await (await admin(gw, '/admin/credentials',
      { account_id: acct.id, kind: 'developer_key', label: 'laptop' })).json();
    assert.match(cred.secret, /^ocm_live_/);

    const body = await (await post(gw, ask(), cred.secret)).json();
    assert.equal(body.choices[0].message.content, 'Hello, world');

    const s = await gw.ledger.summary();
    assert.ok(s.consumers.some((c) => c.consumer === acct.id),
      'usage must be billed to the account, not a shared consumer');
  } finally { await gw.close(); }
});

test('the plaintext secret is never stored or retrievable', async () => {
  const gw = await startGatewayWithAdmin();
  try {
    const acct = await (await admin(gw, '/admin/accounts', { email: 'x@y.z' })).json();
    const cred = await (await admin(gw, '/admin/credentials',
      { account_id: acct.id, kind: 'developer_key' })).json();

    const listed = await gw.accounts.listCredentials(acct.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].secret, undefined, 'secret must not come back from storage');
    assert.equal(listed[0].hash, undefined, 'hash must not be exposed either');
    assert.ok(JSON.stringify(listed).indexOf(cred.secret) === -1,
      'the plaintext must appear nowhere in stored state');
  } finally { await gw.close(); }
});

test('a revoked key stops working immediately', async () => {
  const gw = await startGatewayWithAdmin();
  try {
    await connectHost(gw, { id: 'h1', behaviour: echoHost });
    const acct = await (await admin(gw, '/admin/accounts', { email: 'r@e.v' })).json();
    const cred = await (await admin(gw, '/admin/credentials',
      { account_id: acct.id, kind: 'developer_key' })).json();

    assert.equal((await post(gw, ask(), cred.secret)).status, 200);
    const r = await (await admin(gw, '/admin/revoke', { credential_id: cred.id })).json();
    assert.equal(r.revoked, true);
    assert.equal((await post(gw, ask(), cred.secret)).status, 401,
      'a revoked key must be refused');
  } finally { await gw.close(); }
});

test('a valid developer key cannot open a provider socket, and the refusal is logged', async () => {
  const gw = await startGatewayWithAdmin();
  const errs = [];
  const realError = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  try {
    const acct = await (await admin(gw, '/admin/accounts', { email: 'mixed@r.o' })).json();
    const key = await (await admin(gw, '/admin/credentials',
      { account_id: acct.id, kind: 'developer_key', label: 'laptop' })).json();
    assert.match(key.secret, /^ocm_live_/);

    // The mistake this guards: putting a developer key in OCM_HOST_TOKEN. The key
    // is valid, so nothing about it looks wrong to whoever installed the agent.
    const rejected = await new Promise((resolve) => {
      const ws = new WebSocket(`${gw.wsBase}/host/connect?token=${encodeURIComponent(key.secret)}`);
      ws.addEventListener('error', () => resolve(true));
      ws.addEventListener('open', () => resolve(false));
    });
    assert.equal(rejected, true, 'a developer key must not authorise a host socket');

    const line = errs.find((e) => e.includes('provider socket rejected'));
    assert.ok(line, 'a rejected provider must leave a server-side record');
    assert.match(line, /developer key, not a provider token/,
      'the log must say which mistake was made');
    assert.doesNotMatch(line, /ocm_live_[A-Za-z0-9_-]{8}/,
      'the log must never contain the presented secret');
  } finally { console.error = realError; await gw.close(); }
});

test('a host presenting an issued provider token connects; a bad one does not', async () => {
  const gw = await startGatewayWithAdmin();
  try {
    const acct = await (await admin(gw, '/admin/accounts', { email: 'p@r.o' })).json();
    const tok = await (await admin(gw, '/admin/credentials',
      { account_id: acct.id, kind: 'provider_token', label: 'mac mini' })).json();
    assert.match(tok.secret, /^ocm_host_/);

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`${gw.wsBase}/host/connect?token=${encodeURIComponent(tok.secret)}`);
      ws.addEventListener('error', reject);
      ws.addEventListener('open', () => ws.send(JSON.stringify({
        t: 'hello', agent: { id: 'owned-host', models: ['qwen3-8b'] } })));
      ws.addEventListener('message', (ev) => {
        if (JSON.parse(ev.data).t === 'welcome') resolve();
      });
    });
    assert.equal(gw.registry.get('owned-host').caps.accountId, acct.id,
      'the host must be bound to the issuing account');

    const rejected = await new Promise((resolve) => {
      const ws = new WebSocket(`${gw.wsBase}/host/connect?token=ocm_host_not_a_real_token`);
      ws.addEventListener('error', () => resolve(true));
      ws.addEventListener('open', () => resolve(false));
    });
    assert.equal(rejected, true, 'an unissued provider token must be refused');
  } finally { await gw.close(); }
});

test('with no bootstrap credentials configured, nothing is accepted by default', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-'));
  const gw = await createGateway({ ledgerPath: join(dir, 'usage.jsonl'), keys: undefined });
  await new Promise((r) => gw.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${gw.server.address().port}`;
  try {
    // The old defaults must not be honoured.
    for (const key of ['ocm_live_dev', 'host-dev-token', '']) {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(ask()),
      });
      assert.equal(res.status, 401, `well-known default "${key}" must not authorise`);
    }
    const rejected = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${gw.server.address().port}/host/connect?token=host-dev-token`);
      ws.addEventListener('error', () => resolve(true));
      ws.addEventListener('open', () => resolve(false));
    });
    assert.equal(rejected, true, 'the old default host token must not connect');
  } finally { await gw.close(); }
});

// ---------------------------------------------------------------------------
// Console flows: invite-gated signup, sign-in, credential management
// ---------------------------------------------------------------------------

function startConsole(opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-'));
  return createGateway({
    hostToken: HOST_TOKEN,
    inviteCode: 'potter',
    sessionSecret: 'test-session-secret',
    secureCookies: false,
    keys: new Map([[API_KEY, 'test-dev']]),
    ledgerPath: join(dir, 'usage.jsonl'),
    grantTokens: 5_000,
    ...opts,
  }).then((gw) => new Promise((resolve) => {
    gw.server.listen(0, '127.0.0.1', () => resolve({ ...gw,
      base: `http://127.0.0.1:${gw.server.address().port}`,
      wsBase: `ws://127.0.0.1:${gw.server.address().port}` }));
  }));
}

const form = (gw, path, fields, cookie) => fetch(`${gw.base}/console${path}`, {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded',
             ...(cookie ? { cookie } : {}) },
  body: new URLSearchParams(fields).toString(),
});

test('signup works without a code, but the account starts at zero', async () => {
  const gw = await startConsole();
  try {
    const res = await form(gw, '/signup', { email: 'nocode@dev.io' });
    assert.equal(res.status, 200, 'signup must not require a code');
    const html = await res.text();
    const secret = html.match(/ocm_live_[A-Za-z0-9_-]+/)?.[0];
    assert.ok(secret, 'a key is still issued');
    assert.match(html, /balance is zero/i, 'the user must be told why nothing will work');

    const acct = (await gw.accounts.resolve(secret, 'developer_key')).accountId;
    assert.equal(await gw.ledger.balance(acct), 0);
    assert.equal(await gw.ledger.grantCount(acct), 0);

    // The key is valid but unfunded: 402, not 401, and it says what to do.
    await connectHost(gw, { id: 'h1', behaviour: echoHost });
    const call = await post(gw, ask(), secret);
    assert.equal(call.status, 402);
    assert.match((await call.json()).error.message, /redeem an invite code/i);
  } finally { await gw.close(); }
});

test('a wrong code at signup is refused rather than silently ignored', async () => {
  const gw = await startConsole();
  try {
    const res = await form(gw, '/signup', { email: 'wrong@dev.io', invite: 'nope' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /error=/,
      'a mistyped code must not quietly create a zero-token account');
  } finally { await gw.close(); }
});

test('a code at signup grants tokens', async () => {
  const gw = await startConsole();
  try {
    const res = await form(gw, '/signup', { email: 'coded@dev.io', invite: 'potter' });
    const html = await res.text();
    const secret = html.match(/ocm_live_[A-Za-z0-9_-]+/)[0];
    const acct = (await gw.accounts.resolve(secret, 'developer_key')).accountId;
    assert.equal(await gw.ledger.balance(acct), 5000);
    assert.equal(await gw.ledger.grantCount(acct), 1);
  } finally { await gw.close(); }
});

test('a code can be redeemed retroactively, exactly once', async () => {
  const gw = await startConsole();
  try {
    const signup = await form(gw, '/signup', { email: 'later@dev.io' });
    const cookie = signup.headers.get('set-cookie').split(';')[0];
    const secret = (await signup.text()).match(/ocm_live_[A-Za-z0-9_-]+/)[0];
    const acct = (await gw.accounts.resolve(secret, 'developer_key')).accountId;
    assert.equal(await gw.ledger.balance(acct), 0);

    // The dashboard should be offering the redemption.
    const before = await (await fetch(`${gw.base}/console`, { headers: { cookie } })).text();
    assert.match(before, /Redeem an invite code/);

    const wrong = await form(gw, '/redeem', { invite: 'nope' }, cookie);
    assert.match(wrong.headers.get('location'), /error=/);
    assert.equal(await gw.ledger.balance(acct), 0, 'a wrong code must not grant');

    const ok = await form(gw, '/redeem', { invite: 'potter' }, cookie);
    assert.match(ok.headers.get('location'), /notice=/);
    assert.equal(await gw.ledger.balance(acct), 5000);
    assert.equal(await gw.ledger.grantCount(acct), 1);

    // Second redemption must be refused, and must not add tokens.
    const again = await form(gw, '/redeem', { invite: 'potter' }, cookie);
    assert.match(again.headers.get('location'), /error=/);
    assert.equal(await gw.ledger.balance(acct), 5000, 'a code must not be redeemable twice');
    assert.equal(await gw.ledger.grantCount(acct), 1);

    const after = await (await fetch(`${gw.base}/console`, { headers: { cookie } })).text();
    assert.doesNotMatch(after, /Redeem an invite code/, 'the form should be gone once redeemed');
  } finally { await gw.close(); }
});

test('redeeming at signup blocks a second redemption later', async () => {
  const gw = await startConsole();
  try {
    const signup = await form(gw, '/signup', { email: 'both@dev.io', invite: 'potter' });
    const cookie = signup.headers.get('set-cookie').split(';')[0];
    const secret = (await signup.text()).match(/ocm_live_[A-Za-z0-9_-]+/)[0];
    const acct = (await gw.accounts.resolve(secret, 'developer_key')).accountId;

    const again = await form(gw, '/redeem', { invite: 'potter' }, cookie);
    assert.match(decodeURIComponent(again.headers.get('location')), /already redeemed/i);
    assert.equal(await gw.ledger.balance(acct), 5000, 'signup + redeem must not stack');
  } finally { await gw.close(); }
});

test('redemption requires a session', async () => {
  const gw = await startConsole();
  try {
    const res = await form(gw, '/redeem', { invite: 'potter' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/', 'anonymous redemption must not grant anything');
  } finally { await gw.close(); }
});

test('sign-in with a developer key opens the dashboard; a bad key does not', async () => {
  const gw = await startConsole();
  try {
    const signup = await form(gw, '/signup', { email: 'me@dev.io', invite: 'potter' });
    const secret = (await signup.text()).match(/ocm_live_[A-Za-z0-9_-]+/)[0];

    const bad = await form(gw, '/signin', { key: 'ocm_live_nope' });
    assert.match(bad.headers.get('location'), /error=/);

    const good = await form(gw, '/signin', { key: secret });
    assert.equal(good.status, 302);
    const cookie = good.headers.get('set-cookie').split(';')[0];

    const dash = await fetch(`${gw.base}/console`, { headers: { cookie } });
    const html = await dash.text();
    assert.match(html, /me@dev\.io/, 'the dashboard must identify the signed-in account');
    assert.match(html, /Your balance/);
    assert.doesNotMatch(html, /undefined|NaN/);

    // No cookie: the landing page, not the dashboard.
    const anon = await (await fetch(`${gw.base}/console`)).text();
    assert.match(anon, /Sign in/);
    assert.doesNotMatch(anon, /me@dev\.io/, 'an anonymous visitor must not see account data');
  } finally { await gw.close(); }
});

test('a forged or expired session cookie is rejected', async () => {
  const gw = await startConsole();
  try {
    const signup = await form(gw, '/signup', { email: 'f@dev.io', invite: 'potter' });
    const secret = (await signup.text()).match(/ocm_live_[A-Za-z0-9_-]+/)[0];
    const acct = (await gw.accounts.resolve(secret, 'developer_key')).accountId;

    for (const forged of [`${acct}.99999999999.badsignature`, `${acct}.1.abc`, 'garbage']) {
      const res = await fetch(`${gw.base}/console`, { headers: { cookie: `ocm_session=${forged}` } });
      const html = await res.text();
      assert.match(html, /Sign in/, `forged cookie "${forged.slice(0, 20)}" must not authenticate`);
      assert.doesNotMatch(html, /f@dev\.io/);
    }
  } finally { await gw.close(); }
});

test('a signed-in account cannot revoke a credential it does not own', async () => {
  const gw = await startConsole();
  try {
    const a = await form(gw, '/signup', { email: 'a@own.io', invite: 'potter' });
    const aCookie = a.headers.get('set-cookie').split(';')[0];
    const b = await form(gw, '/signup', { email: 'b@own.io', invite: 'potter' });
    const bSecret = (await b.text()).match(/ocm_live_[A-Za-z0-9_-]+/)[0];
    const bAcct = (await gw.accounts.resolve(bSecret, 'developer_key')).accountId;
    const bCred = (await gw.accounts.listCredentials(bAcct))[0];

    await form(gw, '/keys/revoke', { credential_id: bCred.id }, aCookie);

    const after = (await gw.accounts.listCredentials(bAcct))[0];
    assert.equal(after.revoked_at, null, "one account revoked another account's credential");
    assert.ok(await gw.accounts.resolve(bSecret, 'developer_key'), "the victim's key must still work");
  } finally { await gw.close(); }
});

test('the provider guide is private and warns about plaintext prompts', async () => {
  const gw = await startConsole();
  try {
    const anon = await fetch(`${gw.base}/console/provider`, { redirect: 'manual' });
    assert.equal(anon.status, 302, 'the guide must require sign-in');

    const s = await form(gw, '/signup', { email: 'p@dev.io', invite: 'potter' });
    const cookie = s.headers.get('set-cookie').split(';')[0];
    const html = await (await fetch(`${gw.base}/console/provider`, { headers: { cookie } })).text();
    assert.match(html, /plaintext/i, 'providers must be told they can see prompts');
    assert.match(html, /Apple Silicon/, 'the hardware requirement must be stated');
    assert.match(html, /no inbound ports/i);
  } finally { await gw.close(); }
});

test('the gateway serves the agent and installer it expects', async () => {
  const gw = await startGateway();
  try {
    const agent = await fetch(`${gw.base}/agent.py`);
    assert.equal(agent.status, 200);
    assert.match(agent.headers.get('content-type'), /python/);
    const py = await agent.text();
    assert.match(py, /OCM host agent/, 'must be the real agent');
    assert.match(py, /class MlxRuntime/);

    const install = await fetch(`${gw.base}/install.sh`);
    assert.equal(install.status, 200);
    const sh = await install.text();
    assert.match(sh, /Apple Silicon is required/, 'the installer must refuse Intel Macs');
    assert.match(sh, /OCM_HOST_TOKEN/);
    assert.match(sh, /launchctl bootstrap/, 'it must install a persistent service');
    assert.match(sh, /plaintext/, 'it must be honest about what a provider can see');
    assert.doesNotMatch(sh, /ocm_host_[A-Za-z0-9_-]{10}/, 'no real token may be baked in');
  } finally { await gw.close(); }
});

test('the Network tab exists only for admin emails and lists every account', async () => {
  const gw = await startConsole({ adminEmails: 'Boss@dev.io, other@dev.io' });
  try {
    const anon = await fetch(`${gw.base}/console/network`, { redirect: 'manual' });
    assert.equal(anon.status, 302, 'anonymous must be redirected');

    const u = await form(gw, '/signup', { email: 'user@dev.io', invite: 'potter' });
    const uCookie = u.headers.get('set-cookie').split(';')[0];
    const uHome = await (await fetch(`${gw.base}/console`, { headers: { cookie: uCookie } })).text();
    assert.doesNotMatch(uHome, /href="\/network"/, 'non-admins must not see the tab');
    const uNet = await fetch(`${gw.base}/console/network`, { redirect: 'manual', headers: { cookie: uCookie } });
    assert.equal(uNet.status, 302, 'non-admins are redirected, not shown a 403');

    const a = await form(gw, '/signup', { email: 'boss@dev.io', invite: 'potter' });
    const aCookie = a.headers.get('set-cookie').split(';')[0];
    const aHome = await (await fetch(`${gw.base}/console`, { headers: { cookie: aCookie } })).text();
    assert.match(aHome, /href="\/network"/, 'admins see the tab (match is case-insensitive)');
    const net = await fetch(`${gw.base}/console/network`, { headers: { cookie: aCookie } });
    assert.equal(net.status, 200);
    const html = await net.text();
    assert.match(html, /user@dev\.io/, 'the network page lists other accounts');
    assert.match(html, /boss@dev\.io/);

    // The anonymous counters must not have grown an email column as a side effect.
    const stats = JSON.stringify(await (await fetch(`${gw.base}/console/stats.json`)).json());
    assert.doesNotMatch(stats, /@dev\.io/);
  } finally { await gw.close(); }
});

test('revoking a key ends its console session immediately', async () => {
  const gw = await startConsole();
  try {
    const signup = await form(gw, '/signup', { email: 'rev@dev.io', invite: 'potter' });
    const cookie = signup.headers.get('set-cookie').split(';')[0];
    const secret = (await signup.text()).match(/ocm_live_[A-Za-z0-9_-]+/)[0];
    const acct = (await gw.accounts.resolve(secret, 'developer_key')).accountId;
    const cred = (await gw.accounts.listCredentials(acct))[0];

    // Signed in and working.
    const before = await (await fetch(`${gw.base}/console`, { headers: { cookie } })).text();
    assert.match(before, /rev@dev\.io/);

    await gw.accounts.revoke(cred.id);

    // The API refuses it — and so must the console, with the same cookie.
    await connectHost(gw, { id: 'h1', behaviour: echoHost });
    assert.equal((await post(gw, ask(), secret)).status, 401);

    const after = await fetch(`${gw.base}/console`, { headers: { cookie } });
    const html = await after.text();
    assert.doesNotMatch(html, /rev@dev\.io/,
      'a revoked key must not keep its browser session alive');
    assert.match(html, /Sign in/);
    assert.match(after.headers.get('set-cookie') || '', /ocm_session=;/,
      'the dead cookie should be cleared, not just ignored');
  } finally { await gw.close(); }
});

test('a session cookie naming another account cannot be forged', async () => {
  const gw = await startConsole();
  try {
    const a = await form(gw, '/signup', { email: 'victim@dev.io', invite: 'potter' });
    const aSecret = (await a.text()).match(/ocm_live_[A-Za-z0-9_-]+/)[0];
    const aAcct = (await gw.accounts.resolve(aSecret, 'developer_key')).accountId;
    const aCred = (await gw.accounts.listCredentials(aAcct))[0];

    const b = await form(gw, '/signup', { email: 'attacker@dev.io', invite: 'potter' });
    const bCookie = b.headers.get('set-cookie').split(';')[0];

    // Swap the account id into an otherwise valid-looking cookie: the HMAC covers it.
    const forged = bCookie.replace(/ocm_session=[^.]+\./, `ocm_session=${aAcct}.`);
    const res = await fetch(`${gw.base}/console`, { headers: { cookie: forged } });
    const html = await res.text();
    assert.doesNotMatch(html, /victim@dev\.io/, 'account id in the cookie must be signed');
    assert.match(html, /Sign in/);
    void aCred;
  } finally { await gw.close(); }
});
