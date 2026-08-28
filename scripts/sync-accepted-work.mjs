import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../accepted-work/', import.meta.url);
const recordsDir = new URL('./records/', root);
const indexPath = new URL('./index.json', root);

async function loadRecords() {
  let names = [];
  try { names = await readdir(recordsDir); } catch { return []; }
  const out = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    const record = JSON.parse(await readFile(new URL(`./records/${name}`, root), 'utf8'));
    if (record.schema !== 'dasha-accepted-work/v1') throw new Error(`${name}: wrong schema`);
    if (record.project !== 'dasha') throw new Error(`${name}: wrong project`);
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(record.id || '')) throw new Error(`${name}: invalid id`);
    if (!/^https:\/\/github\.com\/Uuriko\/dasha-desk\/pull\/[0-9]+$/.test(record?.source?.pullRequest || '')) throw new Error(`${name}: invalid source PR`);
    if (!/^[0-9a-f]{40}$/.test(record?.source?.mergedHeadSha || '')) throw new Error(`${name}: invalid merged head SHA`);
    if (!record?.contributor?.githubLogin) throw new Error(`${name}: missing contributor`);
    if (!record.summary || typeof record.summary !== 'string') throw new Error(`${name}: missing summary`);
    if (!record?.reward?.state) throw new Error(`${name}: missing reward state`);
    out.push(record);
  }
  return out;
}

function buildIndex(records) {
  const ids = new Set();
  const prs = new Set();
  for (const r of records) {
    if (ids.has(r.id)) throw new Error(`duplicate id: ${r.id}`);
    if (prs.has(r.source.pullRequest)) throw new Error(`duplicate source PR: ${r.source.pullRequest}`);
    ids.add(r.id);
    prs.add(r.source.pullRequest);
  }
  const sorted = [...records].sort((a, b) => String(a.acceptedAt).localeCompare(String(b.acceptedAt)) || a.id.localeCompare(b.id));
  return { schema: 'dasha-accepted-work-index/v1', records: sorted };
}

const expected = JSON.stringify(buildIndex(await loadRecords()), null, 2) + '\n';
if (process.argv.includes('--check')) {
  const current = await readFile(indexPath, 'utf8');
  if (current !== expected) {
    console.error('accepted-work/index.json is stale; run node scripts/sync-accepted-work.mjs');
    process.exit(1);
  }
  console.log('accepted-work index: PASS');
} else {
  await writeFile(indexPath, expected);
  console.log('accepted-work index: wrote');
}
