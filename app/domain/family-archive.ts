export type FamilyArchive = {
  id: string;
  title: string;
  description: string;
  version: number;
  /** True when an invited relative made this album under the owner's permission. */
  madeByFamily?: boolean;
};
export type FamilyMemory = {
  id: string;
  title: string | null;
  titleVersion: number;
  photoUrl: string | null;
  voiceAvailable: boolean;
};
export type FamilyChapter = {
  id: string;
  archiveId: string;
  title: string;
  description: string;
  version: number;
  position: number;
  visibility: "private";
  coverMemoryId: string | null;
  memoryIds: string[];
};
export type FamilyArchiveIndex = {
  archives: FamilyArchive[];
  chapters: FamilyChapter[];
  memories: FamilyMemory[];
  nextMemoryCursor: string | null;
  archiveId: string | null;
  nextChapterCursor: string | null;
};
