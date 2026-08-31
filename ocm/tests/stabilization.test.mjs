import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger } from '../gateway/ledger.mjs';

const AGENT = fileURLToPath(new URL('../agent/agent.py', import.meta.url));

const usage = (overrides = {}) => ({
  consumer: 'acct_test',
  host: 'provider-m4',
  model: 'ocm-coder',
  promptTokens: 5,
  completionTokens: 7,
  jobId: 'job-1',
  ...overrides,
});

test('the MLX agent imports successfully and never puts its credential in the URL', () => {
  const source = readFileSync(AGENT, 'utf8');
  assert.match(source, /^import threading$/m,
    'MlxRuntime constructs a threading.Lock during module import');
  assert.match(source, /websockets==13\.1/,
    'the handshake-header API must be pinned rather than inherited from an unbounded major');
  assert.match(source, /extra_headers=\{"Authorization": f"Bearer \{HOST_TOKEN\}"\}/,
    'the provider token must be sent in the Authorization header');
  assert.doesNotMatch(source, /host\/connect\?token=/,
    'provider credentials must never be embedded in a WebSocket URL');

  execFileSync('python3', ['-m', 'py_compile', AGENT]);

  // Import the MLX path on Linux without installing MLX or websockets. MlxRuntime
  // must be constructible before mlx_lm is imported lazily by an actual job.
  const stub = mkdtempSync(join(tmpdir(), 'ocm-python-'));
  for (const dir of ['websockets', 'websockets/legacy']) {
    mkdirSync(join(stub, dir), { recursive: true });
    writeFileSync(join(stub, dir, '__init__.py'), '');
  }
  writeFileSync(join(stub, 'websockets/legacy/client.py'),
    'def connect(*args, **kwargs):\n    return None\n');

  execFileSync('python3', ['-c', [
    'import importlib.util, sys',
    'spec = importlib.util.spec_from_file_location("ocm_agent", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'assert module.RUNTIME.name == "mlx"',
    'assert module.RUNTIME._lock is not None',
  ].join('; '), AGENT], {
    env: { ...process.env, PYTHONPATH: stub, OCM_RUNTIME: 'mlx' },
  });
});

test('local usage clearing is at-most-once and conflicts fail', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-ledger-'));
  const ledger = new Ledger(join(dir, 'usage.jsonl'));
  await ledger.init();
  await ledger.grant('acct_test', 100, 'test grant');

  const first = await ledger.clear(usage());
  const replay = await ledger.clear(usage());
  assert.equal(replay.id, first.id);
  assert.equal(replay.replayed, true);

  const summary = await ledger.summary();
  assert.equal(summary.totals.requests, 1,
    'an identical terminal retry must not create a second debit/provider credit');
  assert.equal(summary.recent.length, 1);
  assert.equal(await ledger.balance('acct_test'), 88);
  assert.equal(await ledger.credited('provider-m4'), 7);

  await assert.rejects(
    ledger.clear(usage({ completionTokens: 8 })),
    /idempotency_conflict/,
    'one job id cannot be reused for different accounting facts',
  );
  await assert.rejects(ledger.clear(usage({ jobId: '' })), /jobId must be/);
  await assert.rejects(ledger.clear(usage({ promptTokens: 1.5 })), /safe integer/);
});

test('an append failure makes accounting unhealthy and stops balance reads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-ledger-fail-'));
  const path = join(dir, 'usage.jsonl');
  const ledger = new Ledger(path);
  await ledger.init();
  await ledger.grant('acct_test', 100);

  // Replace the log file with a directory so appendFileSync deterministically fails,
  // including on privileged CI runners.
  unlinkSync(path);
  mkdirSync(path);

  await assert.rejects(ledger.clear(usage()), /ACCOUNTING_UNHEALTHY/);
  assert.equal(ledger.health().ok, false);
  await assert.rejects(ledger.balance('acct_test'), /ACCOUNTING_UNHEALTHY/,
    'the gateway balance gate must stop accepting new work after accounting fails');
});

test('conflicting persisted rows are detected at startup', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ocm-ledger-corrupt-'));
  const path = join(dir, 'usage.jsonl');
  mkdirSync(dirname(path), { recursive: true });
  const base = {
    id: 'one', at: new Date(0).toISOString(), kind: 'usage',
    consumer: 'acct_test', host: 'provider-m4', model: 'ocm-coder',
    jobId: 'same-job', promptTokens: 1, completionTokens: 1, tokens: 2,
  };
  writeFileSync(path, `${JSON.stringify(base)}\n${JSON.stringify({
    ...base, id: 'two', completionTokens: 2, tokens: 3,
  })}\n`);

  const ledger = new Ledger(path);
  await assert.rejects(ledger.init(), /conflicting persisted usage rows/);
  assert.equal(ledger.health().ok, false);
});
