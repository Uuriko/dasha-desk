#!/usr/bin/env node
/**
 * Structural proof that public OSS entry docs stay contribution-ready.
 * Drives real files on disk (not hardcoded product copy beyond keywords).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

assert.ok(existsSync(join(root, 'README.md')), 'README.md missing');
assert.ok(existsSync(join(root, 'CONTRIBUTING.md')), 'CONTRIBUTING.md missing');
assert.ok(existsSync(join(root, 'LICENSE')), 'LICENSE missing');

const readme = read('README.md');
const contrib = read('CONTRIBUTING.md');
const roadmap = read('docs/ROADMAP.md');
const deploy = read('docs/DEPLOY.md');
const archive = read('docs/ARCHIVE.md');
const studio = read('studio/README.md');
const issueConfig = read('.github/ISSUE_TEMPLATE/config.yml');
const watch = read('watch.mjs');
const workflows = ['watch.yml', 'verify.yml', 'pages.yml'].map((name) => read(`.github/workflows/${name}`));
const dependabot = read('.github/dependabot.yml');

assert.match(readme, /contribute|community|pull request/i, 'README must invite contribution');
assert.match(readme, /open-source project|project contributor|open a pull request/i, 'README must frame OSS project contribution');
assert.match(readme, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'README must link GitHub /contribute');
assert.match(readme, /\$dasha|dasha/i, 'README must name the product');
assert.match(readme, /src\/body\.html|src\/app\.js|generated/i, 'README should point at sources or generated surfaces');
assert.match(readme, /getdasha\.com\/dasha/, 'README must link live desk');
assert.match(readme, /`\/desk` (goes to|redirects to) `\/dasha`/, 'README must say /desk goes to /dasha');
assert.match(readme, /getdasha\.com\/lobby/, 'README must link lobby');
assert.match(readme, /getdasha\.com\/privacy/, 'README must link privacy');
assert.match(readme, /getdasha\.com\/bounties/, 'README must link the bounties board');
assert.match(readme, /getdasha\.com\/#oss/, 'README must link site open-source section');
assert.match(readme, /desk-demo\.(gif|png)/, 'README must embed demo visual');
assert.match(readme, /Uploaded or\s+externally sourced images keep their own rights/i, 'README must bound Studio image rights');

assert.match(contrib, /issue|PR|pull request|fork/i, 'CONTRIBUTING must describe how to help');
assert.match(contrib, /open-source project contributor|not a payment/i, 'CONTRIBUTING must disambiguate from payment/bag');
assert.match(contrib, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'CONTRIBUTING must link /contribute');
assert.match(contrib, /getdasha\.com\/#oss/, 'CONTRIBUTING must link live #oss');

assert.match(roadmap, /## Resolved/i, 'ROADMAP must have honest Resolved section');
assert.ok(!/shipped from community|external contributors shipped/i.test(roadmap), 'ROADMAP must not invent community PR traction');
assert.match(deploy, /npm ci[\s\S]*npm test/, 'DEPLOY must run the complete public gate');
assert.doesNotMatch(archive, /\.\.\/\.\.\//, 'public docs must not link outside the repository');
assert.match(studio, /gallery fetches registered public images/i, 'Studio docs must disclose gallery networking');
assert.match(studio, /Uploaded and externally sourced photographs keep their own rights/i, 'Studio docs must bound CC0 for sourced images');
assert.ok(existsSync(join(root, 'studio/media.json')), 'Studio media manifest missing');

assert.match(issueConfig, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'issue chooser must link /contribute');
assert.match(issueConfig, /Start contributing/, 'issue chooser Start contributing contact');

// Demo asset for strangers (GIF or PNG)
assert.ok(
  existsSync(join(root, 'assets/desk-demo.gif')) || existsSync(join(root, 'assets/desk-demo.png')),
  'README demo visual missing (assets/desk-demo.gif|png)',
);

// Idea template path for community roadmap input
assert.ok(
  existsSync(join(root, '.github/ISSUE_TEMPLATE/idea.yml')) ||
    existsSync(join(root, 'docs/COMMUNITY.md')),
  'community idea path missing (issue template or COMMUNITY.md)',
);
assert.ok(existsSync(join(root, '.github/workflows/verify.yml')) || existsSync(join(root, '.github/workflows/pages.yml')), 'CI workflow missing');
assert.match(watch, /if \(route === '\/'\) warn\(ld\.length > 0/, 'watcher must require identity schema only on Home');

for (const workflow of workflows) {
  for (const line of workflow.match(/^\s*-?\s*uses:\s*.+$/gm) || []) {
    assert.match(line, /@[0-9a-f]{40}\s+#\s+v\d/, `workflow action must use a full commit SHA with a version comment: ${line.trim()}`);
  }
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}[^]*?persist-credentials: false/, 'checkout must not retain credentials');
}
for (const name of ['watch.yml', 'verify.yml']) {
  assert.match(read(`.github/workflows/${name}`), /^permissions:\n  contents: read$/m, `${name} must use a read-only token`);
}
assert.match(workflows[2], /^permissions:\n  contents: read\n  pages: write\n  id-token: write$/m, 'Pages must declare only its required deploy permissions');
for (const workflow of workflows.slice(1)) assert.match(workflow, /npm ci --ignore-scripts/, 'dependency install must disable lifecycle scripts');
assert.match(dependabot, /package-ecosystem: github-actions[\s\S]*interval: monthly/, 'Dependabot must maintain GitHub Actions monthly');
assert.match(dependabot, /package-ecosystem: npm[\s\S]*interval: monthly/, 'Dependabot must maintain npm monthly');

console.log('dasha-oss-docs: PASS');
