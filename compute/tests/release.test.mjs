import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import {
  ARCHIVE_NAME,
  ARCHIVE_ROOT,
  EXECUTABLE_FILES,
  GENERATED_MANIFEST,
  ROOT,
  buildRelease,
  loadReleaseFiles,
} from "../scripts/build-release.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sourceFiles(directory = ROOT, prefix = "") {
  const ignored = new Set(["dist", "node_modules", ".next", "coverage", ".DS_Store"]);
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await sourceFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) found.push(relative);
  }
  return found.sort();
}

function readString(buffer, offset, length) {
  return buffer.subarray(offset, offset + length).toString("utf8").replace(/\0.*$/s, "");
}

function readOctal(buffer, offset, length) {
  return Number.parseInt(readString(buffer, offset, length).trim() || "0", 8);
}

function parseTar(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readString(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const contentStart = offset + 512;
    entries.push({
      content: buffer.subarray(contentStart, contentStart + size),
      gid: readOctal(header, 116, 8),
      mode: readOctal(header, 100, 8),
      mtime: readOctal(header, 136, 12),
      name,
      uid: readOctal(header, 108, 8),
    });
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  assert.ok(buffer.subarray(offset).length >= 1024, "tar must end with two empty blocks");
  assert.ok(buffer.subarray(offset).every((byte) => byte === 0), "tar trailer must be zero-filled");
  return entries;
}

test("release allowlist covers every repository source file", async () => {
  const manifest = await loadReleaseFiles();
  assert.deepEqual(manifest, await sourceFiles());
  assert.ok(manifest.includes("README.md"));
  assert.ok(manifest.includes("SECURITY.md"));
  assert.ok(manifest.includes("THREAT_MODEL.md"));
  assert.ok(manifest.includes("provider/agent.py"));
  assert.ok(manifest.includes("tests/e2e.test.mjs"));
});

test("two clean builds produce identical archives, checksums and normalized entries", async (context) => {
  const first = await mkdtemp(path.join(tmpdir(), "dasha-compute-release-a-"));
  const second = await mkdtemp(path.join(tmpdir(), "dasha-compute-release-b-"));
  context.after(() => Promise.all([rm(first, { recursive: true, force: true }), rm(second, { recursive: true, force: true })]));
  const firstResult = await buildRelease({ outDir: first });
  const secondResult = await buildRelease({ outDir: second });
  const firstArchive = await readFile(path.join(first, ARCHIVE_NAME));
  const secondArchive = await readFile(path.join(second, ARCHIVE_NAME));
  assert.deepEqual(firstArchive, secondArchive);
  assert.equal(firstResult.sha256, secondResult.sha256);
  assert.equal(firstResult.sha256, sha256(firstArchive));

  const checksum = await readFile(path.join(first, `${ARCHIVE_NAME}.sha256`), "utf8");
  assert.equal(checksum, `${sha256(firstArchive)}  ${ARCHIVE_NAME}\n`);
  const release = JSON.parse(await readFile(path.join(first, "release.json"), "utf8"));
  assert.deepEqual(release, {
    artifact: ARCHIVE_NAME,
    bytes: firstArchive.length,
    sha256: sha256(firstArchive),
    sourceFileCount: firstResult.files.length,
    version: "0.3.0",
  });

  const entries = parseTar(gunzipSync(firstArchive));
  const expectedNames = [
    ...firstResult.files.map((file) => `${ARCHIVE_ROOT}/${file}`),
    `${ARCHIVE_ROOT}/${GENERATED_MANIFEST}`,
  ].sort();
  assert.deepEqual(entries.map(({ name }) => name), expectedNames);
  for (const entry of entries) {
    assert.equal(entry.uid, 0);
    assert.equal(entry.gid, 0);
    assert.equal(entry.mtime, 0);
    assert.ok(entry.name.startsWith(`${ARCHIVE_ROOT}/`));
    assert.ok(!entry.name.includes("../"));
    const relative = entry.name.slice(ARCHIVE_ROOT.length + 1);
    assert.equal(entry.mode, EXECUTABLE_FILES.has(relative) ? 0o755 : 0o644);
    if (relative !== GENERATED_MANIFEST) assert.deepEqual(entry.content, await readFile(path.join(ROOT, relative)));
  }

  const embedded = entries.find(({ name }) => name.endsWith(`/${GENERATED_MANIFEST}`));
  const expectedManifest = (await Promise.all(firstResult.files.map(async (file) => `${sha256(await readFile(path.join(ROOT, file)))}  ${file}\n`))).join("");
  assert.equal(embedded.content.toString("utf8"), expectedManifest);
});
