import { describe, expect, it } from "vitest";

import {
  asId,
  assertOriginalIdentityUnchanged,
  canTransitionDraft,
  getCompletionBlockers,
  requiresHumanConfirmation,
  type DraftId,
  type MediaAsset,
  type MediaAssetId,
  type UserId
} from "../../app/domain";

const draftId = asId<DraftId>("draft-1");
const userId = asId<UserId>("user-1");

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: asId<MediaAssetId>("asset-1"),
    draftId,
    memoryStoryId: null,
    role: "original_photo",
    sourceAssetId: null,
    r2Key: "drafts/draft-1/assets/asset-1/original.jpg",
    contentType: "image/jpeg",
    byteSize: 1024,
    durationMs: null,
    sha256: "a".repeat(64),
    r2Etag: "etag-1",
    durabilityStatus: "durable",
    createdByUserId: userId,
    createdAt: "2026-07-16T00:00:00.000Z",
    ...overrides
  };
}

describe("Phase 1 domain contracts", () => {
  it("allows only explicit recoverable draft transitions", () => {
    expect(canTransitionDraft("photo_uploading", "needs_connection")).toBe(true);
    expect(canTransitionDraft("needs_connection", "photo_uploading")).toBe(true);
    expect(canTransitionDraft("processing", "review_partial")).toBe(true);
    expect(canTransitionDraft("local_draft", "complete")).toBe(false);
    expect(canTransitionDraft("complete", "finalizing")).toBe(false);
  });

  it("requires ownership and both durable originals for completion", () => {
    const photo = asset();
    const audio = asset({
      id: asId<MediaAssetId>("asset-2"),
      role: "original_audio",
      r2Key: "drafts/draft-1/assets/asset-2/original.webm",
      contentType: "audio/webm",
      durationMs: 30_000,
      sha256: "b".repeat(64)
    });

    expect(
      getCompletionBlockers({ ownerUserId: userId, primaryPhoto: photo, primaryAudio: audio })
    ).toEqual([]);
    expect(
      getCompletionBlockers({
        ownerUserId: null,
        primaryPhoto: photo,
        primaryAudio: { ...audio, durabilityStatus: "failed" }
      })
    ).toEqual(["missing_owner", "missing_durable_original_audio"]);
    expect(
      getCompletionBlockers({
        ownerUserId: userId,
        primaryPhoto: photo,
        primaryAudio: { ...audio, draftId: asId<DraftId>("draft-2") }
      })
    ).toContain("mismatched_original_scope");
  });

  it("rejects any change to an original asset identity", () => {
    const original = asset();

    expect(() =>
      assertOriginalIdentityUnchanged(original, {
        ...original,
        sha256: "c".repeat(64)
      })
    ).toThrow("Immutable original asset identity cannot be changed.");
    expect(() => assertOriginalIdentityUnchanged(original, original)).not.toThrow();
  });

  it("keeps machine suggestions unconfirmed until a person accepts them", () => {
    expect(requiresHumanConfirmation("ai_suggested_unconfirmed")).toBe(true);
    expect(requiresHumanConfirmation("confirmed")).toBe(false);
    expect(requiresHumanConfirmation("disputed")).toBe(false);
  });
});
