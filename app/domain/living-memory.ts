import { isDurableOriginal, type MediaAsset } from "./media-asset";
import type { LivingMemoryId } from "./ids";
import type { MemoryStory } from "./memory-story";
import type { GeneratedArtifact, MemoryStoryFact, TranscriptRevision } from "./truth";

/**
 * Canonical product aggregate over the existing MemoryStory persistence model.
 *
 * MemoryStory remains a compatibility/storage record during migration. New product
 * behavior should reason about LivingMemory when it needs the complete source-grounded
 * object rather than only the persistence row.
 */
export type LivingMemory = {
  readonly kind: "living_memory";
  readonly id: LivingMemoryId;
  readonly persistence: MemoryStory;
  readonly originalPhoto: MediaAsset;
  readonly originalAudio: MediaAsset;
  readonly currentTranscript: TranscriptRevision | null;
  readonly facts: readonly MemoryStoryFact[];
  readonly generatedArtifacts: readonly GeneratedArtifact[];
};

export type LivingMemoryShareSelection = {
  readonly includePhoto: true;
  readonly includeVoice: boolean;
  readonly includeCaptions: boolean;
  readonly includeNarratorAttribution: boolean;
  readonly includeBrandAttribution: boolean;
};

function assertSameLivingMemory(reference: LivingMemoryId, candidate: LivingMemoryId | null, label: string): void {
  if (candidate !== reference) {
    throw new Error(`${label} is not bound to the Living Memory.`);
  }
}

export function assembleLivingMemory(input: {
  readonly persistence: MemoryStory;
  readonly originalPhoto: MediaAsset;
  readonly originalAudio: MediaAsset;
  readonly currentTranscript?: TranscriptRevision | null;
  readonly facts?: readonly MemoryStoryFact[];
  readonly generatedArtifacts?: readonly GeneratedArtifact[];
}): LivingMemory {
  const id = input.persistence.id as LivingMemoryId;

  if (!isDurableOriginal(input.originalPhoto, "original_photo")) {
    throw new Error("Living Memory requires a durable original photograph.");
  }

  if (!isDurableOriginal(input.originalAudio, "original_audio")) {
    throw new Error("Living Memory requires durable original voice audio.");
  }

  assertSameLivingMemory(id, input.originalPhoto.memoryStoryId, "Original photograph");
  assertSameLivingMemory(id, input.originalAudio.memoryStoryId, "Original audio");

  const currentTranscript = input.currentTranscript ?? null;
  if (currentTranscript) {
    assertSameLivingMemory(id, currentTranscript.memoryStoryId, "Current transcript");
  }

  const facts = input.facts ?? [];
  for (const fact of facts) {
    assertSameLivingMemory(id, fact.memoryStoryId, "Fact");
  }

  const generatedArtifacts = input.generatedArtifacts ?? [];
  for (const artifact of generatedArtifacts) {
    assertSameLivingMemory(id, artifact.memoryStoryId, "Generated artifact");
  }

  return {
    kind: "living_memory",
    id,
    persistence: input.persistence,
    originalPhoto: input.originalPhoto,
    originalAudio: input.originalAudio,
    currentTranscript,
    facts,
    generatedArtifacts
  };
}
