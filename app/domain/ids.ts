declare const brand: unique symbol;

export type Brand<Value, Name extends string> = Value & {
  readonly [brand]: Name;
};

export type UserId = Brand<string, "UserId">;
export type DraftId = Brand<string, "DraftId">;
export type MemoryStoryId = Brand<string, "MemoryStoryId">;

/**
 * Canonical product identifier. During the compatibility migration a Living Memory
 * intentionally uses the same persistence identifier as MemoryStory.
 */
export type LivingMemoryId = MemoryStoryId;

export type MediaAssetId = Brand<string, "MediaAssetId">;
export type TranscriptRevisionId = Brand<string, "TranscriptRevisionId">;
export type GeneratedArtifactId = Brand<string, "GeneratedArtifactId">;
export type FactId = Brand<string, "FactId">;
export type ShareId = Brand<string, "ShareId">;
export type ShareArtifactId = Brand<string, "ShareArtifactId">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type IdempotencyKey = Brand<string, "IdempotencyKey">;

export function asId<Id extends string>(value: string): Id {
  if (!value.trim()) {
    throw new Error("Domain identifiers cannot be empty.");
  }

  return value as Id;
}
