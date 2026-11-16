/**
 * Export verification, read entirely on the person's own device.
 *
 * Reads a ZIP made by `buildStoredZip` (stored, uncompressed entries only),
 * re-hashes every file with SHA-256 and compares it with the `manifest.json`
 * inside the same ZIP. Nothing is uploaded and nothing is changed.
 *
 * What this proves: the files you hold are the files the export listed. It
 * cannot prove the manifest itself was not rewritten together with a file;
 * the manifest is plain JSON without a signature (format version 1).
 */
import { archiveExportFormat, archiveExportVersion } from "./archive-export";

/** Codes a person sees as plain wording; see the continuity copy catalog. */
export type ExportVerifyErrorCode =
  | "archive_verify_not_zip"
  | "archive_verify_compressed"
  | "archive_verify_encrypted"
  | "archive_verify_unsupported"
  | "archive_verify_damaged"
  | "archive_verify_no_manifest"
  | "archive_verify_manifest_invalid";

export class ExportVerifyError extends Error {
  constructor(readonly code: ExportVerifyErrorCode) {
    super(code);
    this.name = "ExportVerifyError";
  }
}

export const exportVerifyLimits = {
  /** The manifest of a 500-memory export is far below this. */
  maximumManifestBytes: 64 * 1024 * 1024,
  maximumCentralDirectoryBytes: 64 * 1024 * 1024,
} as const;

/** Random access to the ZIP without reading all of it into memory at once. */
export type ZipSource = {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
};

export const bytesSource = (bytes: Uint8Array): ZipSource => ({
  size: bytes.byteLength,
  read: async (offset, length) => bytes.subarray(offset, offset + length),
});

export const blobSource = (blob: Blob): ZipSource => ({
  size: blob.size,
  read: async (offset, length) =>
    new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer()),
});

export type StoredZipEntry = {
  path: string;
  /** Offset of the entry's bytes (after its local header). */
  dataOffset: number;
  size: number;
  crc32: number;
};

const endSignature = 0x06054b50,
  centralSignature = 0x02014b50,
  localSignature = 0x04034b50;

const fail = (code: ExportVerifyErrorCode): never => {
  throw new ExportVerifyError(code);
};

/** Reads the central directory of a stored-only ZIP. Refuses anything else plainly. */
export async function readStoredZipDirectory(
  source: ZipSource,
): Promise<StoredZipEntry[]> {
  if (source.size < 22) fail("archive_verify_not_zip");
  const first = await source.read(0, 4);
  const firstWord = new DataView(first.buffer, first.byteOffset, first.byteLength).getUint32(0, true);
  if (firstWord !== localSignature && firstWord !== endSignature)
    fail("archive_verify_not_zip");
  // The end record is 22 bytes plus an optional comment of up to 65,535 bytes.
  const tailLength = Math.min(source.size, 22 + 0xffff),
    tailStart = source.size - tailLength,
    tail = await source.read(tailStart, tailLength),
    tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let end = -1;
  for (let at = tail.byteLength - 22; at >= 0; at--)
    if (
      tailView.getUint32(at, true) === endSignature &&
      at + 22 + tailView.getUint16(at + 20, true) === tail.byteLength
    ) {
      end = at;
      break;
    }
  if (end < 0) fail("archive_verify_not_zip");
  const disk = tailView.getUint16(end + 4, true),
    centralDisk = tailView.getUint16(end + 6, true),
    count = tailView.getUint16(end + 10, true),
    centralSize = tailView.getUint32(end + 12, true),
    centralOffset = tailView.getUint32(end + 16, true);
  if (disk !== 0 || centralDisk !== 0) fail("archive_verify_unsupported");
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff)
    fail("archive_verify_unsupported"); // ZIP64 is never written by this app
  if (centralSize > exportVerifyLimits.maximumCentralDirectoryBytes)
    fail("archive_verify_unsupported");
  if (centralOffset + centralSize > tailStart + end) fail("archive_verify_damaged");
  const central = await source.read(centralOffset, centralSize),
    view = new DataView(central.buffer, central.byteOffset, central.byteLength),
    decoder = new TextDecoder("utf-8", { fatal: true }),
    entries: StoredZipEntry[] = [];
  let cursor = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > central.byteLength || view.getUint32(cursor, true) !== centralSignature)
      fail("archive_verify_damaged");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      crc = view.getUint32(cursor + 16, true),
      compressedSize = view.getUint32(cursor + 20, true),
      size = view.getUint32(cursor + 24, true),
      nameLength = view.getUint16(cursor + 28, true),
      extraLength = view.getUint16(cursor + 30, true),
      commentLength = view.getUint16(cursor + 32, true),
      localOffset = view.getUint32(cursor + 42, true);
    if (flags & 0x0001) fail("archive_verify_encrypted");
    if (method !== 0) fail("archive_verify_compressed");
    if (size === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff)
      fail("archive_verify_unsupported");
    if (compressedSize !== size) fail("archive_verify_damaged");
    if (cursor + 46 + nameLength > central.byteLength) fail("archive_verify_damaged");
    let path = "";
    try {
      path = decoder.decode(central.subarray(cursor + 46, cursor + 46 + nameLength));
    } catch {
      fail("archive_verify_damaged");
    }
    if (localOffset + 30 > source.size) fail("archive_verify_damaged");
    const local = await source.read(localOffset, 30),
      localView = new DataView(local.buffer, local.byteOffset, local.byteLength);
    if (localView.getUint32(0, true) !== localSignature) fail("archive_verify_damaged");
    if (localView.getUint16(8, true) !== 0) fail("archive_verify_compressed");
    const dataOffset =
      localOffset + 30 + localView.getUint16(26, true) + localView.getUint16(28, true);
    if (dataOffset + size > source.size) fail("archive_verify_damaged");
    entries.push({ path, dataOffset, size, crc32: crc });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function readStoredEntry(source: ZipSource, entry: StoredZipEntry) {
  return source.read(entry.dataOffset, entry.size);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer: subtle.digest refuses some shared views.
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type ExportVerificationReport = {
  generatedAt: string | null;
  /** The export's own statement: false when it said something was left out. */
  exportSaysComplete: boolean;
  notIncluded: { code: string; count: number | null }[];
  /** Number of files the manifest lists. */
  listed: number;
  matched: number;
  missing: string[];
  differ: { path: string; reason: "content" | "size" }[];
  /** Files in the ZIP that the manifest does not list (or listed twice). */
  extra: string[];
  /** Every listed file is present and matches, and nothing unlisted was added. */
  allMatch: boolean;
};

type ListedFile = { path: string; sha256: string; byteSize: number };

function listedFiles(manifest: unknown): {
  files: ListedFile[];
  generatedAt: string | null;
  complete: boolean;
  notIncluded: ExportVerificationReport["notIncluded"];
} {
  const value = manifest as {
    format?: unknown;
    formatVersion?: unknown;
    generatedAt?: unknown;
    complete?: unknown;
    notIncluded?: unknown;
    memories?: unknown;
  } | null;
  if (
    !value ||
    typeof value !== "object" ||
    value.format !== archiveExportFormat ||
    value.formatVersion !== archiveExportVersion ||
    !Array.isArray(value.memories)
  )
    fail("archive_verify_manifest_invalid");
  const files: ListedFile[] = [];
  for (const memory of value!.memories as unknown[]) {
    const memoryFiles = (memory as { files?: unknown } | null)?.files;
    if (!Array.isArray(memoryFiles)) fail("archive_verify_manifest_invalid");
    for (const file of memoryFiles as unknown[]) {
      const entry = file as Partial<ListedFile> | null;
      if (
        !entry ||
        typeof entry.path !== "string" ||
        !entry.path ||
        typeof entry.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        typeof entry.byteSize !== "number" ||
        !Number.isSafeInteger(entry.byteSize) ||
        entry.byteSize < 0
      )
        fail("archive_verify_manifest_invalid");
      files.push({ path: entry!.path!, sha256: entry!.sha256!, byteSize: entry!.byteSize! });
    }
  }
  const notIncluded = Array.isArray(value!.notIncluded)
    ? (value!.notIncluded as unknown[])
        .filter(
          (item): item is { code: string; count: unknown } =>
            !!item && typeof (item as { code?: unknown }).code === "string",
        )
        .map((item) => ({
          code: item.code,
          count: typeof item.count === "number" ? item.count : null,
        }))
    : [];
  return {
    files,
    generatedAt: typeof value!.generatedAt === "string" ? value!.generatedAt : null,
    complete: value!.complete === true,
    notIncluded,
  };
}

/** Files the export writes beside the originals; they are not listed with a hash. */
const exportFrame = new Set(["manifest.json", "index.html"]);

/**
 * Checks every file the manifest lists. Reads one file at a time, so memory use
 * follows the largest single file rather than the whole archive.
 */
export async function verifyArchiveExport(
  source: ZipSource,
  onProgress?: (done: number, total: number) => void,
): Promise<ExportVerificationReport> {
  const entries = await readStoredZipDirectory(source),
    byPath = new Map<string, StoredZipEntry>(),
    extra: string[] = [];
  for (const entry of entries) {
    if (entry.path.endsWith("/") && entry.size === 0) continue; // a folder entry
    if (byPath.has(entry.path)) extra.push(entry.path);
    else byPath.set(entry.path, entry);
  }
  const manifestEntry = byPath.get("manifest.json");
  if (!manifestEntry) fail("archive_verify_no_manifest");
  if (manifestEntry!.size > exportVerifyLimits.maximumManifestBytes)
    fail("archive_verify_manifest_invalid");
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readStoredEntry(source, manifestEntry!),
      ),
    );
  } catch {
    fail("archive_verify_manifest_invalid");
  }
  const manifest = listedFiles(parsed),
    listed = new Set<string>(),
    missing: string[] = [],
    differ: ExportVerificationReport["differ"] = [];
  let matched = 0,
    done = 0;
  onProgress?.(0, manifest.files.length);
  for (const file of manifest.files) {
    if (listed.has(file.path)) {
      done++;
      continue; // listed twice: checked once
    }
    listed.add(file.path);
    const entry = byPath.get(file.path);
    if (!entry) missing.push(file.path);
    else if (entry.size !== file.byteSize) differ.push({ path: file.path, reason: "size" });
    else if ((await sha256Hex(await readStoredEntry(source, entry))) !== file.sha256)
      differ.push({ path: file.path, reason: "content" });
    else matched++;
    onProgress?.(++done, manifest.files.length);
  }
  for (const path of byPath.keys())
    if (!listed.has(path) && !exportFrame.has(path)) extra.push(path);
  return {
    generatedAt: manifest.generatedAt,
    exportSaysComplete: manifest.complete,
    notIncluded: manifest.notIncluded,
    listed: listed.size,
    matched,
    missing,
    differ,
    extra,
    allMatch: missing.length === 0 && differ.length === 0 && extra.length === 0,
  };
}
