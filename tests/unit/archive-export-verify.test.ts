import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildStoredZip } from "../../app/domain/archive-export";
import { bytesSource, ExportVerifyError, verifyArchiveExport } from "../../app/domain/archive-export-verify";

const encoder = new TextEncoder(),
  sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const photo = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
  voice = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 9, 8]);

function exportZip(options: { tamper?: boolean; drop?: boolean; extra?: boolean; complete?: boolean } = {}) {
  const files = [
    { path: "memories/m/original_photograph/p.png", bytes: photo },
    { path: "memories/m/original_voice/v.webm", bytes: voice },
  ];
  const manifest = {
    format: "memoriesmystory-archive-export",
    formatVersion: 1,
    generatedAt: "2026-11-16T00:00:00.000Z",
    complete: options.complete ?? true,
    notIncluded: options.complete === false ? [{ code: "unfinished_memories", count: 2 }] : [],
    memories: [{ id: "m", files: files.map((file) => ({ path: file.path, sha256: sha(file.bytes), byteSize: file.bytes.length })) }],
    chapters: [],
    people: [],
  };
  const entries = [
    { path: "manifest.json", bytes: encoder.encode(JSON.stringify(manifest)) },
    { path: "index.html", bytes: encoder.encode("<!doctype html>") },
    ...files
      .filter((_, index) => !(options.drop && index === 1))
      .map((file, index) => ({
        path: file.path,
        bytes: options.tamper && index === 0 ? Uint8Array.from(file.bytes, (b, i) => (i === 6 ? b ^ 1 : b)) : file.bytes,
      })),
    ...(options.extra ? [{ path: "memories/m/added.txt", bytes: encoder.encode("not mine") }] : []),
  ];
  const parts = buildStoredZip(entries),
    out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

const code = async (bytes: Uint8Array) => {
  try {
    await verifyArchiveExport(bytesSource(bytes));
  } catch (error) {
    return error instanceof ExportVerifyError ? error.code : "other";
  }
  return "none";
};

describe("export verification on the device (A4)", () => {
  it("confirms a whole export file by file, with progress", async () => {
    const progress: number[] = [];
    const report = await verifyArchiveExport(bytesSource(exportZip()), (done) => progress.push(done));
    expect(report).toMatchObject({ allMatch: true, listed: 2, matched: 2, missing: [], differ: [], extra: [], exportSaysComplete: true });
    expect(progress).toEqual([0, 1, 2]);
  });

  it("names a changed file, a missing file and an added file", async () => {
    expect((await verifyArchiveExport(bytesSource(exportZip({ tamper: true })))).differ).toEqual([
      { path: "memories/m/original_photograph/p.png", reason: "content" },
    ]);
    const dropped = await verifyArchiveExport(bytesSource(exportZip({ drop: true })));
    expect(dropped.missing).toEqual(["memories/m/original_voice/v.webm"]);
    expect(dropped.allMatch).toBe(false);
    expect((await verifyArchiveExport(bytesSource(exportZip({ extra: true })))).extra).toEqual(["memories/m/added.txt"]);
  });

  it("carries the export's own statement that it was incomplete", async () => {
    const report = await verifyArchiveExport(bytesSource(exportZip({ complete: false })));
    expect(report.allMatch).toBe(true);
    expect(report.exportSaysComplete).toBe(false);
    expect(report.notIncluded).toEqual([{ code: "unfinished_memories", count: 2 }]);
  });

  it("refuses plainly what it cannot check", async () => {
    expect(await code(encoder.encode("plain text, not a zip at all........"))).toBe("archive_verify_not_zip");
    const compressed = exportZip();
    compressed[8] = 8; // the first local header now claims deflate
    expect(await code(compressed)).toBe("archive_verify_compressed");
    const noManifest = buildStoredZip([{ path: "x.txt", bytes: encoder.encode("x") }]);
    expect(await code(new Uint8Array(await new Blob(noManifest as BlobPart[]).arrayBuffer()))).toBe("archive_verify_no_manifest");
    const badManifest = buildStoredZip([{ path: "manifest.json", bytes: encoder.encode("{\"format\":\"other\"}") }]);
    expect(await code(new Uint8Array(await new Blob(badManifest as BlobPart[]).arrayBuffer()))).toBe("archive_verify_manifest_invalid");
    expect(await code(exportZip().subarray(0, 200))).not.toBe("none");
  });
});
