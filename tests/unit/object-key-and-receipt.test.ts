import { describe, expect, it } from "vitest";

import {
  asId,
  createDurableAssetReceipt,
  resolveIdempotentOperation,
  type CorrelationId,
  type DraftId,
  type IdempotencyKey,
  type MediaAsset,
  type MediaAssetId,
  type MemoryStoryId,
  type OperationReceipt,
  type UserId
} from "../../app/domain";
import {
  draftOriginalObjectKey,
  storyDerivativeObjectKey,
  storyOriginalObjectKey
} from "../../app/services";

const accountId = asId<UserId>("user-1");
const draftId = asId<DraftId>("draft-1");
const storyId = asId<MemoryStoryId>("story-1");
const assetId = asId<MediaAssetId>("asset-1");
const correlationId = asId<CorrelationId>("correlation-1");

describe("private R2 object-key policy", () => {
  it("builds stable identity-based original and derivative keys", () => {
    expect(draftOriginalObjectKey({ draftId, assetId, extension: ".JPG" })).toBe(
      "drafts/draft-1/assets/asset-1/original.jpg"
    );
    expect(
      storyOriginalObjectKey({ accountId, memoryStoryId: storyId, assetId, extension: "webm" })
    ).toBe("accounts/user-1/memory-stories/story-1/assets/asset-1/original.webm");
    expect(
      storyDerivativeObjectKey({
        accountId,
        memoryStoryId: storyId,
        sourceAssetId: assetId,
        derivativeAssetId: asId<MediaAssetId>("asset-2"),
        extension: "jpg"
      })
    ).toBe(
      "accounts/user-1/memory-stories/story-1/assets/asset-1/derivatives/asset-2.jpg"
    );
  });

  it("rejects personal or traversal text in identity segments", () => {
    expect(() =>
      draftOriginalObjectKey({
        draftId: asId<DraftId>("../family photo"),
        assetId,
        extension: "jpg"
      })
    ).toThrow("unsafe R2 key characters");
  });
});

describe("idempotency and durable receipts", () => {
  const requestHash = "a".repeat(64);
  const receipt: OperationReceipt = {
    idempotencyKey: asId<IdempotencyKey>("idem-1"),
    operationKind: "upload_photo",
    scope: { type: "draft", id: draftId },
    requestHash,
    status: "succeeded",
    resultRef: "asset-1",
    correlationId,
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:01.000Z"
  };

  it("replays the same successful operation and rejects key reuse", () => {
    expect(resolveIdempotentOperation(null, requestHash)).toEqual({ action: "execute" });
    expect(resolveIdempotentOperation(receipt, requestHash)).toMatchObject({
      action: "replay"
    });
    expect(() => resolveIdempotentOperation(receipt, "b".repeat(64))).toThrow(
      "Idempotency key was reused with a different request."
    );
  });

  it("issues durable evidence only after R2 and D1 confirmation", () => {
    const asset: MediaAsset = {
      id: assetId,
      draftId,
      memoryStoryId: null,
      role: "original_photo",
      sourceAssetId: null,
      r2Key: "drafts/draft-1/assets/asset-1/original.jpg",
      contentType: "image/jpeg",
      byteSize: 100,
      durationMs: null,
      sha256: "a".repeat(64),
      r2Etag: "etag-1",
      durabilityStatus: "durable",
      createdByUserId: accountId,
      createdAt: "2026-07-16T00:00:00.000Z"
    };

    expect(
      createDurableAssetReceipt({
        asset,
        durableAt: "2026-07-16T00:00:01.000Z",
        correlationId
      })
    ).toMatchObject({ assetId, r2Etag: "etag-1", byteSize: 100 });
    expect(() =>
      createDurableAssetReceipt({
        asset: { ...asset, durabilityStatus: "pending", r2Etag: null },
        durableAt: "2026-07-16T00:00:01.000Z",
        correlationId
      })
    ).toThrow("confirmed R2 and D1 asset evidence");
  });
});
