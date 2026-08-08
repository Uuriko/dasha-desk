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

assert.match(readme, /contribute|community|pull request/i, 'README must invite contribution');
assert.match(readme, /\$dasha|dasha/i, 'README must name the product');
assert.match(contrib, /issue|PR|pull request|fork/i, 'CONTRIBUTING must describe how to help');
assert.match(readme, /src\/body\.html|src\/app\.js|generated/i, 'README should point at sources or generated surfaces');

// Idea template path for community roadmap input
assert.ok(
  existsSync(join(root, '.github/ISSUE_TEMPLATE/idea.yml')) ||
    existsSync(join(root, 'docs/COMMUNITY.md')),
  'community idea path missing (issue template or COMMUNITY.md)',
);

console.log('dasha-oss-docs: PASS');
