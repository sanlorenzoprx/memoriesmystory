export type FamilyInvite = {
  id: string;
  archiveId: string;
  role: "viewer" | "contributor";
  scopeKind: "memory" | "chapter" | "archive";
  scopeId: string;
  targetEmail: string;
  state: "pending" | "accepted" | "revoked";
  version: number;
  expiresAt: string;
};
export type FamilyMembership = {
  label?: string | null;
  id: string;
  role: "viewer" | "contributor";
  scopeKind: "memory" | "chapter" | "archive";
};
export type FamilySharedMemory = {
  id: string;
  title: string | null;
  photoUrl: string | null;
  audioUrl: string | null;
};
