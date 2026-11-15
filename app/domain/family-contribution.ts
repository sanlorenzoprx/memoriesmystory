export type FamilyContribution = {
  id: string;
  memoryId: string;
  version: number;
  authorState: "submitted" | "withdrawn";
  own: boolean;
  canAssemble: boolean;
  canInclude: boolean;
  familyVisible: boolean;
  latestRevisionId: string;
  includedRevisionId: string | null;
  revision: {
    id: string;
    attribution: string;
    text: string;
    sourceKind: "human_text" | "human_voice" | "human_photo";
    createdAt: string;
  };
  /** Present only for a spoken recollection; its words exist only in the recording. */
  voice?: { durationMs: number; contentType: string } | null;
  /** Present only for a supplementary photograph added by a relative. */
  photo?: { contentType: string } | null;
};
