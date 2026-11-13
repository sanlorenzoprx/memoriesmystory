import { storyContextKinds, storyContextStates, validateStoryContext, type StoryContextInput } from "../app/domain";
import { readBoundedText, RequestBodyTooLarge } from "./request-body";
import { phase1Config } from "../config/phase-1";
import { authenticateAppSession, sha256Text, type AuthSessionEnv } from "./auth-session";
import { ensureLivingMemoryFoundation, LivingMemoryPersistenceError } from "./living-memory-persistence";

export type StoryReviewEnv = AuthSessionEnv & { readonly STORY_REVIEW_WRITES_PAUSED?: string };
class ReviewError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
function identifier(value: string | null) {
  if (!value || !/^[A-Za-z0-9_-]{8,180}$/.test(value)) throw new ReviewError(400, "invalid_identifier", "This review request is invalid.");
  return value;
}
function mutation(request: Request) {
  if (request.headers.get("X-Memories-Request") !== "story-review-v1" ||
    (request.headers.has("Origin") && request.headers.get("Origin") !== new URL(request.url).origin)) {
    throw new ReviewError(403, "csrf", "The review request could not be verified.");
  }
}
function parseContext(value: unknown): StoryContextInput[] {
  if (!Array.isArray(value) || value.length > 4) throw new ReviewError(400, "invalid_context", "Choose up to four optional details.");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new ReviewError(400, "invalid_context", "A story detail is invalid.");
    const row = item as Record<string, unknown>;
    if (!storyContextKinds.includes(row.kind as StoryContextInput["kind"]) ||
      !storyContextStates.includes(row.state as StoryContextInput["state"]) || seen.has(String(row.kind)) ||
      (row.value !== null && typeof row.value !== "string") ||
      (typeof row.value === "string" && row.value.length > phase1Config.review.maxContextCharacters)) {
      throw new ReviewError(400, "invalid_context", "A story detail is invalid or too long.");
    }
    seen.add(String(row.kind));
    try {
      return validateStoryContext({ kind: row.kind as StoryContextInput["kind"], state: row.state as StoryContextInput["state"], value: row.value as string | null });
    } catch {
      throw new ReviewError(400, "invalid_context", "Stated details need your words; unknown or omitted details stay blank.");
    }
  }).sort((a, b) => a.kind.localeCompare(b.kind));
}

async function saveReview(request: Request, env: StoryReviewEnv, draftId: string, userId: string) {
  mutation(request);
  const key = identifier(request.headers.get("X-Idempotency-Key"));
  const text = await readBoundedText(request, 100_000);
  let body: { expectedVersion?: unknown; transcriptText?: unknown; context?: unknown };
  try { body = JSON.parse(text); } catch { throw new ReviewError(400, "invalid_review", "The review could not be read."); }
  if (!body || !Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1 ||
    (body.transcriptText !== null && typeof body.transcriptText !== "string")) {
    throw new ReviewError(400, "invalid_review", "Reopen this memory before saving your details.");
  }
  const transcriptText = typeof body.transcriptText === "string" ? body.transcriptText.trim() : null;
  if (transcriptText !== null && (!transcriptText || transcriptText.length > phase1Config.review.maxTranscriptCharacters)) {
    throw new ReviewError(400, "invalid_transcript", "Your transcript cannot be empty or longer than the supported review limit.");
  }
  const context = parseContext(body.context);
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const id = `review_${(await sha256Text(`${userId}|${draftId}|${key}`)).slice(0, 48)}`;
  const requestHash = await sha256Text(JSON.stringify({ expectedVersion: body.expectedVersion, transcriptText, context }));
  const existing = await env.DB.prepare("SELECT request_hash FROM living_memory_reviews WHERE id = ? AND memory_story_id = ?")
    .bind(id, draftId).first<{ request_hash: string }>();
  if (existing) {
    if (existing.request_hash !== requestHash) throw new ReviewError(409, "idempotency_conflict", "That retry belongs to a different edit. Reopen the latest details.");
    return json({ reviewId: id, replayed: true });
  }
  const story = await env.DB.prepare("SELECT version, current_transcript_revision_id FROM memory_stories WHERE id = ? AND owner_user_id = ?")
    .bind(draftId, userId).first<{ version: number; current_transcript_revision_id: string | null }>();
  if (!story || story.version !== body.expectedVersion) throw new ReviewError(409, "review_conflict", "This memory changed on another device. Your unsaved edits are still here; reopen the latest details before saving.");
  const original = story.current_transcript_revision_id ? await env.DB.prepare(
    "SELECT id, text, locale FROM transcript_revisions WHERE id = ? AND memory_story_id = ? AND source_audio_asset_id = ?"
  ).bind(story.current_transcript_revision_id, draftId, foundation.audioAssetId).first<{ id: string; text: string; locale: string }>() : null;
  if (transcriptText !== null && !original) throw new ReviewError(409, "transcript_not_ready", "Your original voice is safe. Its transcript is not ready to edit yet.");
  const correctedId = original && transcriptText !== null && transcriptText !== original.text ? `transcript_${id}` : null;
  const nextTranscriptId = correctedId ?? original?.id ?? null;
  const prior = await env.DB.prepare(`SELECT kind, value, context_state AS state FROM living_memory_context_entries
    WHERE memory_story_id = ? ORDER BY created_at DESC, rowid DESC`).bind(draftId).all<StoryContextInput>();
  const effective = new Map<string, StoryContextInput>();
  for (const entry of prior.results) if (!effective.has(entry.kind)) effective.set(entry.kind, entry);
  for (const entry of context) effective.set(entry.kind, entry);
  const reviewedContext = [...effective.values()].sort((a, b) => a.kind.localeCompare(b.kind));
  const now = new Date().toISOString();
  const statements = [env.DB.prepare(`INSERT INTO living_memory_reviews
    (id, memory_story_id, kind, created_by_user_id, base_story_version, request_hash,
     source_photo_asset_id, source_audio_asset_id, transcript_revision_id, context_json, created_at)
    VALUES (?, ?, 'edit', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, draftId, userId, body.expectedVersion, requestHash, foundation.photoAssetId, foundation.audioAssetId, nextTranscriptId, JSON.stringify(reviewedContext), now)];
  if (correctedId && original) statements.push(env.DB.prepare(`INSERT INTO transcript_revisions
    (id, memory_story_id, source_audio_asset_id, parent_revision_id, revision_kind, text, locale, created_by_type, created_by_user_id, model_config_version, created_at)
    VALUES (?, ?, ?, ?, 'corrected_transcript', ?, ?, 'user', ?, NULL, ?)`)
    .bind(correctedId, draftId, foundation.audioAssetId, original.id, transcriptText, original.locale, userId, now));
  for (const entry of context) statements.push(env.DB.prepare(`INSERT INTO living_memory_context_entries
    (id, memory_story_id, kind, value, context_state, source_type, source_ref, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'storyteller', ?, ?, ?, ?)`)
    .bind(`${id}_${entry.kind}`, draftId, entry.kind, entry.value, entry.state, `review:${id}`, userId, now, now));
  statements.push(env.DB.prepare(`UPDATE memory_stories SET current_transcript_revision_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND owner_user_id = ?`)
    .bind(nextTranscriptId, now, draftId, userId));
  try { await env.DB.batch(statements); }
  catch (error) {
    // A raced retry may have committed the same review while this request waited.
    const winner = await env.DB.prepare("SELECT request_hash FROM living_memory_reviews WHERE id = ? AND memory_story_id = ?")
      .bind(id, draftId).first<{ request_hash: string }>();
    if (winner?.request_hash === requestHash) return json({ reviewId: id, replayed: true });
    if (String(error).includes("story review version conflict") || String(error).includes("UNIQUE constraint")) {
      throw new ReviewError(409, "review_conflict", "This memory changed. Keep your unsaved words and reopen the latest details before saving.");
    }
    throw error;
  }
  return json({ reviewId: id, replayed: false }, 201);
}

async function history(request: Request, env: StoryReviewEnv, draftId: string, userId: string) {
  await ensureLivingMemoryFoundation(env, draftId, userId);
  const before = new URL(request.url).searchParams.get("before");
  if (before !== null && (!/^[1-9][0-9]*$/.test(before) || !Number.isSafeInteger(Number(before)))) throw new ReviewError(400, "invalid_cursor", "Refresh the revision history and try again.");
  const limit = phase1Config.review.historyPageSize;
  const rows = await env.DB.prepare(`SELECT r.id, r.kind, r.base_story_version, r.created_by_user_id, r.created_at,
      r.source_photo_asset_id, r.source_audio_asset_id, r.transcript_revision_id, r.context_json, tr.text, tr.locale
    FROM living_memory_reviews r
    LEFT JOIN transcript_revisions tr ON tr.id = r.transcript_revision_id AND tr.memory_story_id = r.memory_story_id
    WHERE r.memory_story_id = ? AND (? IS NULL OR r.base_story_version < ?)
    ORDER BY r.base_story_version DESC LIMIT ?`)
    .bind(draftId, before, before ? Number(before) : null, limit + 1).all<{
      id: string; kind: string; base_story_version: number; created_by_user_id: string; created_at: string;
      source_photo_asset_id: string; source_audio_asset_id: string; transcript_revision_id: string | null;
      context_json: string; text: string | null; locale: string | null;
    }>();
  const original = await env.DB.prepare(`SELECT id, text, locale, created_at FROM transcript_revisions
    WHERE memory_story_id = ? AND revision_kind = 'machine_transcript' ORDER BY created_at, rowid LIMIT 1`)
    .bind(draftId).first();
  const page = rows.results.slice(0, limit);
  return json({ originalTranscript: original, revisions: page.map((row) => ({
    reviewId: row.id, kind: row.kind, baseVersion: row.base_story_version, authorId: row.created_by_user_id,
    createdAt: row.created_at, photoAssetId: row.source_photo_asset_id, audioAssetId: row.source_audio_asset_id,
    transcriptRevisionId: row.transcript_revision_id, transcriptText: row.text, locale: row.locale,
    context: JSON.parse(row.context_json)
  })), nextCursor: rows.results.length > limit ? String(page.at(-1)!.base_story_version) : null });
}

export async function handleStoryReviewRoute(request: Request, env: StoryReviewEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/resources\/drafts\/([^/]+)\/review$/);
  if (!match) return null;
  try {
    const draftId = identifier(decodeURIComponent(match[1]!));
    const session = await authenticateAppSession(request, env);
    if (!session) throw new ReviewError(401, "session_required", "Sign in to review this Living Memory.");
    if (request.method === "GET") return await history(request, env, draftId, session.userId);
    if (request.method === "PUT") {
      if (env.STORY_REVIEW_WRITES_PAUSED === "true") throw new ReviewError(503, "review_paused", "Detail changes are temporarily paused. Your originals and saved revisions remain available; keep your unsaved words and try again later.");
      return await saveReview(request, env, draftId, session.userId);
    }
    throw new ReviewError(405, "method", "Method not allowed.");
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return json({ error: { code: "review_too_large", message: "This review is too large." } }, 413);
    if (error instanceof LivingMemoryPersistenceError) return json({ error: { code: error.code, message: error.message } }, error.code === "draft_not_found" || error.code === "owner_mismatch" ? 404 : 409);
    const failure = error instanceof ReviewError ? error : new ReviewError(500, "review_failed", "Your changes could not be saved. Keep your words here and try again.");
    return json({ error: { code: failure.code, message: failure.message } }, failure.status);
  }
}
