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
    sourceKind: "human_text";
    createdAt: string;
  };
};
