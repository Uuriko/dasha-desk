#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ARCHIVE_ROOT = "dasha-compute-open-alpha";
export const ARCHIVE_NAME = `${ARCHIVE_ROOT}.tar.gz`;
export const GENERATED_MANIFEST = "SOURCE-MANIFEST.sha256";
export const EXECUTABLE_FILES = new Set([
  "install.sh",
  "provider/dasha-compute",
  "provider/run-provider",
  "scripts/build-release.mjs",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeString(buffer, value, offset, length) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`tar field is too long: ${value}`);
  bytes.copy(buffer, offset);
}

function writeOctal(buffer, value, offset, length) {
  const encoded = `${value.toString(8).padStart(length - 1, "0")}\0`;
  if (encoded.length !== length) throw new Error(`tar number does not fit: ${value}`);
  writeString(buffer, encoded, offset, length);
}

function tarHeader(name, size, mode) {
  const header = Buffer.alloc(512);
  writeString(header, name, 0, 100);
  writeOctal(header, mode, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, 0, 136, 12);
  writeString(header, "        ", 148, 8);
  writeString(header, "0", 156, 1);
  writeString(header, "ustar\0", 257, 6);
  writeString(header, "00", 263, 2);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(header, `${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return header;
}

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function deterministicGzip(value) {
  const chunks = [Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff])];
  for (let offset = 0; offset < value.length || offset === 0; offset += 0xffff) {
    const length = Math.min(0xffff, value.length - offset);
    const block = Buffer.alloc(5);
    block[0] = offset + length >= value.length ? 0x01 : 0x00;
    block.writeUInt16LE(length, 1);
    block.writeUInt16LE((~length) & 0xffff, 3);
    chunks.push(block, value.subarray(offset, offset + length));
    if (offset + length >= value.length) break;
  }
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(value), 0);
  trailer.writeUInt32LE(value.length >>> 0, 4);
  chunks.push(trailer);
  return Buffer.concat(chunks);
}

function validateRelative(file) {
  if (typeof file !== "string" || !file || file.includes("\\")) throw new Error(`invalid release path: ${file}`);
  if (path.posix.isAbsolute(file) || path.posix.normalize(file) !== file || file.startsWith("../")) {
    throw new Error(`release path escapes its root: ${file}`);
  }
  if (file === ".env" || (path.posix.basename(file).startsWith(".env.") && file !== ".env.example")) {
    throw new Error(`secret-bearing environment file is not releasable: ${file}`);
  }
}

export async function loadReleaseFiles(root = ROOT) {
  const manifest = JSON.parse(await readFile(path.join(root, "release-files.json"), "utf8"));
  if (!Array.isArray(manifest) || manifest.length === 0) throw new Error("release-files.json must be a non-empty array");
  const sorted = [...manifest].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(manifest)) throw new Error("release-files.json must remain sorted");
  if (new Set(manifest).size !== manifest.length) throw new Error("release-files.json contains duplicates");
  for (const file of manifest) {
    validateRelative(file);
    const stat = await lstat(path.join(root, file));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`release entry must be a regular file: ${file}`);
  }
  return manifest;
}

export async function buildRelease({ root = ROOT, outDir = path.join(ROOT, "dist") } = {}) {
  const files = await loadReleaseFiles(root);
  const sourceEntries = await Promise.all(files.map(async (file) => {
    const content = await readFile(path.join(root, file));
    return { file, content, sha256: sha256(content), mode: EXECUTABLE_FILES.has(file) ? 0o755 : 0o644 };
  }));
  const sourceManifest = Buffer.from(sourceEntries.map(({ file, sha256: digest }) => `${digest}  ${file}\n`).join(""));
  const entries = [
    ...sourceEntries.map(({ file, content, mode }) => ({ name: `${ARCHIVE_ROOT}/${file}`, content, mode })),
    { name: `${ARCHIVE_ROOT}/${GENERATED_MANIFEST}`, content: sourceManifest, mode: 0o644 },
  ].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

  const tar = [];
  for (const entry of entries) {
    tar.push(tarHeader(entry.name, entry.content.length, entry.mode), entry.content);
    const remainder = entry.content.length % 512;
    if (remainder) tar.push(Buffer.alloc(512 - remainder));
  }
  tar.push(Buffer.alloc(1024));
  const archive = deterministicGzip(Buffer.concat(tar));
  const archiveDigest = sha256(archive);
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const release = {
    artifact: ARCHIVE_NAME,
    bytes: archive.length,
    sha256: archiveDigest,
    sourceFileCount: files.length,
    version: packageJson.version,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, ARCHIVE_NAME), archive);
  await writeFile(path.join(outDir, `${ARCHIVE_NAME}.sha256`), `${archiveDigest}  ${ARCHIVE_NAME}\n`);
  await writeFile(path.join(outDir, "release.json"), `${JSON.stringify(release, null, 2)}\n`);
  return { ...release, files, outDir };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildRelease();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
