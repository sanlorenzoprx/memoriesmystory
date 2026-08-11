import type {
  CorrelationId,
  DraftId,
  IdempotencyKey,
  MediaAssetId,
  MemoryStoryId,
  ShareId,
  UserId
} from "./ids";
import type { MediaAsset } from "./media-asset";

export const operationKinds = [
  "create_draft",
  "upload_photo",
  "upload_audio",
  "promote_draft",
  "queue_transcription",
  "finalize_story",
  "record_living_memory_activation",
  "create_share",
  "create_share_artifact",
  "record_share_intent",
  /** @deprecated historical share-to-unlock operation; must never grant a new reward. */
  "grant_share_unlock"
] as const;

export type OperationKind = (typeof operationKinds)[number];
export type OperationScope =
  | { readonly type: "user"; readonly id: UserId }
  | { readonly type: "draft"; readonly id: DraftId }
  | { readonly type: "story"; readonly id: MemoryStoryId }
  | { readonly type: "share"; readonly id: ShareId }
  | { readonly type: "asset"; readonly id: MediaAssetId };

export type OperationReceipt = {
  readonly idempotencyKey: IdempotencyKey;
  readonly operationKind: OperationKind;
  readonly scope: OperationScope;
  readonly requestHash: string;
  readonly status: "started" | "succeeded" | "failed";
  readonly resultRef: string | null;
  readonly correlationId: CorrelationId;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type IdempotencyResolution =
  | { readonly action: "execute" }
  | { readonly action: "resume"; readonly receipt: OperationReceipt }
  | { readonly action: "replay"; readonly receipt: OperationReceipt };

export function resolveIdempotentOperation(
  existing: OperationReceipt | null,
  requestHash: string
): IdempotencyResolution {
  if (!/^[a-f0-9]{64}$/i.test(requestHash)) {
    throw new Error("Idempotent request hash must be a SHA-256 hex digest.");
  }

  if (!existing) {
    return { action: "execute" };
  }

  if (existing.requestHash !== requestHash) {
    throw new Error("Idempotency key was reused with a different request.");
  }

  return existing.status === "succeeded"
    ? { action: "replay", receipt: existing }
    : { action: "resume", receipt: existing };
}

export type DurableAssetReceipt = {
  readonly assetId: MediaAssetId;
  readonly r2Key: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly r2Etag: string;
  readonly durableAt: string;
  readonly correlationId: CorrelationId;
};

export function createDurableAssetReceipt(input: {
  readonly asset: MediaAsset;
  readonly durableAt: string;
  readonly correlationId: CorrelationId;
}): DurableAssetReceipt {
  if (input.asset.durabilityStatus !== "durable" || !input.asset.r2Etag) {
    throw new Error("A durable receipt requires confirmed R2 and D1 asset evidence.");
  }

  return {
    assetId: input.asset.id,
    r2Key: input.asset.r2Key,
    byteSize: input.asset.byteSize,
    sha256: input.asset.sha256,
    r2Etag: input.asset.r2Etag,
    durableAt: input.durableAt,
    correlationId: input.correlationId
  };
}
