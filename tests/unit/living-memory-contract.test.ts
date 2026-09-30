import { describe, expect, it } from "vitest";

import {
  asId,
  assembleLivingMemory,
  isActivationEvent,
  type DraftId,
  type LivingMemoryId,
  type MediaAsset,
  type MediaAssetId,
  type MemoryStory,
  type ProductEvent,
  type UserId
} from "../../app/domain";

const livingMemoryId = asId<LivingMemoryId>("memory-1");
const draftId = asId<DraftId>("draft-1");
const userId = asId<UserId>("user-1");

function asset(role: "original_photo" | "original_audio", id: string): MediaAsset {
  return {
    id: asId<MediaAssetId>(id),
    draftId,
    memoryStoryId: livingMemoryId,
    role,
    sourceAssetId: null,
    r2Key: `memories/memory-1/${id}`,
    contentType: role === "original_photo" ? "image/jpeg" : "audio/webm",
    byteSize: 1024,
    durationMs: role === "original_audio" ? 30_000 : null,
    sha256: (role === "original_photo" ? "a" : "b").repeat(64),
    r2Etag: `etag-${id}`,
    durabilityStatus: "durable",
    createdByUserId: userId,
    createdAt: "2026-08-11T00:00:00.000Z"
  };
}

const persistence: MemoryStory = {
  id: livingMemoryId,
  ownerUserId: userId,
  status: "complete",
  visibility: "private",
  primaryPhotoAssetId: asId<MediaAssetId>("photo-1"),
  primaryAudioAssetId: asId<MediaAssetId>("audio-1"),
  currentTranscriptRevisionId: null,
  currentMuseDescriptionId: null,
  createdAt: "2026-08-11T00:00:00.000Z",
  completedAt: "2026-08-11T00:01:00.000Z",
  updatedAt: "2026-08-11T00:01:00.000Z",
  version: 1
};

describe("Living Memory domain contract", () => {
  it("assembles the canonical aggregate over validated persistence sources", () => {
    const livingMemory = assembleLivingMemory({
      persistence,
      originalPhoto: asset("original_photo", "photo-1"),
      originalAudio: asset("original_audio", "audio-1")
    });

    expect(livingMemory.kind).toBe("living_memory");
    expect(livingMemory.id).toBe(livingMemoryId);
    expect(livingMemory.persistence.visibility).toBe("private");
  });

  it("fails closed when an original is not bound to the same Living Memory", () => {
    expect(() =>
      assembleLivingMemory({
        persistence,
        originalPhoto: {
          ...asset("original_photo", "photo-1"),
          memoryStoryId: asId<LivingMemoryId>("memory-2")
        },
        originalAudio: asset("original_audio", "audio-1")
      })
    ).toThrow("Original photograph is not bound to the Living Memory.");
  });

  it("recognizes first_living_memory_completed as the activation event", () => {
    const event: ProductEvent = {
      name: "first_living_memory_completed",
      occurredAt: "2026-08-11T00:01:00.000Z",
      userId,
      livingMemoryId,
      sessionId: "session-1",
      referralId: null,
      shareChannel: null
    };

    expect(isActivationEvent(event)).toBe(true);
  });
});
