import type { ArchiveExportManifest } from "./archive-export";

/**
 * Album export: the same verified, portable format as the archive export,
 * narrowed to one album or one Chapter. Every owner can make one, on any plan.
 *
 * An album copy is easy to hand to relatives, so it carries only what the
 * owner already chose to show family: their own recollections and the ones
 * they included. People and relationship notes stay in the full archive
 * export. A recollection left out is counted, so the copy never looks whole
 * when it is not.
 */
export type AlbumExportSelection =
  | { kind: "album"; id: string }
  | { kind: "chapter"; id: string };

export type AlbumExportChoice = AlbumExportSelection & {
  title: string;
  /** For a Chapter, the album it belongs to. */
  albumTitle: string | null;
  memoryCount: number;
};

/** Every album and Chapter that holds at least one exportable memory, in album order. */
export function albumExportChoices(
  manifest: ArchiveExportManifest,
): AlbumExportChoice[] {
  const exported = new Set(manifest.memories.map((memory) => memory.id)),
    chapters = new Map(manifest.chapters.map((chapter) => [chapter.id, chapter])),
    count = (ids: string[]) =>
      new Set(ids.filter((id) => exported.has(id))).size,
    choices: AlbumExportChoice[] = [];
  for (const album of manifest.albums ?? []) {
    const own = album.chapterIds
      .map((id) => chapters.get(id))
      .filter((chapter) => chapter !== undefined);
    const total = count(own.flatMap((chapter) => chapter.memoryIds));
    if (!total) continue;
    choices.push({ kind: "album", id: album.id, title: album.title, albumTitle: null, memoryCount: total });
    for (const chapter of own) {
      const memoryCount = count(chapter.memoryIds);
      if (memoryCount)
        choices.push({ kind: "chapter", id: chapter.id, title: chapter.title, albumTitle: album.title, memoryCount });
    }
  }
  return choices;
}

/**
 * The manifest for one album or Chapter, with its title and description for
 * the readable page; null when the selection holds nothing to export.
 */
export function selectAlbumExport(
  manifest: ArchiveExportManifest,
  selection: AlbumExportSelection,
): {
  manifest: ArchiveExportManifest;
  album: { title: string; description: string };
} | null {
  const album =
      selection.kind === "album"
        ? manifest.albums?.find((entry) => entry.id === selection.id)
        : manifest.albums?.find((entry) => entry.chapterIds.includes(selection.id)),
    chapterIds =
      selection.kind === "album" ? (album?.chapterIds ?? []) : [selection.id];
  if (!album) return null;
  const chapters = chapterIds
    .map((id) => manifest.chapters.find((chapter) => chapter.id === id))
    .filter((chapter) => chapter !== undefined);
  const wanted = new Set(chapters.flatMap((chapter) => chapter.memoryIds));
  let notForFamily = 0;
  const memories = manifest.memories
    .filter((memory) => wanted.has(memory.id))
    .map((memory) => {
      const familyContributions = memory.familyContributions.filter(
        (entry) => entry.byOwner || entry.includedForFamily,
      );
      notForFamily += memory.familyContributions.length - familyContributions.length;
      const kept = new Set(
        familyContributions.flatMap((entry) => (entry.fileId ? [entry.fileId] : [])),
      );
      const dropped = new Set(
        memory.familyContributions.flatMap((entry) =>
          entry.fileId && !kept.has(entry.fileId) ? [entry.fileId] : [],
        ),
      );
      return {
        ...memory,
        // A relative's file goes only with a recollection the owner included.
        files: memory.files.filter((file) => !dropped.has(file.id)),
        familyContributions: familyContributions.map((entry) => ({
          ...entry,
          // Words a speaker wrote travel only in the version the owner included.
          speakerWrittenWords: entry.byOwner
            ? entry.speakerWrittenWords
            : entry.speakerWrittenWords.filter((words) => words.includedForFamily),
        })),
      };
    });
  if (!memories.length) return null;
  const exported = new Set(memories.map((memory) => memory.id));
  const notIncluded: ArchiveExportManifest["notIncluded"] = manifest.notIncluded
    // Account-wide counts do not describe one album; keep only what still applies.
    .filter((item) => item.code === "more_memories_than_one_export")
    .map((item) => ({ code: item.code, count: null }));
  if (notForFamily)
    notIncluded.push({ code: "recollections_not_included_for_family", count: notForFamily });
  return {
    album: {
      title: selection.kind === "album" ? album.title : chapters[0]!.title,
      description:
        selection.kind === "album" ? album.description : chapters[0]!.description,
    },
    manifest: {
      ...manifest,
      complete: notIncluded.length === 0,
      notIncluded,
      memories,
      albums: [
        {
          id: album.id,
          title: album.title,
          description: album.description,
          chapterIds: chapters.map((chapter) => chapter.id),
        },
      ],
      chapters: chapters.map((chapter) => ({
        ...chapter,
        memoryIds: chapter.memoryIds.filter((id) => exported.has(id)),
      })),
      people: [],
    },
  };
}
