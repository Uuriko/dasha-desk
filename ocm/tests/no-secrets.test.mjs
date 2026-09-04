/**
 * Guards what a public repository would actually publish.
 *
 * `.gitignore` only stops files being added; it does nothing about a secret written
 * INSIDE a committed file, and a one-time cleanup decays. This scans exactly the set
 * of files git would publish — tracked plus untracked-and-not-ignored — so the check
 * follows the ignore rules automatically rather than duplicating them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'tests/no-secrets.test.mjs';

function publishableFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).filter((f) => f !== SELF);
}

// Patterns are assembled from fragments so this file does not trip its own scan.
const RULES = [
  { name: 'AWS account id', re: new RegExp(String.raw`\b\d{12}\b`) },
  { name: 'AWS access key id', re: new RegExp('AKIA' + String.raw`[0-9A-Z]{16}`) },
  { name: 'AWS resource id', re: new RegExp(String.raw`\b(?:i|h|sg|subnet|vpc|vol|snap|ami)-[0-9a-f]{8,17}\b`) },
  { name: 'private key block', re: new RegExp('-----BEGIN [A-Z ]*PRIVATE ' + 'KEY-----') },
  { name: 'issued OCM credential', re: new RegExp('ocm_' + String.raw`(?:live|host|admin)_[A-Za-z0-9_\-]{16,}`) },
  { name: 'database URL with password', re: new RegExp(String.raw`postgres(?:ql)?://[^\s:]+:[^\s@]+@`) },
  { name: 'RDS endpoint', re: new RegExp(String.raw`[a-z0-9-]+\.[a-z0-9]+\.[a-z0-9-]+\.rds\.amazonaws\.com`) },
  { name: 'ELB endpoint', re: new RegExp(String.raw`[a-z0-9-]+-\d+\.[a-z0-9-]+\.elb\.amazonaws\.com`) },
];

// Placeholders that are obviously not real.
const ALLOW = [
  /\b0{12}\b/, /\bi-0{8,}\b/, /\bh-0{8,}\b/, /example\.com/,
  // Strings that announce themselves as fake, used by the auth-rejection tests.
  /not_a_real/, /_fake_/, /placeholder/,
];

test('no file git would publish contains a secret or a deployment identifier', () => {
  const findings = [];
  for (const file of publishableFiles()) {
    const path = join(ROOT, file);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (!stat.isFile() || stat.size > 2_000_000) continue;
    const text = readFileSync(path, 'utf8');
    for (const { name, re } of RULES) {
      for (const line of text.split('\n')) {
        const m = line.match(re);
        if (!m) continue;
        if (ALLOW.some((a) => a.test(m[0]))) continue;
        findings.push(`${relative(ROOT, path)}: ${name} → ${m[0].slice(0, 40)}`);
      }
    }
  }
  assert.deepEqual(findings, [],
    `these would be published:\n  ${findings.join('\n  ')}`);
});

test('the public provider protocol stays published', () => {
  const published = new Set(publishableFiles());
  assert.equal(published.has('docs/PROVIDER-PROTOCOL.md'), true,
    'PROVIDER-PROTOCOL.md must remain tracked; docs/ is otherwise ignored');
});

test('files that must never be published are ignored', () => {
  const published = new Set(publishableFiles());
  const mustNotPublish = [
    '.env', '.envrc', '.envrc.local', '.deploy.env', '.data/usage.jsonl',
    'docs/STATE.md', 'docs/AWS-ACCOUNT.md', 'docs/DNS.md',
    'secret.pem', 'accessKeys.csv', 'shots/aws.png',
  ];
  for (const f of mustNotPublish) {
    assert.equal(published.has(f), false, `${f} would be published — check .gitignore`);
  }
});

test('the ignore rules actually cover the dangerous shapes', () => {
  // Ask git directly rather than trusting a reading of the patterns.
  //
  // `git check-ignore` exits 0 whenever a pattern MATCHES — including a negation.
  // Using the exit status alone reports "!README.md" as ignored, which is the exact
  // opposite of the truth. Parse -v and look at the pattern itself.
  const probe = (p) => {
    let out;
    try {
      out = execFileSync('git', ['check-ignore', '-v', '--', p],
        { cwd: ROOT, encoding: 'utf8' });
    } catch (err) {
      out = err.stdout || '';
    }
    const line = out.split('\n').find(Boolean);
    if (!line) return false;                       // no pattern matched at all
    const pattern = line.split('\t')[0].split(':').slice(2).join(':');
    return !pattern.startsWith('!');               // a negation means NOT ignored
  };
  for (const p of ['.env', '.env.local', '.envrc', '.envrc.local', 'x.pem', 'x.key',
                   'creds.csv', 'a/b/.data/x.jsonl', 'terraform.tfstate', 'shots/x.png',
                   'notes.md', 'docs/anything.md', 'node_modules/x',
                   'x.tar.gz', '.aws/config', 'id_rsa', 'coverage/x']) {
    assert.equal(probe(p), true, `${p} is NOT ignored but should be`);
  }
  // And that it is not so broad it swallows the actual source.
  for (const p of ['gateway/server.mjs', 'agent/agent.py', 'package.json',
                   'agent/install.sh', 'README.md', '.env.example', '.envrc.example']) {
    assert.equal(probe(p), false, `${p} is ignored but must be published`);
  }
});
