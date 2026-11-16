import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { ArchiveExportFile, ArchiveExportManifest } from "../../app/domain/archive-export";

// Synthetic UI evidence with stubbed routes. It proves an owner can choose one
// album, that only its memories are packaged and that a recollection the owner
// has not included for family stays out of the copy.
function entryNames(zip: Buffer) {
  const end = zip.length - 22,
    names: string[] = [],
    contents = new Map<string, Buffer>();
  let cursor = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const size = zip.readUInt32LE(cursor + 24),
      nameLength = zip.readUInt16LE(cursor + 28),
      local = zip.readUInt32LE(cursor + 42),
      name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"),
      start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    names.push(name);
    contents.set(name, zip.subarray(start, start + size));
    cursor += 46 + nameLength;
  }
  return { names, contents };
}
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: an owner exports one album with only what they show family`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
    const photo = readFileSync(new URL("../fixtures/synthetic-family-photo.png", import.meta.url)),
      voice = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 9, 9]);
    const file = (memory: string, id: string, role: ArchiveExportFile["role"], bytes: Buffer): ArchiveExportFile => ({
      path: `memories/${memory}/${role}/${id}`, kind: "asset", id, role, original: true, derivedFromId: null,
      contentType: "application/octet-stream", byteSize: bytes.length, sha256: sha(bytes), durationMs: null,
      attribution: null, createdAt: "2026-11-16T00:00:00Z",
    });
    const base = { completedAt: null, transcripts: [], storytellerContext: [], museConversation: [], voiceReplies: [] };
    const manifest: ArchiveExportManifest = {
      format: "memoriesmystory-archive-export", formatVersion: 1, generatedAt: "2026-11-16T12:00:00.000Z",
      complete: false, notIncluded: [{ code: "unfinished_memories", count: 2 }],
      memories: [
        {
          ...base, id: "memory_beach", title: "La playa de Luquillo",
          files: [file("memory_beach", "photo_beach", "original_photograph", photo), file("memory_beach", "voice_private", "family_voice_recollection", voice)],
          familyContributions: [{ id: "contribution_private", attribution: "Primo Luis", byOwner: false, kind: "human_voice", includedForFamily: false, fileId: "voice_private", writtenVersions: [], speakerWrittenWords: [], createdAt: "2026-11-16T00:00:00Z" }],
        },
        { ...base, id: "memory_kitchen", title: "La cocina", files: [file("memory_kitchen", "photo_kitchen", "original_photograph", photo)], familyContributions: [] },
      ],
      albums: [
        { id: "album_vacation", title: "Family vacation", description: "", chapterIds: ["chapter_places"] },
        { id: "album_home", title: "Our home", description: "", chapterIds: ["chapter_rooms"] },
      ],
      chapters: [
        { id: "chapter_places", albumId: "album_vacation", title: "Places we visited", description: "", memoryIds: ["memory_beach"] },
        { id: "chapter_rooms", albumId: "album_home", title: "Rooms", description: "", memoryIds: ["memory_kitchen"] },
      ],
      people: [],
    };
    const downloads: string[] = [];
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({ json: { drafts: [{ id: "memory_beach", status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] } }),
    );
    await page.route("**/resources/family-archives**", (route) => route.fulfill({ json: { archives: [], nextCursor: null } }));
    await page.route("**/resources/archive-export/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/manifest")) return route.fulfill({ json: manifest });
      downloads.push(path.split("/").at(-1)!);
      return route.fulfill({ status: 200, body: path.endsWith("/voice_private") ? voice : photo });
    });
    await page.goto("/archive");
    await page.getByText(copy("Export my archive"), { exact: true }).click();
    await page.getByLabel(copy("Album: {title} (memories: {count})", { title: "Family vacation", count: 1 }), { exact: true }).check();
    await expect(page.getByLabel(copy("Chapter: {title}, in {album} (memories: {count})", { title: "Rooms", album: "Our home", count: 1 }), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy("Prepare the album export"), exact: true }).click();
    const link = page.getByRole("link", { name: copy("Save the export to this device"), exact: true });
    await expect(link).toBeVisible();
    await expect(page.getByText(`${copy("Recollections you have not included for family")} (1)`, { exact: true })).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe("family-album-export-2026-11-16.zip");
    const { names, contents } = entryNames(readFileSync(await download.path()));
    // Only this album's photograph; the other album and the private voice are never fetched.
    expect(names.sort()).toEqual(["index.html", "manifest.json", "memories/memory_beach/original_photograph/photo_beach"]);
    expect(downloads).toEqual(["photo_beach"]);
    const index = contents.get("index.html")!.toString("utf8");
    expect(index).toContain(copy("Album: {title}", { title: "Family vacation" }));
    expect(index).toContain("Places we visited");
    expect(index).not.toContain("La cocina");
    expect(index).not.toContain("Primo Luis");
  });
