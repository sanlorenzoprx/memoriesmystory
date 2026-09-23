import { phase1Config } from "../config/phase-1";
import {
  asId,
  type DraftId,
  type IdempotencyKey,
  type LivingMemoryId,
  type MediaAssetId,
  type TranscriptionQueueMessage,
  type UserId
} from "../app/domain";
import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import {
  ensureLivingMemoryFoundation,
  LivingMemoryPersistenceError,
  type LivingMemoryPersistenceEnv
} from "./living-memory-persistence";
import {
  createTranscriptionProvider,
  type TranscriptionProviderEnv
} from "./providers/transcription-provider";

export type TranscriptionEnv = AuthSessionEnv &
  LivingMemoryPersistenceEnv &
  TranscriptionProviderEnv & {
    readonly MEDIA_BUCKET: R2Bucket;
    readonly PROCESSING_QUEUE: Queue<TranscriptionQueueMessage>;
  };

type OperationRow = {
  idempotency_key: string;
  request_hash: string;
  status: "started" | "succeeded" | "failed";
  result_ref: string | null;
  correlation_id: string;
};

type TranscriptRow = {
  id: string;
  text: string;
  locale: string;
  source_audio_asset_id: string;
  created_at: string;
};

class TranscriptionRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const requestHeader = "processing-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,160}$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new TranscriptionRouteError(403, "csrf", "The processing request could not be verified.");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new TranscriptionRouteError(403, "origin", "The processing origin is not allowed.");
  }
}

function validIdentifier(value: string | null, label: string): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new TranscriptionRouteError(400, "invalid_identifier", `${label} is invalid.`);
  }
  return candidate;
}

async function requireOwner(request: Request, env: TranscriptionEnv): Promise<string> {
  const session = await authenticateAppSession(request, env);
  if (!session) {
    throw new TranscriptionRouteError(401, "session_required", "Sign in to continue this Living Memory.");
  }
  return session.userId;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function audioFileName(contentType: string): string {
  const extension = contentType.includes("webm")
    ? "webm"
    : contentType.includes("mp4")
      ? "mp4"
      : contentType.includes("mpeg")
        ? "mp3"
        : contentType.includes("wav")
          ? "wav"
          : contentType.includes("ogg")
            ? "ogg"
            : "bin";
  return `memory-audio.${extension}`;
}
async function latestOperation(
  env: TranscriptionEnv,
  livingMemoryId: string
): Promise<OperationRow | null> {
  return env.DB.prepare(
    `SELECT idempotency_key, request_hash, status, result_ref, correlation_id
     FROM operation_receipts
     WHERE operation_kind = 'queue_transcription'
       AND scope_type = 'story'
       AND scope_id = ?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(livingMemoryId).first<OperationRow>();
}

async function currentTranscript(
  env: TranscriptionEnv,
  livingMemoryId: string
): Promise<TranscriptRow | null> {
  return env.DB.prepare(
    `SELECT tr.id, tr.text, tr.locale, tr.source_audio_asset_id, tr.created_at
     FROM memory_stories ms
     JOIN transcript_revisions tr ON tr.id = ms.current_transcript_revision_id
     WHERE ms.id = ?`
  ).bind(livingMemoryId).first<TranscriptRow>();
}

async function processingStatus(
  request: Request,
  env: TranscriptionEnv,
  draftId: string
): Promise<Response> {
  const userId = await requireOwner(request, env);
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const transcript = await currentTranscript(env, foundation.livingMemoryId);
  if (transcript) {
    return json({
      ok: true,
      state: "ready",
      livingMemoryId: foundation.livingMemoryId,
      transcript: {
        revisionId: transcript.id,
        text: transcript.text,
        locale: transcript.locale,
        sourceAudioAssetId: transcript.source_audio_asset_id,
        createdAt: transcript.created_at
      }
    });
  }

  const operation = await latestOperation(env, foundation.livingMemoryId);
  const state = operation?.status === "started"
    ? "processing"
    : operation?.status === "failed"
      ? "failed"
      : "not_requested";
  return json({
    ok: true,
    state,
    livingMemoryId: foundation.livingMemoryId,
    transcript: null,
    retryable: state === "failed"
  });
}
async function enqueueTranscription(
  request: Request,
  env: TranscriptionEnv,
  draftId: string
): Promise<Response> {
  assertMutation(request);
  const userId = await requireOwner(request, env);
  const idempotencyKey = validIdentifier(request.headers.get("X-Idempotency-Key"), "Idempotency key");
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);

  const ready = await currentTranscript(env, foundation.livingMemoryId);
  if (ready) {
    return json({
      ok: true,
      state: "ready",
      replayed: true,
      livingMemoryId: foundation.livingMemoryId,
      transcriptRevisionId: ready.id
    });
  }

  const requestHash = await sha256(
    [foundation.livingMemoryId, foundation.audioAssetId, phase1Config.ai.modelConfigVersion].join("|")
  );
  const existing = await env.DB.prepare(
    `SELECT idempotency_key, request_hash, status, result_ref, correlation_id
     FROM operation_receipts WHERE idempotency_key = ?`
  ).bind(idempotencyKey).first<OperationRow>();

  if (existing && existing.request_hash !== requestHash) {
    throw new TranscriptionRouteError(
      409,
      "idempotency_conflict",
      "That processing key was already used for a different request."
    );
  }
  if (existing?.status === "succeeded") {
    return json({
      ok: true,
      state: "ready",
      replayed: true,
      livingMemoryId: foundation.livingMemoryId,
      transcriptRevisionId: existing.result_ref
    });
  }
  if (existing?.status === "started") {
    return json({
      ok: true,
      state: "processing",
      replayed: true,
      livingMemoryId: foundation.livingMemoryId
    }, 202);
  }

  const now = new Date().toISOString();
  const correlationId = existing?.correlation_id ?? `transcription_${crypto.randomUUID()}`;
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
      ) VALUES (?, 'queue_transcription', 'story', ?, ?, 'started', NULL, ?, ?, ?)`
    ).bind(idempotencyKey, foundation.livingMemoryId, requestHash, correlationId, now, now).run();
  }
  const message: TranscriptionQueueMessage = {
    version: 1,
    draftId: asId<DraftId>(draftId),
    livingMemoryId: asId<LivingMemoryId>(foundation.livingMemoryId),
    audioAssetId: asId<MediaAssetId>(foundation.audioAssetId),
    requestedByUserId: asId<UserId>(userId),
    idempotencyKey: asId<IdempotencyKey>(idempotencyKey),
    localeHint: request.headers.get("X-Spoken-Locale")?.trim() || null
  };

  try {
    await env.PROCESSING_QUEUE.send(message);
    await env.DB.prepare(
      `UPDATE memory_story_drafts
       SET status = 'processing', updated_at = ?, version = version + 1
       WHERE id = ? AND owner_user_id = ?`
    ).bind(now, draftId, userId).run();
  } catch {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE operation_receipts SET status = 'failed', updated_at = ?
         WHERE idempotency_key = ? AND request_hash = ?`
      ).bind(new Date().toISOString(), idempotencyKey, requestHash),
      env.DB.prepare(
        `UPDATE memory_story_drafts
         SET status = 'review_partial', updated_at = ?, version = version + 1
         WHERE id = ? AND owner_user_id = ?`
      ).bind(new Date().toISOString(), draftId, userId)
    ]);
    throw new TranscriptionRouteError(
      503,
      "queue_unavailable",
      "Your photograph and voice are preserved. Transcription can be retried."
    );
  }

  return json({
    ok: true,
    state: "processing",
    replayed: false,
    livingMemoryId: foundation.livingMemoryId
  }, 202);
}

export async function handleTranscriptionRoute(
  request: Request,
  env: TranscriptionEnv
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/resources\/drafts\/([^/]+)\/process$/);
  if (!match?.[1]) return null;
  const draftId = validIdentifier(decodeURIComponent(match[1]), "Draft ID");

  try {
    if (request.method === "POST") return await enqueueTranscription(request, env, draftId);
    if (request.method === "GET") return await processingStatus(request, env, draftId);
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    if (error instanceof LivingMemoryPersistenceError) {
      const status = error.code === "draft_not_found" ? 404
        : error.code === "owner_required" ? 401
          : error.code === "owner_mismatch" ? 403
            : 409;
      return json({ ok: false, error: { code: error.code, message: error.message } }, status);
    }
    const routeError = error instanceof TranscriptionRouteError
      ? error
      : new TranscriptionRouteError(500, "internal", "Transcription could not be prepared.");
    return json({ ok: false, error: { code: routeError.code, message: routeError.message } }, routeError.status);
  }
}
export async function processTranscriptionMessage(
  env: TranscriptionEnv,
  message: TranscriptionQueueMessage
): Promise<string> {
  const foundation = await ensureLivingMemoryFoundation(
    env,
    message.draftId,
    message.requestedByUserId
  );
  if (
    foundation.livingMemoryId !== message.livingMemoryId ||
    foundation.audioAssetId !== message.audioAssetId
  ) {
    throw new Error("Transcription message source scope no longer matches the Living Memory.");
  }

  const existingTranscript = await currentTranscript(env, foundation.livingMemoryId);
  if (existingTranscript) {
    await env.DB.prepare(
      `UPDATE operation_receipts
       SET status = 'succeeded', result_ref = ?, updated_at = ?
       WHERE idempotency_key = ?`
    ).bind(existingTranscript.id, new Date().toISOString(), message.idempotencyKey).run();
    return existingTranscript.id;
  }

  const audio = await env.MEDIA_BUCKET.get(foundation.audioR2Key);
  if (!audio) throw new Error("The durable original audio object is temporarily unavailable.");
  const bytes = new Uint8Array(await audio.arrayBuffer());

  const provider = createTranscriptionProvider(env);
  const transcription = await provider.transcribe({
    audio: bytes,
    contentType: foundation.audioContentType,
    fileName: audioFileName(foundation.audioContentType)
  });
  const now = new Date().toISOString();
  const transcriptHash = await sha256(String(message.idempotencyKey));
  const transcriptId = `transcript_${transcriptHash.slice(0, 48)}`;
  const locale = transcription.locale || message.localeHint || "und";

  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO transcript_revisions (
        id, memory_story_id, source_audio_asset_id, parent_revision_id,
        revision_kind, text, locale, created_by_type, created_by_user_id,
        model_config_version, created_at
      ) VALUES (?, ?, ?, NULL, 'machine_transcript', ?, ?, 'machine', NULL, ?, ?)`
    ).bind(
      transcriptId,
      foundation.livingMemoryId,
      foundation.audioAssetId,
      transcription.text,
      locale,
      phase1Config.ai.modelConfigVersion,
      now
    ),
    env.DB.prepare(
      `UPDATE memory_stories
       SET current_transcript_revision_id = COALESCE(current_transcript_revision_id, ?),
           updated_at = ?, version = version + 1
       WHERE id = ? AND owner_user_id = ?`
    ).bind(transcriptId, now, foundation.livingMemoryId, foundation.ownerUserId),
    env.DB.prepare(
      `UPDATE operation_receipts
       SET status = 'succeeded', result_ref = ?, updated_at = ?
       WHERE idempotency_key = ?`
    ).bind(transcriptId, now, message.idempotencyKey),
    env.DB.prepare(
      `UPDATE memory_story_drafts
       SET status = 'review_partial', updated_at = ?, version = version + 1
       WHERE id = ? AND owner_user_id = ?`
    ).bind(now, foundation.draftId, foundation.ownerUserId)
  ]);

  return transcriptId;
}
function safeTranscriptionFailureCode(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  if (error.message === "ELEVENLABS_API_KEY is required for transcription.") {
    return "provider_key_missing";
  }
  if (error.message === "ElevenLabs transcription request body could not be prepared.") {
    return "provider_request_body";
  }
  if (error.message === "ElevenLabs transcription transport failed.") {
    return "provider_transport";
  }
  const providerHttp = error.message.match(/^ElevenLabs transcription failed with HTTP (\d{3})\.$/);
  if (providerHttp?.[1]) return `provider_http_${providerHttp[1]}`;
  if (error.message.includes("durable original audio object")) return "source_audio_unavailable";
  if (error.message.includes("source scope no longer matches")) return "source_scope_mismatch";
  return "internal";
}

export async function processTranscriptionBatch(
  batch: MessageBatch<TranscriptionQueueMessage>,
  env: TranscriptionEnv
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processTranscriptionMessage(env, message.body);
      message.ack();
    } catch (error) {
      const now = new Date().toISOString();
      const body = message.body;
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE operation_receipts
           SET status = 'failed', updated_at = ?
           WHERE idempotency_key = ?`
        ).bind(now, body.idempotencyKey),
        env.DB.prepare(
          `UPDATE memory_story_drafts
           SET status = 'review_partial', updated_at = ?, version = version + 1
           WHERE id = ? AND owner_user_id = ?`
        ).bind(now, body.draftId, body.requestedByUserId)
      ]).catch(() => undefined);

      console.error("Living Memory transcription attempt failed", {
        draftId: body.draftId,
        livingMemoryId: body.livingMemoryId,
        attempt: message.attempts,
        errorType: error instanceof Error ? error.name : "unknown",
        errorCode: safeTranscriptionFailureCode(error)
      });
      message.retry();
    }
  }
}
