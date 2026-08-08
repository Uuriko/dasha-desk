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
const issueConfig = read('.github/ISSUE_TEMPLATE/config.yml');

assert.match(readme, /contribute|community|pull request/i, 'README must invite contribution');
assert.match(readme, /open-source project|project contributor|open a pull request/i, 'README must frame OSS project contribution');
assert.match(readme, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'README must link GitHub /contribute');
assert.match(readme, /\$dasha|dasha/i, 'README must name the product');
assert.match(readme, /src\/body\.html|src\/app\.js|generated/i, 'README should point at sources or generated surfaces');
assert.match(readme, /getdasha\.com\/dasha/, 'README must link live desk');
assert.match(readme, /getdasha\.com\/#oss/, 'README must link site open-source section');
assert.match(readme, /desk-demo\.(gif|png)/, 'README must embed demo visual');

assert.match(contrib, /issue|PR|pull request|fork/i, 'CONTRIBUTING must describe how to help');
assert.match(contrib, /open-source project contributor|not a payment/i, 'CONTRIBUTING must disambiguate from payment/bag');
assert.match(contrib, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'CONTRIBUTING must link /contribute');
assert.match(contrib, /getdasha\.com\/#oss/, 'CONTRIBUTING must link live #oss');

assert.match(roadmap, /## Resolved/i, 'ROADMAP must have honest Resolved section');
assert.ok(!/shipped from community|external contributors shipped/i.test(roadmap), 'ROADMAP must not invent community PR traction');

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

console.log('dasha-oss-docs: PASS');
