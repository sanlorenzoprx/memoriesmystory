import type { DraftId, MemoryStoryId, TranscriptRevisionId, UserId } from "./ids";
import { isDurableOriginal, type MediaAsset } from "./media-asset";

export const draftStatuses = [
  "local_draft",
  "photo_local",
  "photo_uploading",
  "photo_durable",
  "audio_recording",
  "audio_local",
  "audio_uploading",
  "originals_durable",
  "processing",
  "review_partial",
  "review_ready",
  "finalizing",
  "complete",
  "needs_connection"
] as const;

export type DraftStatus = (typeof draftStatuses)[number];
export type MemoryStoryVisibility = "private" | "public";

export type MemoryStoryDraft = {
  readonly id: DraftId;
  readonly ownerUserId: UserId | null;
  readonly anonymousIdentityHash: string | null;
  readonly status: DraftStatus;
  readonly uiLocale: string;
  readonly spokenLocale: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly version: number;
};

export type MemoryStory = {
  readonly id: MemoryStoryId;
  readonly ownerUserId: UserId;
  readonly status: "complete";
  readonly visibility: MemoryStoryVisibility;
  readonly primaryPhotoAssetId: MediaAsset["id"];
  readonly primaryAudioAssetId: MediaAsset["id"];
  readonly currentTranscriptRevisionId: TranscriptRevisionId | null;
  readonly currentMuseDescriptionId: string | null;
  readonly createdAt: string;
  readonly completedAt: string;
  readonly updatedAt: string;
  readonly version: number;
};

const transitions: Readonly<Record<DraftStatus, readonly DraftStatus[]>> = {
  local_draft: ["photo_local"],
  photo_local: ["photo_uploading"],
  photo_uploading: ["photo_durable", "needs_connection"],
  photo_durable: ["audio_recording"],
  audio_recording: ["audio_local"],
  audio_local: ["audio_uploading"],
  audio_uploading: ["originals_durable", "needs_connection"],
  originals_durable: ["processing", "review_partial", "review_ready"],
  processing: ["review_partial", "review_ready"],
  review_partial: ["processing", "review_ready", "finalizing"],
  review_ready: ["finalizing"],
  finalizing: ["complete", "needs_connection"],
  complete: [],
  needs_connection: ["photo_uploading", "audio_uploading", "finalizing"]
};

export function canTransitionDraft(from: DraftStatus, to: DraftStatus): boolean {
  return transitions[from].includes(to);
}

export type CompletionBlocker =
  | "missing_owner"
  | "missing_durable_original_photo"
  | "missing_durable_original_audio"
  | "mismatched_original_scope";

export function getCompletionBlockers(input: {
  readonly ownerUserId: UserId | null;
  readonly primaryPhoto: MediaAsset | null;
  readonly primaryAudio: MediaAsset | null;
}): CompletionBlocker[] {
  const blockers: CompletionBlocker[] = [];

  if (!input.ownerUserId) {
    blockers.push("missing_owner");
  }

  if (!isDurableOriginal(input.primaryPhoto, "original_photo")) {
    blockers.push("missing_durable_original_photo");
  }

  if (!isDurableOriginal(input.primaryAudio, "original_audio")) {
    blockers.push("missing_durable_original_audio");
  }

  if (
    input.primaryPhoto &&
    input.primaryAudio &&
    (input.primaryPhoto.draftId !== input.primaryAudio.draftId ||
      input.primaryPhoto.memoryStoryId !== input.primaryAudio.memoryStoryId)
  ) {
    blockers.push("mismatched_original_scope");
  }

  return blockers;
}
