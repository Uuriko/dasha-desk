import { createHash } from 'node:crypto';

export const COMPUTE_ARCHIVE = '/dasha-compute-open-alpha.tar.gz';
export const COMPUTE_ARCHIVE_SHA = '/dasha-compute-open-alpha.tar.gz.sha256';
export const COMPUTE_RELEASE_JSON = '/compute/release.json';

export async function checkComputeRelease(bag, probe, { origin, fail }) {
  const archive = await probe(origin + COMPUTE_ARCHIVE, { redirect: 'follow' });
  fail(bag, archive.ok, `${COMPUTE_ARCHIVE}: missing provenance archive — HTTP ${archive.status || 0}`);
  if (!archive.ok) return;

  const bytes = new Uint8Array(await archive.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');

  const sum = await probe(origin + COMPUTE_ARCHIVE_SHA, { redirect: 'follow' });
  fail(bag, sum.ok, `${COMPUTE_ARCHIVE_SHA}: missing checksum — HTTP ${sum.status || 0}`);
  if (sum.ok) {
    const text = await sum.text();
    fail(bag, text.includes(digest), `${COMPUTE_ARCHIVE_SHA}: does not match the archive digest`);
  }

  const man = await probe(origin + COMPUTE_RELEASE_JSON, { redirect: 'follow' });
  fail(bag, man.ok, `${COMPUTE_RELEASE_JSON}: missing release manifest — HTTP ${man.status || 0}`);
  if (!man.ok) return;
  let data;
  try {
    data = JSON.parse(await man.text());
  } catch {
    fail(bag, false, `${COMPUTE_RELEASE_JSON}: not JSON`);
    return;
  }
  fail(bag, data && data.sha256 === digest, `${COMPUTE_RELEASE_JSON}: sha256 does not match the archive`);
  fail(bag, data && Number(data.bytes) === bytes.byteLength, `${COMPUTE_RELEASE_JSON}: bytes does not match the archive`);
}
