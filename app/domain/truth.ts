import type {
  FactId,
  GeneratedArtifactId,
  MediaAssetId,
  MemoryStoryId,
  TranscriptRevisionId,
  UserId
} from "./ids";

export const truthStates = [
  "confirmed",
  "approximate",
  "unknown",
  "disputed",
  "ai_suggested_unconfirmed"
] as const;

export type TruthState = (typeof truthStates)[number];

export const factKinds = [
  "person",
  "place",
  "date",
  "event",
  "relationship",
  "theme"
] as const;

export type FactKind = (typeof factKinds)[number];

export const artifactKinds = [
  "machine_transcript",
  "corrected_transcript",
  "translated_transcript",
  "muse_legacy_description",
  "muse_prompt"
] as const;

export type ArtifactKind = (typeof artifactKinds)[number];
export type ArtifactCreatorType = "machine" | "user" | "translator";

export type TranscriptRevision = {
  readonly id: TranscriptRevisionId;
  readonly memoryStoryId: MemoryStoryId;
  readonly sourceAudioAssetId: MediaAssetId;
  readonly parentRevisionId: TranscriptRevisionId | null;
  readonly kind: Extract<
    ArtifactKind,
    "machine_transcript" | "corrected_transcript" | "translated_transcript"
  >;
  readonly text: string;
  readonly locale: string;
  readonly createdByType: ArtifactCreatorType;
  readonly createdByUserId: UserId | null;
  readonly modelConfigVersion: string | null;
  readonly createdAt: string;
};

export type GeneratedArtifact = {
  readonly id: GeneratedArtifactId;
  readonly memoryStoryId: MemoryStoryId;
  readonly kind: Extract<ArtifactKind, "muse_legacy_description" | "muse_prompt">;
  readonly content: string;
  readonly status: "pending" | "ready" | "failed";
  readonly sourceRefs: readonly string[];
  readonly modelConfigVersion: string;
  readonly promptVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MemoryStoryFact = {
  readonly id: FactId;
  readonly memoryStoryId: MemoryStoryId;
  readonly kind: FactKind;
  readonly value: string;
  readonly truthState: TruthState;
  readonly sourceType: "testimony" | "user" | "machine" | "import";
  readonly sourceRef: string | null;
  readonly confirmedByUserId: UserId | null;
  readonly createdAt: string;
  readonly supersededAt: string | null;
};

export function requiresHumanConfirmation(truthState: TruthState): boolean {
  return truthState === "ai_suggested_unconfirmed";
}
