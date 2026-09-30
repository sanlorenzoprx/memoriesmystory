import type {
  DraftId,
  GeneratedArtifactId,
  IdempotencyKey,
  LivingMemoryId,
  MediaAssetId,
  StoryContextId,
  TranscriptRevisionId,
  UserId
} from "./ids";

export const storyContextKinds = ["person", "place", "time", "event"] as const;
export type StoryContextKind = (typeof storyContextKinds)[number];

export const storyContextStates = ["stated", "approximate", "unknown", "omitted"] as const;
export type StoryContextState = (typeof storyContextStates)[number];

/**
 * Story context belongs to the storyteller. The state describes how the
 * storyteller wants the context represented; it is never a historical verdict.
 */
export type StoryContextEntry = {
  readonly id: StoryContextId;
  readonly livingMemoryId: LivingMemoryId;
  readonly kind: StoryContextKind;
  readonly value: string | null;
  readonly state: StoryContextState;
  readonly createdByUserId: UserId;
  readonly sourceRef: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StoryContextInput = {
  readonly kind: StoryContextKind;
  readonly value: string | null;
  readonly state: StoryContextState;
  readonly sourceRef?: string | null;
};
export function validateStoryContext(input: StoryContextInput): StoryContextInput {
  const value = input.value?.trim() || null;

  if ((input.state === "stated" || input.state === "approximate") && !value) {
    throw new Error("Stated or approximate story context requires the storyteller's value.");
  }

  if ((input.state === "unknown" || input.state === "omitted") && value) {
    throw new Error("Unknown or omitted story context cannot carry a system-supplied value.");
  }

  return { ...input, value };
}

export const processingStates = ["not_requested", "queued", "processing", "ready", "failed"] as const;
export type ProcessingState = (typeof processingStates)[number];

export type TranscriptionQueueMessage = {
  readonly version: 1;
  readonly draftId: DraftId;
  readonly livingMemoryId: LivingMemoryId;
  readonly audioAssetId: MediaAssetId;
  readonly requestedByUserId: UserId;
  readonly idempotencyKey: IdempotencyKey;
  readonly localeHint: string | null;
};

export type TranscriptSnapshot = {
  readonly state: ProcessingState;
  readonly revisionId: TranscriptRevisionId | null;
  readonly text: string | null;
  readonly locale: string | null;
  readonly sourceAudioAssetId: MediaAssetId;
  readonly retryable: boolean;
  readonly message: string | null;
};
export type MuseRememberingPrompt = {
  readonly artifactId: GeneratedArtifactId;
  readonly question: string;
  readonly sourceRefs: readonly string[];
  readonly promptVersion: string;
  readonly modelConfigVersion: string;
};

/**
 * A Muse prompt helps memory surface. It does not contain a truth score,
 * credibility score, correction, or authoritative version of the story.
 */
export function validateMusePrompt(prompt: MuseRememberingPrompt): MuseRememberingPrompt {
  const question = prompt.question.trim();
  if (!question) throw new Error("Muse must ask a real remembering question.");
  if (!prompt.sourceRefs.length) throw new Error("Muse prompts require source provenance.");
  return { ...prompt, question };
}

export type LivingMemoryReviewSnapshot = {
  readonly draftId: DraftId;
  readonly livingMemoryId: LivingMemoryId;
  readonly photoAssetId: MediaAssetId;
  readonly audioAssetId: MediaAssetId;
  readonly transcript: TranscriptSnapshot;
  readonly musePrompt: MuseRememberingPrompt | null;
  readonly context: readonly StoryContextEntry[];
  readonly originalsDurable: boolean;
  readonly ownerConfirmed: boolean;
  readonly readyToComplete: boolean;
};

export type CompleteLivingMemoryRequest = {
  readonly draftId: DraftId;
  readonly livingMemoryId: LivingMemoryId;
  readonly idempotencyKey: IdempotencyKey;
  readonly context: readonly StoryContextInput[];
};
export type LivingMemoryCompletionReceipt = {
  readonly livingMemoryId: LivingMemoryId;
  readonly completedAt: string;
  readonly activationRecorded: boolean;
  readonly replayed: boolean;
};

export type LivingMemoryShareArtifactSelection = {
  readonly includePhoto: true;
  readonly includeVoice: boolean;
  readonly includeCaptions: boolean;
  readonly includeNarratorAttribution: boolean;
  readonly includeBrandAttribution: boolean;
  readonly caption: string | null;
};

export function normalizeShareSelection(
  selection: LivingMemoryShareArtifactSelection
): LivingMemoryShareArtifactSelection {
  return {
    ...selection,
    caption: selection.caption?.trim() || null
  };
}
