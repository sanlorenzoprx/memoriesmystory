import {
  authenticateAppSession,
  sha256Text,
  type AuthSessionEnv
} from "./auth-session";

export type DeletionEnv = AuthSessionEnv & {
  readonly MEDIA_BUCKET: R2Bucket;
};

type DraftRow = {
  id: string;
  owner_user_id: string | null;
  anonymous_identity_hash: string | null;
};

type StoryRow = {
  id: string;
  status: "draft" | "complete";
};

type AssetRow = {
  id: string;
  r2_key: string;
};

class DeletionRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const requestHeader = "deletion-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,160}$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function validIdentifier(value: string | null, label: string): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new DeletionRouteError(400, "invalid_identifier", `${label} is invalid.`);
  }
  return candidate;
}

function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new DeletionRouteError(403, "csrf", "The delete request could not be verified.");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new DeletionRouteError(403, "origin", "The delete request origin is not allowed.");
  }
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function authorizeDeletion(
  request: Request,
  env: DeletionEnv,
  draftId: string
): Promise<{
  readonly draft: DraftRow;
  readonly ownerUserId: string | null;
  readonly actorType: "owner" | "anonymous";
}> {
  const draft = await env.DB.prepare(
    "SELECT id, owner_user_id, anonymous_identity_hash FROM memory_story_drafts WHERE id = ?"
  )
    .bind(draftId)
    .first<DraftRow>();

  if (!draft) {
    throw new DeletionRouteError(404, "not_found", "That memory was not found.");
  }

  const session = await authenticateAppSession(request, env);
  if (draft.owner_user_id) {
    if (!session || session.userId !== draft.owner_user_id) {
      throw new DeletionRouteError(403, "owner_required", "Sign in to delete this memory.");
    }
    return {
      draft,
      ownerUserId: session.userId,
      actorType: "owner"
    };
  }

  const token = request.headers.get("X-Draft-Token")?.trim() ?? "";
  if (!draft.anonymous_identity_hash || token.length < 32 || token.length > 256) {
    throw new DeletionRouteError(403, "draft_scope", "This local draft could not be verified.");
  }
  const tokenHash = await sha256Text(token);
  if (!safeEqual(draft.anonymous_identity_hash, tokenHash)) {
    throw new DeletionRouteError(403, "draft_scope", "This local draft could not be verified.");
  }

  return {
    draft,
    ownerUserId: null,
    actorType: "anonymous"
  };
}

async function deleteMemory(
  request: Request,
  env: DeletionEnv,
  draftId: string
): Promise<Response> {
  assertMutation(request);
  const authorization = await authorizeDeletion(request, env, draftId);
  const story = await env.DB.prepare(
    "SELECT id, status FROM memory_stories WHERE id = ?"
  ).bind(draftId).first<StoryRow>();

  if(story)await env.DB.prepare("UPDATE legacy_sessions SET status='closed',deletion_requested_at=COALESCE(deletion_requested_at,?),consent_epoch=consent_epoch+1,version=version+1 WHERE memory_story_id=? AND deletion_requested_at IS NULL").bind(new Date().toISOString(),story.id).run();
  const assets = await env.DB.prepare(
    "SELECT id, r2_key FROM media_assets WHERE draft_id = ? ORDER BY created_at DESC"
  ).bind(draftId).all<AssetRow>();
  const voiceReplies = story
    ? await env.DB.prepare(
        "SELECT id, r2_key FROM muse_voice_reply_assets WHERE memory_story_id = ? ORDER BY created_at DESC"
      ).bind(story.id).all<AssetRow>()
    : { results: [] as AssetRow[] };
  const recordings=story ? await env.DB.prepare("SELECT r.id,m.r2_key FROM legacy_recordings r JOIN legacy_recording_media m ON m.recording_id=r.id WHERE r.session_id IN (SELECT id FROM legacy_sessions WHERE memory_story_id=?)").bind(story.id).all<AssetRow>() : {results:[] as AssetRow[]};
  const allAssets = [...assets.results, ...voiceReplies.results,...recordings.results];
  const revisions = story ? await env.DB.prepare(
    "SELECT id, parent_revision_id FROM transcript_revisions WHERE memory_story_id = ?"
  ).bind(story.id).all<{ id: string; parent_revision_id: string | null }>() : { results: [] };
  // Parent revisions use ON DELETE RESTRICT. Delete leaves first in the same
  // transaction as the memory, rather than relying on cascade row order.
  const parents = new Map(revisions.results.map((row) => [row.id, row.parent_revision_id]));
  const children = new Map(revisions.results.map((row) => [row.id, 0]));
  for (const parent of parents.values()) if (parent && children.has(parent)) children.set(parent, children.get(parent)! + 1);
  const leaves = [...children].filter(([, count]) => count === 0).map(([id]) => id);
  const deletionOrder: string[] = [];
  while (leaves.length) {
    const id = leaves.pop()!;
    deletionOrder.push(id);
    const parent = parents.get(id);
    if (parent && children.has(parent)) {
      const remaining = children.get(parent)! - 1;
      children.set(parent, remaining);
      if (remaining === 0) leaves.push(parent);
    }
  }
  if (deletionOrder.length !== revisions.results.length) {
    throw new DeletionRouteError(409, "revision_cleanup_required", "This memory's revision history needs repair before it can be deleted. No media was removed.");
  }

  try {
    for (const asset of allAssets) {
      await env.MEDIA_BUCKET.delete(asset.r2_key);
    }
  } catch {
    throw new DeletionRouteError(
      503,
      "media_delete_failed",
      "The memory could not be fully deleted right now. Nothing else was removed; please try again."
    );
  }

  const deletedAt = new Date().toISOString();
  const receiptId = `deletion_${crypto.randomUUID()}`;
  const statements = [];

  for (const asset of allAssets) {
    statements.push(
      env.DB.prepare(
        "DELETE FROM operation_receipts WHERE scope_type = 'asset' AND scope_id = ?"
      ).bind(asset.id)
    );
  }

  if (story) {
    for (const revisionId of deletionOrder) statements.push(env.DB.prepare(
      "DELETE FROM transcript_revisions WHERE id = ? AND memory_story_id = ?"
    ).bind(revisionId, story.id));
    statements.push(
      env.DB.prepare(
        "DELETE FROM operation_receipts WHERE scope_id IN (SELECT id FROM muse_voice_reply_assets WHERE memory_story_id = ?)"
      ).bind(story.id),
      env.DB.prepare(
        "UPDATE media_assets SET memory_story_id = NULL WHERE draft_id = ?"
      ).bind(draftId),
      env.DB.prepare(
        "DELETE FROM memory_stories WHERE id = ?"
      ).bind(story.id)
    );
    if (story.status === "complete" && authorization.ownerUserId) {
      statements.push(
        env.DB.prepare(
          `UPDATE story_entitlements
           SET free_stories_completed = CASE
                 WHEN free_stories_completed > 0 THEN free_stories_completed - 1
                 ELSE 0
               END,
               updated_at = ?
           WHERE user_id = ?`
        ).bind(deletedAt, authorization.ownerUserId)
      );
    }
  }

  statements.push(
    env.DB.prepare(
      "DELETE FROM operation_receipts WHERE scope_id IN (SELECT id FROM media_assets WHERE draft_id = ?)"
    ).bind(draftId),
    env.DB.prepare(
      "DELETE FROM media_assets WHERE draft_id = ? AND role NOT IN ('original_photo', 'original_audio')"
    ).bind(draftId),
    env.DB.prepare(
      "DELETE FROM media_assets WHERE draft_id = ?"
    ).bind(draftId),
    env.DB.prepare(
      "DELETE FROM agreement_acceptances WHERE draft_id = ?"
    ).bind(draftId),
    env.DB.prepare(
      "DELETE FROM draft_ownership_claims WHERE draft_id = ?"
    ).bind(draftId),
    env.DB.prepare(
      "DELETE FROM operation_receipts WHERE scope_id = ?"
    ).bind(draftId),
    env.DB.prepare(
      "DELETE FROM memory_story_drafts WHERE id = ?"
    ).bind(draftId),
    env.DB.prepare(
      `INSERT INTO deletion_receipts (
        id, draft_id, memory_story_id, owner_user_id, actor_type,
        deleted_asset_count, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      receiptId,
      draftId,
      story?.id ?? null,
      authorization.ownerUserId,
      authorization.actorType,
      allAssets.length,
      deletedAt
    )
  );

  try {
    await env.DB.batch(statements);
  } catch {
    throw new DeletionRouteError(
      500,
      "delete_record_failed",
      "The stored media was removed, but the archive record still needs cleanup. Please retry deletion."
    );
  }

  return json({
    ok: true,
    deleted: true,
    draftId,
    deletedAt
  });
}

export async function handleDeletionRoute(
  request: Request,
  env: DeletionEnv
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/resources\/drafts\/([^/]+)$/);
  if (!match?.[1]) return null;
  if (request.method !== "DELETE") return null;

  const draftId = validIdentifier(decodeURIComponent(match[1]), "Draft ID");

  try {
    return await deleteMemory(request, env, draftId);
  } catch (error) {
    const routeError = error instanceof DeletionRouteError
      ? error
      : new DeletionRouteError(500, "internal", "The memory could not be deleted.");
    return json(
      { ok: false, error: { code: routeError.code, message: routeError.message } },
      routeError.status
    );
  }
}
