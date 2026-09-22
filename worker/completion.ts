import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import {
  ensureLivingMemoryFoundation,
  LivingMemoryPersistenceError,
  type LivingMemoryPersistenceEnv
} from "./living-memory-persistence";

export type CompletionEnv = AuthSessionEnv & LivingMemoryPersistenceEnv;

type StoryRow = {
  id: string;
  owner_user_id: string;
  status: "draft" | "complete";
  completed_at: string | null;
  current_transcript_revision_id: string | null;
};

type ContextRow = {
  id: string;
  kind: "person" | "place" | "time" | "event";
  value: string | null;
  context_state: "stated" | "approximate" | "unknown" | "omitted";
  source_ref: string | null;
  created_at: string;
};

type OperationRow = {
  idempotency_key: string;
  request_hash: string;
  status: "started" | "succeeded" | "failed";
  result_ref: string | null;
};

type EntitlementRow = {
  free_stories_unlocked: number;
  free_stories_completed: number;
};

class CompletionRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const requestHeader = "completion-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,160}$/;
const requiredContextKinds = ["person", "place", "time", "event"] as const;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function validIdentifier(value: string | null, label: string): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new CompletionRouteError(400, "invalid_identifier", `${label} is invalid.`);
  }
  return candidate;
}
function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new CompletionRouteError(403, "csrf", "The completion request could not be verified.");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new CompletionRouteError(403, "origin", "The completion request origin is not allowed.");
  }
}

async function requireOwner(request: Request, env: CompletionEnv): Promise<string> {
  const session = await authenticateAppSession(request, env);
  if (!session) throw new CompletionRouteError(401, "session_required", "Sign in to complete this Living Memory.");
  return session.userId;
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function storyRow(env: CompletionEnv, livingMemoryId: string): Promise<StoryRow> {
  const story = await env.DB.prepare(
    `SELECT id, owner_user_id, status, completed_at, current_transcript_revision_id
     FROM memory_stories WHERE id = ?`
  ).bind(livingMemoryId).first<StoryRow>();
  if (!story) throw new CompletionRouteError(409, "story_not_ready", "The Living Memory is not ready yet.");
  return story;
}

async function latestContext(env: CompletionEnv, livingMemoryId: string): Promise<ContextRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, kind, value, context_state, source_ref, created_at
     FROM living_memory_context_entries
     WHERE memory_story_id = ?
     ORDER BY created_at DESC, rowid DESC`
  ).bind(livingMemoryId).all<ContextRow>();
  const seen = new Set<string>();
  const latest: ContextRow[] = [];
  for (const row of result.results) {
    if (seen.has(row.kind)) continue;
    seen.add(row.kind);
    latest.push(row);
  }
  return latest;
}

function assertContextReviewed(context: readonly ContextRow[]): void {
  const kinds = new Set(context.map((entry) => entry.kind));
  if (!requiredContextKinds.every((kind) => kinds.has(kind))) {
    throw new CompletionRouteError(
      409,
      "context_review_required",
      "Review who, where, when, and what happened. “I don't remember” and “leave this out” are both okay."
    );
  }
}
async function requireCompletionEntitlement(
  env: CompletionEnv,
  userId: string
): Promise<void> {
  const entitlement = await env.DB.prepare(
    `SELECT free_stories_unlocked, free_stories_completed
     FROM story_entitlements WHERE user_id = ?`
  ).bind(userId).first<EntitlementRow>();

  if (!entitlement) {
    throw new CompletionRouteError(
      409,
      "entitlement_missing",
      "Your Living Memory allowance is not ready yet."
    );
  }

  if (entitlement.free_stories_completed >= entitlement.free_stories_unlocked) {
    throw new CompletionRouteError(
      409,
      "living_memory_limit_reached",
      "Your current Living Memory allowance has already been used."
    );
  }
}

async function activationState(
  env: CompletionEnv,
  userId: string,
  livingMemoryId: string
): Promise<boolean> {
  const event = await env.DB.prepare(
    `SELECT memory_story_id
     FROM product_events
     WHERE user_id = ? AND event_name = 'first_living_memory_completed'
     LIMIT 1`
  ).bind(userId).first<{ memory_story_id: string | null }>();
  return event?.memory_story_id === livingMemoryId;
}

async function completionSnapshot(
  request: Request,
  env: CompletionEnv,
  draftId: string
): Promise<Response> {
  const userId = await requireOwner(request, env);
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const story = await storyRow(env, foundation.livingMemoryId);
  const context = await latestContext(env, foundation.livingMemoryId);
  const transcript = story.current_transcript_revision_id
    ? await env.DB.prepare(
        `SELECT id, text, locale, source_audio_asset_id, created_at
         FROM transcript_revisions WHERE id = ? AND memory_story_id = ?`
      ).bind(story.current_transcript_revision_id, foundation.livingMemoryId)
        .first<{
          id: string;
          text: string;
          locale: string;
          source_audio_asset_id: string;
          created_at: string;
        }>()
    : null;
  const muse = await env.DB.prepare(
    `SELECT id, content, source_refs_json, prompt_version, model_config_version
     FROM generated_artifacts
     WHERE memory_story_id = ? AND kind = 'muse_prompt' AND status = 'ready'
     ORDER BY created_at DESC LIMIT 1`
  ).bind(foundation.livingMemoryId)
    .first<{
      id: string;
      content: string;
      source_refs_json: string;
      prompt_version: string;
      model_config_version: string;
    }>();

  return json({
    ok: true,
    livingMemoryId: foundation.livingMemoryId,
    status: story.status,
    completedAt: story.completed_at,
    originals: {
      photo: {
        assetId: foundation.photoAssetId,
        mediaUrl: `/resources/drafts/${encodeURIComponent(draftId)}/media/${encodeURIComponent(foundation.photoAssetId)}`
      },
      audio: {
        assetId: foundation.audioAssetId,
        mediaUrl: `/resources/drafts/${encodeURIComponent(draftId)}/media/${encodeURIComponent(foundation.audioAssetId)}`
      }
    },
    transcript,
    musePrompt: muse
      ? {
          artifactId: muse.id,
          question: muse.content,
          sourceRefs: JSON.parse(muse.source_refs_json) as string[],
          promptVersion: muse.prompt_version,
          modelConfigVersion: muse.model_config_version
        }
      : null,
    context
  });
}
async function finalizeLivingMemory(
  request: Request,
  env: CompletionEnv,
  draftId: string
): Promise<Response> {
  assertMutation(request);
  const userId = await requireOwner(request, env);
  const idempotencyKey = validIdentifier(request.headers.get("X-Idempotency-Key"), "Idempotency key");
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const story = await storyRow(env, foundation.livingMemoryId);

  if (story.status === "complete" && story.completed_at) {
    return json({
      ok: true,
      livingMemoryId: foundation.livingMemoryId,
      completedAt: story.completed_at,
      activationRecorded: await activationState(env, userId, foundation.livingMemoryId),
      replayed: true
    });
  }

  await requireCompletionEntitlement(env, userId);

  const context = await latestContext(env, foundation.livingMemoryId);
  assertContextReviewed(context);
  const contextFingerprint = context
    .slice()
    .sort((left, right) => left.kind.localeCompare(right.kind))
    .map((entry) => [entry.id, entry.kind, entry.context_state, entry.value ?? ""].join(":"))
    .join("|");
  const requestHash = await sha256(
    [
      foundation.livingMemoryId,
      foundation.photoAssetId,
      foundation.audioAssetId,
      contextFingerprint
    ].join("|")
  );

  const existing = await env.DB.prepare(
    `SELECT idempotency_key, request_hash, status, result_ref
     FROM operation_receipts WHERE idempotency_key = ?`
  ).bind(idempotencyKey).first<OperationRow>();
  if (existing && existing.request_hash !== requestHash) {
    throw new CompletionRouteError(
      409,
      "idempotency_conflict",
      "That completion key was already used for a different review state."
    );
  }
  if (existing?.status === "succeeded") {
    const replayStory = await storyRow(env, foundation.livingMemoryId);
    return json({
      ok: true,
      livingMemoryId: foundation.livingMemoryId,
      completedAt: replayStory.completed_at,
      activationRecorded: await activationState(env, userId, foundation.livingMemoryId),
      replayed: true
    });
  }

  const now = new Date().toISOString();
  const correlationId = `complete_${crypto.randomUUID()}`;
  if (existing) {
    await env.DB.prepare(
      `UPDATE operation_receipts
       SET status = 'started', result_ref = NULL, updated_at = ?
       WHERE idempotency_key = ? AND request_hash = ?`
    ).bind(now, idempotencyKey, requestHash).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO operation_receipts (
        idempotency_key, operation_kind, scope_type, scope_id, request_hash,
        status, result_ref, correlation_id, created_at, updated_at
      ) VALUES (?, 'finalize_story', 'story', ?, ?, 'started', NULL, ?, ?, ?)`
    ).bind(
      idempotencyKey,
      foundation.livingMemoryId,
      requestHash,
      correlationId,
      now,
      now
    ).run();
  }
  const activationHash = await sha256(`${userId}|first_living_memory_completed`);
  const activationId = `product_event_${activationHash.slice(0, 40)}`;
  const activationKey = `activation_${activationHash.slice(0, 48)}`;

  try {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE memory_stories
         SET status = 'complete', visibility = 'private', completed_at = ?,
             updated_at = ?, version = version + 1
         WHERE id = ? AND owner_user_id = ? AND status = 'draft'`
      ).bind(now, now, foundation.livingMemoryId, userId),
      env.DB.prepare(
        `UPDATE memory_story_drafts
         SET status = 'complete', updated_at = ?, version = version + 1
         WHERE id = ? AND owner_user_id = ?`
      ).bind(now, draftId, userId),
      env.DB.prepare(
        `UPDATE operation_receipts
         SET status = 'succeeded', result_ref = ?, updated_at = ?
         WHERE idempotency_key = ? AND request_hash = ?`
      ).bind(foundation.livingMemoryId, now, idempotencyKey, requestHash),
      env.DB.prepare(
        `INSERT OR IGNORE INTO product_events (
          id, event_name, user_id, memory_story_id, session_id,
          referral_id, share_channel, idempotency_key, occurred_at
        ) VALUES (?, 'first_living_memory_completed', ?, ?, NULL, NULL, NULL, ?, ?)`
      ).bind(activationId, userId, foundation.livingMemoryId, activationKey, now)
    ]);
  } catch (error) {
    await env.DB.prepare(
      `UPDATE operation_receipts SET status = 'failed', updated_at = ?
       WHERE idempotency_key = ? AND request_hash = ?`
    ).bind(new Date().toISOString(), idempotencyKey, requestHash).run().catch(() => undefined);

    if (String(error).includes("available story entitlement")) {
      throw new CompletionRouteError(
        409,
        "living_memory_limit_reached",
        "Your current Living Memory allowance has already been used."
      );
    }
    throw error;
  }

  return json({
    ok: true,
    livingMemoryId: foundation.livingMemoryId,
    completedAt: now,
    activationRecorded: await activationState(env, userId, foundation.livingMemoryId),
    replayed: false
  }, 201);
}
export async function handleCompletionRoute(
  request: Request,
  env: CompletionEnv
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(
    /^\/resources\/drafts\/([^/]+)\/living-memory$/
  );
  if (!match?.[1]) return null;
  const draftId = validIdentifier(decodeURIComponent(match[1]), "Draft ID");

  try {
    if (request.method === "GET") {
      return await completionSnapshot(request, env, draftId);
    }
    if (request.method === "POST") {
      return await finalizeLivingMemory(request, env, draftId);
    }
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    if (error instanceof LivingMemoryPersistenceError) {
      const status = error.code === "draft_not_found" ? 404
        : error.code === "owner_required" ? 401
          : error.code === "owner_mismatch" ? 403
            : 409;
      return json({ ok: false, error: { code: error.code, message: error.message } }, status);
    }
    const routeError = error instanceof CompletionRouteError
      ? error
      : new CompletionRouteError(500, "internal", "The Living Memory could not be completed.");
    return json({
      ok: false,
      error: { code: routeError.code, message: routeError.message }
    }, routeError.status);
  }
}
