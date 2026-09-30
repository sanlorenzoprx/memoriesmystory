export type LivingMemoryPersistenceEnv = {
  readonly DB: D1Database;
};

export type LivingMemoryFoundation = {
  readonly livingMemoryId: string;
  readonly draftId: string;
  readonly ownerUserId: string;
  readonly photoAssetId: string;
  readonly audioAssetId: string;
  readonly audioR2Key: string;
  readonly audioContentType: string;
};

type DraftRow = {
  id: string;
  owner_user_id: string | null;
  status: string;
  created_at: string;
};

type AssetRow = {
  id: string;
  role: "original_photo" | "original_audio";
  r2_key: string;
  content_type: string;
  durability_status: "pending" | "durable" | "failed";
};

type StoryRow = {
  id: string;
  owner_user_id: string;
  status: "draft" | "complete";
  primary_photo_asset_id: string | null;
  primary_audio_asset_id: string | null;
};

export class LivingMemoryPersistenceError extends Error {
  constructor(
    readonly code:
      | "draft_not_found"
      | "owner_required"
      | "owner_mismatch"
      | "originals_not_durable"
      | "story_conflict",
    message: string
  ) {
    super(message);
  }
}
async function loadDurableOriginals(
  env: LivingMemoryPersistenceEnv,
  draftId: string
): Promise<{ photo: AssetRow; audio: AssetRow }> {
  const assets = await env.DB.prepare(
    `SELECT id, role, r2_key, content_type, durability_status
     FROM media_assets
     WHERE draft_id = ?
       AND role IN ('original_photo', 'original_audio')
       AND durability_status = 'durable'
     ORDER BY created_at`
  ).bind(draftId).all<AssetRow>();

  const photo = assets.results.find((asset) => asset.role === "original_photo");
  const audio = assets.results.find((asset) => asset.role === "original_audio");

  if (!photo || !audio) {
    throw new LivingMemoryPersistenceError(
      "originals_not_durable",
      "The original photograph and voice must both be durably preserved first."
    );
  }

  return { photo, audio };
}

/**
 * Promotes an owned, durable draft into the private persistence skeleton used by
 * transcription and finalization. This does not mark the Living Memory complete.
 *
 * The stable Living Memory persistence ID intentionally reuses the draft ID so
 * retries, recovery, and cross-device reopening cannot create parallel stories.
 */
export async function ensureLivingMemoryFoundation(
  env: LivingMemoryPersistenceEnv,
  draftId: string,
  ownerUserId: string
): Promise<LivingMemoryFoundation> {
  const draft = await env.DB.prepare(
    `SELECT id, owner_user_id, status, created_at
     FROM memory_story_drafts WHERE id = ?`
  ).bind(draftId).first<DraftRow>();

  if (!draft) {
    throw new LivingMemoryPersistenceError("draft_not_found", "That preserved draft was not found.");
  }
  if (!draft.owner_user_id) {
    throw new LivingMemoryPersistenceError("owner_required", "Protect this memory with your account first.");
  }
  if (draft.owner_user_id !== ownerUserId) {
    throw new LivingMemoryPersistenceError("owner_mismatch", "That memory belongs to another archive.");
  }

  const { photo, audio } = await loadDurableOriginals(env, draftId);
  const livingMemoryId = draftId;
  const existing = await env.DB.prepare(
    `SELECT id, owner_user_id, status, primary_photo_asset_id, primary_audio_asset_id
     FROM memory_stories WHERE id = ?`
  ).bind(livingMemoryId).first<StoryRow>();

  if (existing && (
    existing.owner_user_id !== ownerUserId ||
    (existing.primary_photo_asset_id && existing.primary_photo_asset_id !== photo.id) ||
    (existing.primary_audio_asset_id && existing.primary_audio_asset_id !== audio.id)
  )) {
    throw new LivingMemoryPersistenceError(
      "story_conflict",
      "The preserved sources do not match the existing Living Memory."
    );
  }

  if (!existing) {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO memory_stories (
          id, owner_user_id, status, visibility,
          primary_photo_asset_id, primary_audio_asset_id,
          current_transcript_revision_id, current_muse_description_id,
          created_at, completed_at, updated_at, version
        ) VALUES (?, ?, 'draft', 'private', ?, ?, NULL, NULL, ?, NULL, ?, 1)`
      ).bind(livingMemoryId, ownerUserId, photo.id, audio.id, draft.created_at, now),
      env.DB.prepare(
        `UPDATE media_assets
         SET memory_story_id = ?, created_by_user_id = COALESCE(created_by_user_id, ?)
         WHERE draft_id = ?
           AND id IN (?, ?)
           AND durability_status = 'durable'`
      ).bind(livingMemoryId, ownerUserId, draftId, photo.id, audio.id)
    ]);
  } else {
    await env.DB.prepare(
      `UPDATE media_assets
       SET memory_story_id = ?, created_by_user_id = COALESCE(created_by_user_id, ?)
       WHERE draft_id = ?
         AND id IN (?, ?)
         AND durability_status = 'durable'
         AND (memory_story_id IS NULL OR memory_story_id = ?)`
    ).bind(livingMemoryId, ownerUserId, draftId, photo.id, audio.id, livingMemoryId).run();
  }

  return {
    livingMemoryId,
    draftId,
    ownerUserId,
    photoAssetId: photo.id,
    audioAssetId: audio.id,
    audioR2Key: audio.r2_key,
    audioContentType: audio.content_type
  };
}
