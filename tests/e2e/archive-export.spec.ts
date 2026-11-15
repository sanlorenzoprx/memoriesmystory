import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { crc32 } from "node:zlib";
import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { ArchiveExportFile, ArchiveExportManifest } from "../../app/domain/archive-export";

// Synthetic UI evidence with stubbed routes and synthetic bytes. It proves the
// device re-checks every file and that the saved ZIP round-trips; ownership and
// real hashes are proven against the Worker in the integration suite.
function unzip(zip: Buffer) {
  const end = zip.length - 22,
    files = new Map<string, Buffer>();
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  let cursor = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const size = zip.readUInt32LE(cursor + 24),
      nameLength = zip.readUInt16LE(cursor + 28),
      local = zip.readUInt32LE(cursor + 42),
      name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"),
      start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28),
      bytes = zip.subarray(start, start + size);
    expect(crc32(bytes)).toBe(zip.readUInt32LE(cursor + 16));
    files.set(name, bytes);
    cursor += 46 + nameLength;
  }
  return files;
}
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: the export packages only files that match the preserved originals and says plainly when it is incomplete`, async ({
    page,
  }) => {
    const copy = (key: string, values?: Record<string, string | number>) =>
      translate(key, locale, values);
    const photo = readFileSync(new URL("../fixtures/synthetic-family-photo.png", import.meta.url)),
      voice = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8]);
    const file = (id: string, role: ArchiveExportFile["role"], bytes: Buffer, contentType: string, extension: string): ArchiveExportFile => ({
      path: `memories/memory_export_ui/${role}/${id}.${extension}`,
      kind: "asset", id, role, original: true, derivedFromId: null, contentType,
      byteSize: bytes.length, sha256: sha(bytes), durationMs: null, attribution: null, createdAt: "2026-11-15T00:00:00Z",
    });
    const files = [file("asset_export_photo", "original_photograph", photo, "image/png", "png"), file("asset_export_voice", "original_voice", voice, "audio/webm", "webm")];
    const manifest: ArchiveExportManifest = {
      format: "memoriesmystory-archive-export",
      formatVersion: 1,
      generatedAt: "2026-11-15T12:00:00.000Z",
      complete: true,
      notIncluded: [],
      chapters: [],
      people: [],
      memories: [{
        id: "memory_export_ui", title: "La cocina de la tía María", completedAt: "2026-11-15T00:00:00Z", files,
        transcripts: [], storytellerContext: [], museConversation: [], voiceReplies: [], familyContributions: [],
      }],
    };
    let corruptVoice = true;
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({ json: { drafts: [{ id: "memory_export_ui", status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] } }),
    );
    await page.route("**/resources/family-archives**", (route) => route.fulfill({ json: { archives: [], nextCursor: null } }));
    await page.route("**/resources/archive-export/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/manifest")) return route.fulfill({ json: manifest });
      if (path.endsWith("/asset_export_photo")) return route.fulfill({ status: 200, contentType: "image/png", body: photo });
      // First attempt: same length, different bytes — as if storage returned the wrong object.
      return route.fulfill({ status: 200, contentType: "audio/webm", body: corruptVoice ? Buffer.from(voice).fill(0, 4) : voice });
    });
    await page.goto("/archive");
    await page.getByText(copy("Export my archive"), { exact: true }).click();

    async function exportOnce(buttonKey: string) {
      await page.getByRole("button", { name: copy(buttonKey), exact: true }).click();
      const link = page.getByRole("link", { name: copy("Save the export to this device"), exact: true });
      await expect(link).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
      expect(download.suggestedFilename()).toBe("family-archive-export-2026-11-15.zip");
      return unzip(readFileSync(await download.path()));
    }

    const partial = await exportOnce("Prepare my archive export");
    await expect(page.getByText(copy("Your export is ready, but it is not complete."), { exact: true })).toBeVisible();
    await expect(page.getByText(`${copy("Files that could not be downloaded or did not match")} (1)`, { exact: true })).toBeVisible();
    // The mismatched voice is left out rather than packaged as if it were the original.
    expect([...partial.keys()].sort()).toEqual(["index.html", "manifest.json", files[0].path].sort());
    const partialManifest = JSON.parse(partial.get("manifest.json")!.toString("utf8"));
    expect(partialManifest.complete).toBe(false);
    expect(partialManifest.verification.allFilesVerified).toBe(false);
    expect(partialManifest.verification.files).toContainEqual({ path: files[1].path, sha256: files[1].sha256, verified: false });
    expect(partial.get("index.html")!.toString("utf8")).toContain(copy("This export is not complete. Read what is missing below."));

    corruptVoice = false;
    const whole = await exportOnce("Prepare the export again");
    await expect(page.getByText(copy("Your export is ready. Every file in it matches the preserved original."), { exact: true })).toBeVisible();
    await expect(page.getByText(copy("Files in this export: {count}", { count: 2 }), { exact: true })).toBeVisible();
    // Round trip: every packaged original hashes to its manifest value.
    const wholeManifest = JSON.parse(whole.get("manifest.json")!.toString("utf8"));
    expect(wholeManifest.complete).toBe(true);
    for (const entry of wholeManifest.memories[0].files) expect(sha(whole.get(entry.path)!)).toBe(entry.sha256);
    expect(whole.get(files[0].path)!.equals(photo)).toBe(true);
    const index = whole.get("index.html")!.toString("utf8");
    expect(index).toContain("La cocina de la tía María");
    expect(index).toContain(copy("Original voice recording"));
    expect(index).toContain(copy("Every file listed here was checked against the preserved original."));
  });
