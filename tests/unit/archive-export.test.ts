import { crc32 as nodeCrc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  buildStoredZip,
  crc32,
  renderExportIndex,
  type ArchiveExportManifest,
} from "../../app/domain/archive-export";

function join(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
/** A minimal independent reader: central directory, then each stored entry. */
export function readStoredZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength),
    end = zip.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    expect(view.getUint16(cursor + 10, true)).toBe(0); // stored, not compressed
    const crc = view.getUint32(cursor + 16, true),
      size = view.getUint32(cursor + 24, true),
      nameLength = view.getUint16(cursor + 28, true),
      local = view.getUint32(cursor + 42, true),
      name = new TextDecoder().decode(zip.subarray(cursor + 46, cursor + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true),
      bytes = zip.subarray(start, start + size);
    expect(nodeCrc32(bytes)).toBe(crc);
    files.set(name, bytes);
    cursor += 46 + nameLength;
  }
  return files;
}

describe("portable archive export format", () => {
  it("computes the standard CRC-32", () => {
    const bytes = new TextEncoder().encode("Abuela's kitchen — la cocina de la tía María");
    expect(crc32(bytes)).toBe(nodeCrc32(bytes));
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("stores every file byte-for-byte under its UTF-8 path", () => {
    const original = Uint8Array.from({ length: 5000 }, (_, i) => (i * 31) % 256),
      entries = [
        { path: "manifest.json", bytes: new TextEncoder().encode('{"a":1}') },
        { path: "memories/recuerdo_ñ/original_voice/voz.webm", bytes: original },
        { path: "empty.bin", bytes: new Uint8Array() },
      ],
      files = readStoredZip(join(buildStoredZip(entries)));
    expect([...files.keys()]).toEqual(entries.map((entry) => entry.path));
    expect([...files.get("memories/recuerdo_ñ/original_voice/voz.webm")!]).toEqual([...original]);
    expect(new TextDecoder().decode(files.get("manifest.json")!)).toBe('{"a":1}');
  });

  it("renders a readable index that escapes people's words and never hides an incomplete export", () => {
    const manifest: ArchiveExportManifest = {
      format: "memoriesmystory-archive-export",
      formatVersion: 1,
      generatedAt: "2026-11-15T00:00:00.000Z",
      complete: false,
      notIncluded: [{ code: "shared_conversation_recordings", count: 2 }],
      chapters: [],
      people: [],
      memories: [
        {
          id: "memory_one",
          title: "<script>alert(1)</script> & Abuela",
          completedAt: null,
          files: [
            { path: "memories/memory_one/original_voice/a.webm", kind: "asset", id: "a", role: "original_voice", original: true, derivedFromId: null, contentType: "audio/webm", byteSize: 4, sha256: "f".repeat(64), durationMs: 1000, attribution: null, createdAt: "" },
          ],
          transcripts: [{ id: "t", kind: "machine_transcript", writtenBy: "machine", current: true, previousId: null, locale: "es-PR", text: "Yo <recuerdo>", createdAt: "" }],
          storytellerContext: [{ kind: "time", state: "approximate", value: "1950", current: true, createdAt: "" }],
          museConversation: [],
          voiceReplies: [],
          familyContributions: [{ id: "c", attribution: "Prima \"Lucía\"", byOwner: false, kind: "human_text", includedForFamily: false, fileId: null, writtenVersions: [{ id: "r", text: "Era <domingo>", createdAt: "" }], speakerWrittenWords: [], createdAt: "" }],
        },
      ],
    };
    const html = renderExportIndex(
      manifest,
      { verifiedAt: "", allFilesVerified: false, files: [{ path: "memories/memory_one/original_voice/a.webm", sha256: "f".repeat(64), verified: false }] },
      (key) => key,
      "en-US",
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; Abuela");
    expect(html).toContain("Yo &lt;recuerdo&gt;");
    expect(html).toContain("Prima &quot;Lucía&quot;");
    expect(html).toContain("This export is not complete. Read what is missing below.");
    expect(html).toContain("export not included: shared_conversation_recordings (2)");
    expect(html).toContain("Not checked: this file is missing or did not match");
    // A machine transcript is labelled as such, never presented as reviewed testimony.
    expect(html).toContain("machine transcript, not reviewed by a person");
    expect(html).toContain("(approximately)");
  });
});
