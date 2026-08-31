import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AccountExistsError,
  MemoryAccounts,
  normalizeEmail,
} from '../gateway/accounts.mjs';
import { createGateway } from '../gateway/server.mjs';
import { WsConnection } from '../gateway/ws.mjs';

class FakeSocket extends EventEmitter {
  constructor({ writeResult = true } = {}) {
    super();
    this.destroyed = false;
    this.ended = false;
    this.writeResult = writeResult;
    this.writes = [];
  }

  write(data) {
    this.writes.push(Buffer.from(data));
    return this.writeResult;
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.emit('close');
  }

  setNoDelay() {}
}

function maskedClientFrame(op, payload, { fin = true } = {}) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (data.length < 126) {
    header = Buffer.from([(fin ? 0x80 : 0) | op, 0x80 | data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = (fin ? 0x80 : 0) | op;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = (fin ? 0x80 : 0) | op;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  const masked = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

function lastServerCloseCode(socket) {
  const frame = [...socket.writes].reverse().find((write) => (write[0] & 0x0f) === 0x8);
  assert.ok(frame, 'server must emit a close frame');
  const lengthTag = frame[1] & 0x7f;
  const offset = lengthTag < 126 ? 2 : lengthTag === 126 ? 4 : 10;
  return frame.readUInt16BE(offset);
}

async function listen(gateway) {
  await new Promise((resolve) => gateway.server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${gateway.server.address().port}`;
}

const form = (base, path, fields) => fetch(`${base}/console${path}`, {
  method: 'POST',
  redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

test('email labels are normalized but are not account-recovery credentials', async () => {
  assert.equal(normalizeEmail('  Victim@Example.COM  '), 'victim@example.com');
  assert.throws(() => normalizeEmail('not-an-email'), /valid email/);
  assert.throws(() => normalizeEmail('a@b\n.example'), /valid email/);

  const accounts = new MemoryAccounts();
  const account = await accounts.createAccount('Victim@Example.COM');
  await accounts.issue(account.id, 'developer_key', 'first');

  await assert.rejects(
    accounts.createAccount(' victim@example.com '),
    AccountExistsError,
    'knowing an existing email must not reopen the account',
  );
  assert.equal((await accounts.listCredentials(account.id)).length, 1);
});

test('public duplicate signup cannot mint a second key for an existing email', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-duplicate-signup-'));
  const gateway = await createGateway({
    inviteCode: 'potter',
    sessionSecret: 'test-session-secret-not-for-production',
    secureCookies: false,
    ledgerPath: join(dir, 'usage.jsonl'),
    keys: new Map(),
  });
  const base = await listen(gateway);
  try {
    const first = await form(base, '/signup', { email: 'victim@example.com', invite: 'potter' });
    assert.equal(first.status, 200);
    const [account] = await gateway.accounts.listAccounts();
    assert.ok(account);
    assert.equal((await gateway.accounts.listCredentials(account.id)).length, 1);

    const duplicate = await form(base, '/signup', {
      email: '  Victim@Example.COM  ',
      invite: 'potter',
    });
    assert.equal(duplicate.status, 500,
      'until email verification exists, duplicate signup must fail closed');
    assert.equal(duplicate.headers.get('set-cookie'), null,
      'a rejected duplicate must not receive an authenticated session');
    assert.equal((await gateway.accounts.listCredentials(account.id)).length, 1,
      'the attacker must not get a second key or recovery path');
  } finally {
    await gateway.close();
  }
});

test('socket backpressure does not mean a queued provider job failed', () => {
  const socket = new FakeSocket({ writeResult: false });
  const connection = new WsConnection(socket);
  assert.equal(connection.sendJson({ t: 'job', id: 'one' }), true,
    'Node accepted the bytes into its buffer even when socket.write returned false');
  assert.equal(socket.writes.length, 1);
  assert.equal(socket.ended, false);
});

test('close frames are actually written and the close callback fires once', () => {
  const socket = new FakeSocket();
  const connection = new WsConnection(socket);
  let closes = 0;
  connection.on('close', () => { closes += 1; });

  connection.close(1000, 'done');
  socket.emit('close');

  assert.equal(lastServerCloseCode(socket), 1000);
  assert.equal(closes, 1);
});

test('fragmented messages have a cumulative allocation cap', () => {
  const socket = new FakeSocket();
  const connection = new WsConnection(socket);
  const fiveMiB = Buffer.alloc(5 * 1024 * 1024, 0x61);
  const fourMiB = Buffer.alloc(4 * 1024 * 1024, 0x62);

  socket.emit('data', maskedClientFrame(0x1, fiveMiB, { fin: false }));
  assert.equal(socket.ended, false);
  socket.emit('data', maskedClientFrame(0x0, fourMiB, { fin: true }));

  assert.equal(socket.ended, true);
  assert.equal(lastServerCloseCode(socket), 1009);
});

test('invalid fragmented and binary provider messages are rejected explicitly', () => {
  const interruptedSocket = new FakeSocket();
  const interrupted = new WsConnection(interruptedSocket);
  interruptedSocket.emit('data', maskedClientFrame(0x1, 'part', { fin: false }));
  interruptedSocket.emit('data', maskedClientFrame(0x1, 'new message'));
  assert.equal(lastServerCloseCode(interruptedSocket), 1002);

  const binarySocket = new FakeSocket();
  const binary = new WsConnection(binarySocket);
  binarySocket.emit('data', maskedClientFrame(0x2, Buffer.from([1, 2, 3])));
  assert.equal(lastServerCloseCode(binarySocket), 1003);
  void interrupted;
  void binary;
});
