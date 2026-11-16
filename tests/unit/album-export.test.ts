import { describe, expect, it } from "vitest";
import { albumExportChoices, selectAlbumExport } from "../../app/domain/album-export";
import { renderExportIndex, type ArchiveExportFile, type ArchiveExportManifest, type ArchiveExportMemory } from "../../app/domain/archive-export";

const file = (id: string, role: ArchiveExportFile["role"]): ArchiveExportFile => ({
  path: `memories/m/${role}/${id}`, kind: "asset", id, role, original: true, derivedFromId: null,
  contentType: "image/png", byteSize: 1, sha256: "0".repeat(64), durationMs: null, attribution: null, createdAt: "2026-11-16T00:00:00Z",
});
const memory = (id: string, extra: Partial<ArchiveExportMemory> = {}): ArchiveExportMemory => ({
  id, title: `Title ${id}`, completedAt: null, files: [file(`${id}_photo`, "original_photograph")],
  transcripts: [], storytellerContext: [], museConversation: [], voiceReplies: [], familyContributions: [], ...extra,
});
const contribution = (id: string, byOwner: boolean, includedForFamily: boolean, fileId: string | null) => ({
  id, attribution: `Name ${id}`, byOwner, kind: fileId ? ("human_voice" as const) : ("human_text" as const), includedForFamily, fileId,
  writtenVersions: fileId ? [] : [{ id: `${id}_v`, text: `Words ${id}`, createdAt: "2026-11-16T00:00:00Z" }],
  speakerWrittenWords: fileId ? [
    { id: `${id}_w1`, text: `Draft ${id}`, includedForFamily: false, createdAt: "2026-11-16T00:00:00Z" },
    { id: `${id}_w2`, text: `Kept ${id}`, includedForFamily: true, createdAt: "2026-11-16T00:00:01Z" },
  ] : [],
  createdAt: "2026-11-16T00:00:00Z",
});

function manifest(): ArchiveExportManifest {
  return {
    format: "memoriesmystory-archive-export", formatVersion: 1, generatedAt: "2026-11-16T12:00:00.000Z",
    complete: false,
    notIncluded: [{ code: "unfinished_memories", count: 3 }, { code: "recollections_withdrawn_by_their_author", count: 1 }],
    memories: [
      memory("m1", {
        files: [file("m1_photo", "original_photograph"), file("voice_in", "family_voice_recollection"), file("voice_out", "family_voice_recollection")],
        familyContributions: [contribution("c_owner", true, false, null), contribution("c_in", false, true, "voice_in"), contribution("c_out", false, false, "voice_out")],
      }),
      memory("m2"),
      memory("m3"),
    ],
    albums: [
      { id: "album_vacation", title: "Family vacation", description: "Every summer <3", chapterIds: ["ch_places", "ch_empty"] },
      { id: "album_other", title: "Other", description: "", chapterIds: ["ch_other"] },
      { id: "album_none", title: "Nothing yet", description: "", chapterIds: [] },
    ],
    chapters: [
      { id: "ch_places", albumId: "album_vacation", title: "Places we visited", description: "", memoryIds: ["m2", "m1"] },
      { id: "ch_empty", albumId: "album_vacation", title: "Still empty", description: "", memoryIds: [] },
      { id: "ch_other", albumId: "album_other", title: "Elsewhere", description: "", memoryIds: ["m3"] },
    ],
    people: [{ id: "p1", kind: "person", document: { label: "Abuela", memoryIds: ["m1", "m3"] } }],
  };
}

describe("album export", () => {
  it("offers only albums and Chapters that hold memories, in album order", () => {
    expect(albumExportChoices(manifest()).map((c) => [c.kind, c.id, c.memoryCount, c.albumTitle])).toEqual([
      ["album", "album_vacation", 2, null],
      ["chapter", "ch_places", 2, "Family vacation"],
      ["album", "album_other", 1, null],
      ["chapter", "ch_other", 1, "Other"],
    ]);
  });

  it("narrows to one album and carries only recollections the owner shows family", () => {
    const selected = selectAlbumExport(manifest(), { kind: "album", id: "album_vacation" })!;
    expect(selected.album).toEqual({ title: "Family vacation", description: "Every summer <3" });
    const m = selected.manifest;
    expect(m.memories.map((entry) => entry.id)).toEqual(["m1", "m2"]);
    expect(m.chapters.map((c) => c.id)).toEqual(["ch_places", "ch_empty"]);
    expect(m.people).toEqual([]);
    const m1 = m.memories[0]!;
    expect(m1.familyContributions.map((c) => c.id)).toEqual(["c_owner", "c_in"]);
    expect(m1.files.map((f) => f.id)).toEqual(["m1_photo", "voice_in"]);
    expect(m1.familyContributions[1]!.speakerWrittenWords.map((w) => w.text)).toEqual(["Kept c_in"]);
    // Account-wide counts are not claimed for one album; a left-out recollection is.
    expect(m.notIncluded).toEqual([{ code: "recollections_not_included_for_family", count: 1 }]);
    expect(m.complete).toBe(false);
    expect(JSON.stringify(m)).not.toContain("Abuela");
  });

  it("narrows to one Chapter, and is complete when nothing in it is left out", () => {
    const selected = selectAlbumExport(manifest(), { kind: "chapter", id: "ch_other" })!;
    expect(selected.album.title).toBe("Elsewhere");
    expect(selected.manifest.memories.map((entry) => entry.id)).toEqual(["m3"]);
    expect(selected.manifest.complete).toBe(true);
    expect(selected.manifest.albums).toEqual([{ id: "album_other", title: "Other", description: "", chapterIds: ["ch_other"] }]);
  });

  it("returns nothing for an empty or unknown selection", () => {
    expect(selectAlbumExport(manifest(), { kind: "album", id: "album_none" })).toBeNull();
    expect(selectAlbumExport(manifest(), { kind: "chapter", id: "ch_empty" })).toBeNull();
    expect(selectAlbumExport(manifest(), { kind: "album", id: "missing" })).toBeNull();
  });

  it("keeps a truncated archive's notice, since the album may be missing memories too", () => {
    const source = manifest();
    source.notIncluded.push({ code: "more_memories_than_one_export", count: null });
    expect(selectAlbumExport(source, { kind: "chapter", id: "ch_other" })!.manifest.notIncluded).toEqual([
      { code: "more_memories_than_one_export", count: null },
    ]);
  });

  it("reads as an album: Chapters in order, people's words escaped", () => {
    const selected = selectAlbumExport(manifest(), { kind: "album", id: "album_vacation" })!;
    const html = renderExportIndex(selected.manifest, { verifiedAt: "x", allFilesVerified: true, files: [] }, (key, values) =>
      Object.entries(values ?? {}).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), key), "en-US", selected.album);
    expect(html).toContain("<h1>Album: Family vacation</h1>");
    expect(html).toContain("Every summer &lt;3");
    expect(html.indexOf("Places we visited")).toBeLessThan(html.indexOf("Title m2"));
    expect(html.indexOf("Title m2")).toBeLessThan(html.indexOf("Title m1"));
    expect(html).toContain("<h3>Title m2</h3>");
    expect(html).not.toContain("<3");
  });
});
