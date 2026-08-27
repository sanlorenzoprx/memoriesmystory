import type { DraftId, MediaAssetId, MemoryStoryId, UserId } from "./ids";

export const assetRoles = [
  "original_photo",
  "enhanced_photo",
  "original_audio",
  "cleaned_audio"
] as const;

export type AssetRole = (typeof assetRoles)[number];
export type OriginalAssetRole = Extract<AssetRole, "original_photo" | "original_audio">;
export type AssetDurabilityStatus = "pending" | "durable" | "failed";

export type MediaAsset = {
  readonly id: MediaAssetId;
  readonly draftId: DraftId;
  readonly memoryStoryId: MemoryStoryId | null;
  readonly role: AssetRole;
  readonly sourceAssetId: MediaAssetId | null;
  readonly r2Key: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly durationMs: number | null;
  readonly sha256: string;
  readonly r2Etag: string | null;
  readonly durabilityStatus: AssetDurabilityStatus;
  readonly createdByUserId: UserId | null;
  readonly createdAt: string;
};

export type ImmutableOriginalIdentity = Pick<
  MediaAsset,
  "id" | "role" | "r2Key" | "byteSize" | "sha256"
>;

export function isOriginalAssetRole(role: AssetRole): role is OriginalAssetRole {
  return role === "original_photo" || role === "original_audio";
}

export function assertOriginalIdentityUnchanged(
  before: ImmutableOriginalIdentity,
  after: ImmutableOriginalIdentity
): void {
  if (!isOriginalAssetRole(before.role)) {
    return;
  }

  const identityChanged =
    before.id !== after.id ||
    before.role !== after.role ||
    before.r2Key !== after.r2Key ||
    before.byteSize !== after.byteSize ||
    before.sha256 !== after.sha256;

  if (identityChanged) {
    throw new Error("Immutable original asset identity cannot be changed.");
  }
}

export function isDurableOriginal(
  asset: MediaAsset | null | undefined,
  role: OriginalAssetRole
): asset is MediaAsset & { role: OriginalAssetRole; durabilityStatus: "durable" } {
  return (
    asset?.role === role &&
    asset.durabilityStatus === "durable" &&
    typeof asset.r2Etag === "string" &&
    asset.r2Etag.length > 0
  );
}
