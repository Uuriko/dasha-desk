import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('./projects/dasha/project.json'));
const contribute = await read('./skills/contribute-to-dasha/SKILL.md');
const review = await read('./skills/review-dasha-contributions/SKILL.md');

assert.equal(manifest.schema, 'dasha-build-project/v1');
assert.equal(manifest.repository.owner, 'Uuriko');
assert.equal(manifest.repository.name, 'dasha-desk');
assert.equal(manifest.acceptance.writeMaster, 'github');
assert.equal(manifest.acceptance.maintainerFinalAuthority, true);
assert.equal(manifest.rewards.custody, false);
assert.equal(manifest.rewards.guaranteed, false);
assert.equal(manifest.safety.neverMoveFunds, true);
assert.match(manifest.provenance.inspiredBy, /SlopDotCash\/slopdotcash/);

assert.match(contribute, /GitHub maintainer acceptance is final/i);
assert.match(contribute, /never claim its own work is accepted/i);
assert.match(contribute, /never.*move, sign or custody funds/is);
assert.match(contribute, /canonical \$DASHA mint/i);

assert.match(review, /Maintainers remain final authority/i);
assert.match(review, /CHANGES_REQUIRED/);
assert.match(review, /Scores are integers from 0 to 5 and are diagnostic only/i);
assert.match(review, /Never move funds/i);

console.log('dasha-build-protocol: PASS');
