import type {
  DraftId,
  MediaAssetId,
  MemoryStoryId,
  UserId
} from "../domain/ids";

function segment(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${label} contains unsafe R2 key characters.`);
  }

  return value;
}

function extension(value: string): string {
  const normalized = value.toLowerCase().replace(/^\./, "");

  if (!/^[a-z0-9]{1,10}$/.test(normalized)) {
    throw new Error("Media extension is invalid.");
  }

  return normalized;
}

export function draftOriginalObjectKey(input: {
  readonly draftId: DraftId;
  readonly assetId: MediaAssetId;
  readonly extension: string;
}): string {
  return `drafts/${segment(input.draftId, "Draft ID")}/assets/${segment(
    input.assetId,
    "Asset ID"
  )}/original.${extension(input.extension)}`;
}

export function storyOriginalObjectKey(input: {
  readonly accountId: UserId;
  readonly memoryStoryId: MemoryStoryId;
  readonly assetId: MediaAssetId;
  readonly extension: string;
}): string {
  return `accounts/${segment(input.accountId, "Account ID")}/memory-stories/${segment(
    input.memoryStoryId,
    "Memory Story ID"
  )}/assets/${segment(input.assetId, "Asset ID")}/original.${extension(input.extension)}`;
}

export function storyDerivativeObjectKey(input: {
  readonly accountId: UserId;
  readonly memoryStoryId: MemoryStoryId;
  readonly sourceAssetId: MediaAssetId;
  readonly derivativeAssetId: MediaAssetId;
  readonly extension: string;
}): string {
  return `accounts/${segment(input.accountId, "Account ID")}/memory-stories/${segment(
    input.memoryStoryId,
    "Memory Story ID"
  )}/assets/${segment(input.sourceAssetId, "Source asset ID")}/derivatives/${segment(
    input.derivativeAssetId,
    "Derivative asset ID"
  )}.${extension(input.extension)}`;
}
