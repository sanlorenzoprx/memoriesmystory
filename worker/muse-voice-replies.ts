import { phase1Config } from "../config/phase-1";
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

export type MuseVoiceReplyEnv = AuthSessionEnv &
  LivingMemoryPersistenceEnv &
  TranscriptionProviderEnv & {
    readonly MEDIA_BUCKET: R2Bucket;
  };

type MuseTurnRow = {
  id: string;
  speaker: "muse" | "storyteller";
};

type VoiceReplyRow = {
  id: string;
  memory_story_id: string;
  reply_to_turn_id: string;
  r2_key: string;
  content_type: string;
  byte_size: number;
  duration_ms: number;
  sha256: string;
  r2_etag: string | null;
  durability_status: "pending" | "durable" | "failed";
  transcript_text: string | null;
  transcript_locale: string | null;
  transcription_model_config_version: string | null;
  storyteller_text: string | null;
  storyteller_confirmed_at: string | null;
  created_by_user_id: string;
  created_at: string;
  transcribed_at: string | null;
};

type OperationRow = {
  idempotency_key: string;
  request_hash: string;
  status: "started" | "succeeded" | "failed";
  result_ref: string | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
};

type RouteMatch = {
  readonly draftId: string;
  readonly assetId: string;
  readonly kind: "asset" | "media";
};

class MuseVoiceReplyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const requestHeader = "muse-voice-reply-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,180}$/;
const sha256Pattern = /^[a-f0-9]{64}$/i;

function json(body: unknown, status = 200, correlationId?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  if (correlationId) headers.set("X-Correlation-ID", correlationId);
  return new Response(JSON.stringify(body), { status, headers });
}

function matchRoute(pathname: string): RouteMatch | null {
  const media = pathname.match(
    /^\/resources\/drafts\/([^/]+)\/muse-voice-replies\/([^/]+)\/media$/
  );
  if (media?.[1] && media[2]) {
    return {
      draftId: decodeURIComponent(media[1]),
      assetId: decodeURIComponent(media[2]),
      kind: "media"
    };
  }

  const asset = pathname.match(
    /^\/resources\/drafts\/([^/]+)\/muse-voice-replies\/([^/]+)$/
  );
  if (!asset?.[1] || !asset[2]) return null;
  return {
    draftId: decodeURIComponent(asset[1]),
    assetId: decodeURIComponent(asset[2]),
    kind: "asset"
  };
}

function validIdentifier(value: string | null, label: string): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new MuseVoiceReplyError(
      400,
      "invalid_identifier",
      `${label} is invalid.`
    );
  }
  return candidate;
}

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) {
    throw new MuseVoiceReplyError(400, "missing_header", `${name} is required.`);
  }
  return value;
}

function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new MuseVoiceReplyError(
      403,
      "csrf",
      "The voice reply request could not be verified."
    );
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new MuseVoiceReplyError(
      403,
      "origin",
      "The voice reply origin is not allowed."
    );
  }
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: ArrayBuffer | string): Promise<string> {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return bytesToHex(await crypto.subtle.digest("SHA-256", bytes));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function extensionFor(contentType: string): string {
  const extensions: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg"
  };
  const extension = extensions[contentType];
  if (!extension) {
    throw new MuseVoiceReplyError(
      415,
      "content_type",
      "That audio format is not supported."
    );
  }
  return extension;
}

function hasAudioSignature(bytes: Uint8Array, contentType: string): boolean {
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));

  switch (contentType) {
    case "audio/webm":
      return (
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3
      );
    case "audio/mp4":
      return text(4, 4) === "ftyp";
    case "audio/mpeg":
      return text(0, 3) === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] ?? 0) >= 0xe0);
    case "audio/wav":
      return text(0, 4) === "RIFF" && text(8, 4) === "WAVE";
    case "audio/ogg":
      return text(0, 4) === "OggS";
    default:
      return false;
  }
}

async function requireFoundation(
  request: Request,
  env: MuseVoiceReplyEnv,
  draftId: string
) {
  const session = await authenticateAppSession(request, env);
  if (!session) {
    throw new MuseVoiceReplyError(
      401,
      "session_required",
      "Sign in to answer Muse by voice."
    );
  }
  try {
    return await ensureLivingMemoryFoundation(env, draftId, session.userId);
  } catch (error) {
    if (error instanceof LivingMemoryPersistenceError) {
      const status =
        error.code === "draft_not_found"
          ? 404
          : error.code === "owner_mismatch"
            ? 403
            : error.code === "owner_required"
              ? 401
              : 409;
      throw new MuseVoiceReplyError(status, error.code, error.message);
    }
    throw error;
  }
}

async function requireMuseQuestion(
  env: MuseVoiceReplyEnv,
  memoryStoryId: string,
  turnId: string
): Promise<void> {
  const turn = await env.DB.prepare(
    `SELECT id, speaker
     FROM muse_conversation_turns
     WHERE id = ? AND memory_story_id = ?`
  ).bind(turnId, memoryStoryId).first<MuseTurnRow>();

  if (!turn || turn.speaker !== "muse") {
    throw new MuseVoiceReplyError(
      409,
      "muse_turn",
      "That Muse question is no longer available for a voice reply."
    );
  }

  const existingReply = await env.DB.prepare(
    `SELECT id
     FROM muse_conversation_turns
     WHERE memory_story_id = ?
       AND speaker = 'storyteller'
       AND reply_to_turn_id = ?
     LIMIT 1`
  ).bind(memoryStoryId, turnId).first();

  if (existingReply) {
    throw new MuseVoiceReplyError(
      409,
      "already_answered",
      "That Muse question already has a storyteller reply."
    );
  }
}

async function loadAsset(
  env: MuseVoiceReplyEnv,
  assetId: string,
  memoryStoryId: string
): Promise<VoiceReplyRow | null> {
  return env.DB.prepare(
    `SELECT id, memory_story_id, reply_to_turn_id, r2_key, content_type,
            byte_size, duration_ms, sha256, r2_etag, durability_status,
            transcript_text, transcript_locale, transcription_model_config_version,
            storyteller_text, storyteller_confirmed_at,
            created_by_user_id, created_at, transcribed_at
     FROM muse_voice_reply_assets
     WHERE id = ? AND memory_story_id = ?`
  ).bind(assetId, memoryStoryId).first<VoiceReplyRow>();
}

function assetResult(asset: VoiceReplyRow) {
  return {
    assetId: asset.id,
    replyToTurnId: asset.reply_to_turn_id,
    byteSize: asset.byte_size,
    durationMs: asset.duration_ms,
    sha256: asset.sha256,
    r2Etag: asset.r2_etag,
    durabilityStatus: asset.durability_status,
    transcript: asset.transcript_text,
    locale: asset.transcript_locale,
    storytellerText: asset.storyteller_text,
    storytellerConfirmedAt: asset.storyteller_confirmed_at,
    transcribedAt: asset.transcribed_at,
    mediaUrl: `/resources/drafts/${encodeURIComponent(asset.memory_story_id)}/muse-voice-replies/${encodeURIComponent(asset.id)}/media`
  };
}

async function transcribeAsset(
  env: MuseVoiceReplyEnv,
  asset: VoiceReplyRow
): Promise<VoiceReplyRow> {
  if (
    asset.durability_status !== "durable" ||
    !asset.r2_etag
  ) {
    throw new MuseVoiceReplyError(
      409,
      "not_durable",
      "The voice reply must be safely preserved before transcription."
    );
  }

  if (asset.transcript_text?.trim() && asset.transcribed_at) {
    return asset;
  }

  const object = await env.MEDIA_BUCKET.get(asset.r2_key);
  if (!object) {
    throw new MuseVoiceReplyError(
      503,
      "object_unavailable",
      "The preserved voice reply is temporarily unavailable."
    );
  }

  const audio = new Uint8Array(await object.arrayBuffer());
  try {
    const provider = createTranscriptionProvider(env);
    const result = await provider.transcribe({
      audio,
      contentType: asset.content_type,
      fileName: `muse-reply-${asset.id}.${extensionFor(asset.content_type)}`
    });

    const text = result.text.trim();
    if (!text) {
      throw new Error("The transcription provider returned no spoken words.");
    }

    const transcribedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE muse_voice_reply_assets
       SET transcript_text = ?,
           transcript_locale = ?,
           transcription_model_config_version = ?,
           transcribed_at = ?
       WHERE id = ? AND memory_story_id = ?`
    ).bind(
      text,
      result.locale,
      phase1Config.ai.modelConfigVersion,
      transcribedAt,
      asset.id,
      asset.memory_story_id
    ).run();

    return {
      ...asset,
      transcript_text: text,
      transcript_locale: result.locale,
      transcription_model_config_version: phase1Config.ai.modelConfigVersion,
      storyteller_text: asset.storyteller_text,
      storyteller_confirmed_at: asset.storyteller_confirmed_at,
      transcribed_at: transcribedAt
    };
  } catch {
    throw new MuseVoiceReplyError(
      503,
      "transcription_pending",
      "Your voice reply is safely preserved. Muse needs another try to read the words."
    );
  }
}

async function uploadVoiceReply(
  request: Request,
  env: MuseVoiceReplyEnv,
  draftId: string,
  assetId: string
): Promise<Response> {
  assertMutation(request);
  const foundation = await requireFoundation(request, env, draftId);
  const replyToTurnId = validIdentifier(
    requiredHeader(request, "X-Reply-To-Turn-ID"),
    "Muse turn ID"
  );
  await requireMuseQuestion(env, foundation.livingMemoryId, replyToTurnId);

  const idempotencyKey = validIdentifier(
    requiredHeader(request, "X-Idempotency-Key"),
    "Idempotency key"
  );
  const contentSha = requiredHeader(
    request,
    "X-Content-SHA256"
  ).toLowerCase();
  if (!sha256Pattern.test(contentSha)) {
    throw new MuseVoiceReplyError(
      400,
      "checksum",
      "The voice reply checksum is invalid."
    );
  }

  const contentType = (request.headers.get("Content-Type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase() ?? "";
  if (
    !(phase1Config.media.supportedAudioMimeTypes as readonly string[]).includes(
      contentType
    )
  ) {
    throw new MuseVoiceReplyError(
      415,
      "content_type",
      "That voice reply format is not supported."
    );
  }

  const durationMs = Number(requiredHeader(request, "X-Audio-Duration-MS"));
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 100 ||
    durationMs > phase1Config.entitlements.freeVoiceSecondsPerStory * 1000 + 1000
  ) {
    throw new MuseVoiceReplyError(
      400,
      "duration",
      "Keep each Muse voice reply to 30 seconds or less."
    );
  }

  const announcedSize = Number(
    request.headers.get("X-Content-Length") ??
      request.headers.get("Content-Length")
  );
  if (
    Number.isFinite(announcedSize) &&
    announcedSize > phase1Config.media.maxAudioBytes
  ) {
    throw new MuseVoiceReplyError(
      413,
      "media_size",
      "That voice reply is too large."
    );
  }

  const body = await request.arrayBuffer();
  if (
    body.byteLength === 0 ||
    body.byteLength > phase1Config.media.maxAudioBytes
  ) {
    throw new MuseVoiceReplyError(
      body.byteLength === 0 ? 400 : 413,
      "media_size",
      "The voice reply body size is invalid."
    );
  }
  if (
    Number.isFinite(announcedSize) &&
    announcedSize > 0 &&
    announcedSize !== body.byteLength
  ) {
    throw new MuseVoiceReplyError(
      400,
      "incomplete_body",
      "The voice reply upload was incomplete."
    );
  }
  const verifiedSha = await sha256(body);
  if (!safeEqual(verifiedSha, contentSha)) {
    throw new MuseVoiceReplyError(
      400,
      "checksum_mismatch",
      "The voice reply checksum did not match."
    );
  }
  if (!hasAudioSignature(new Uint8Array(body), contentType)) {
    throw new MuseVoiceReplyError(
      415,
      "signature",
      "The voice reply contents do not match the selected audio format."
    );
  }

  const extension = extensionFor(contentType);
  const r2Key =
    `stories/${foundation.livingMemoryId}/muse-voice/${assetId}/original.${extension}`;
  const requestHash = await sha256(
    [
      foundation.livingMemoryId,
      replyToTurnId,
      assetId,
      contentType,
      String(body.byteLength),
      String(durationMs),
      contentSha
    ].join("|")
  );

  const existingOperation = await env.DB.prepare(
    `SELECT idempotency_key, request_hash, status, result_ref, correlation_id,
            created_at, updated_at
     FROM operation_receipts WHERE idempotency_key = ?`
  ).bind(idempotencyKey).first<OperationRow>();

  if (
    existingOperation &&
    !safeEqual(existingOperation.request_hash, requestHash)
  ) {
    throw new MuseVoiceReplyError(
      409,
      "idempotency_conflict",
      "That retry key belongs to another voice reply."
    );
  }

  let existing = await loadAsset(
    env,
    assetId,
    foundation.livingMemoryId
  );

  if (
    existing &&
    (
      existing.reply_to_turn_id !== replyToTurnId ||
      existing.r2_key !== r2Key ||
      existing.sha256 !== contentSha ||
      existing.byte_size !== body.byteLength
    )
  ) {
    throw new MuseVoiceReplyError(
      409,
      "asset_conflict",
      "That voice reply identity is already in use."
    );
  }

  if (
    existingOperation?.status === "succeeded" &&
    existing?.durability_status === "durable"
  ) {
    try {
      existing = await transcribeAsset(env, existing);
      return json(
        { ok: true, state: "ready", voiceReply: assetResult(existing), replayed: true },
        200,
        existingOperation.correlation_id
      );
    } catch (error) {
      if (
        error instanceof MuseVoiceReplyError &&
        error.code === "transcription_pending"
      ) {
        return json(
          {
            ok: true,
            state: "transcription_pending",
            voiceReply: assetResult(existing),
            replayed: true
          },
          202,
          existingOperation.correlation_id
        );
      }
      throw error;
    }
  }

  const now = new Date().toISOString();
  const correlationId =
    existingOperation?.correlation_id ?? `cor_${crypto.randomUUID()}`;

  if (!existing) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO muse_voice_reply_assets (
           id, memory_story_id, reply_to_turn_id, r2_key, content_type,
           byte_size, duration_ms, sha256, r2_etag, durability_status,
           transcript_text, transcript_locale, transcription_model_config_version,
           created_by_user_id, created_at, transcribed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL, NULL, ?, ?, NULL)`
      ).bind(
        assetId,
        foundation.livingMemoryId,
        replyToTurnId,
        r2Key,
        contentType,
        body.byteLength,
        durationMs,
        contentSha,
        foundation.ownerUserId,
        now
      ),
      env.DB.prepare(
        `INSERT INTO operation_receipts (
           idempotency_key, operation_kind, scope_type, scope_id, request_hash,
           status, result_ref, correlation_id, created_at, updated_at
         ) VALUES (?, 'upload_muse_voice_reply', 'asset', ?, ?, 'started', NULL, ?, ?, ?)`
      ).bind(
        idempotencyKey,
        assetId,
        requestHash,
        correlationId,
        now,
        now
      )
    ]);
  } else {
    await env.DB.prepare(
      `UPDATE muse_voice_reply_assets
       SET durability_status = 'pending'
       WHERE id = ? AND durability_status = 'failed'`
    ).bind(assetId).run();
    await env.DB.prepare(
      `UPDATE operation_receipts
       SET status = 'started', updated_at = ?
       WHERE idempotency_key = ?`
    ).bind(now, idempotencyKey).run();
  }

  try {
    let object = await env.MEDIA_BUCKET.head(r2Key);
    if (object) {
      if (
        object.customMetadata?.sha256 !== contentSha ||
        object.size !== body.byteLength
      ) {
        throw new MuseVoiceReplyError(
          409,
          "r2_conflict",
          "An immutable object already exists for that voice reply."
        );
      }
    } else {
      await env.MEDIA_BUCKET.put(r2Key, body, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: {
          contentType,
          cacheControl: "private, no-store"
        },
        customMetadata: {
          draftId,
          memoryStoryId: foundation.livingMemoryId,
          assetId,
          replyToTurnId,
          role: "muse_voice_reply",
          sha256: contentSha,
          correlationId
        }
      });
      object = await env.MEDIA_BUCKET.head(r2Key);
    }

    if (!object || object.customMetadata?.sha256 !== contentSha) {
      throw new Error("R2 did not return immutable-object evidence.");
    }

    const durableAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE muse_voice_reply_assets
         SET r2_etag = ?, durability_status = 'durable'
         WHERE id = ? AND memory_story_id = ? AND sha256 = ?`
      ).bind(
        object.etag,
        assetId,
        foundation.livingMemoryId,
        contentSha
      ),
      env.DB.prepare(
        `UPDATE operation_receipts
         SET status = 'succeeded', result_ref = ?, updated_at = ?
         WHERE idempotency_key = ? AND request_hash = ?`
      ).bind(assetId, durableAt, idempotencyKey, requestHash)
    ]);

    existing = await loadAsset(
      env,
      assetId,
      foundation.livingMemoryId
    );
    if (!existing) {
      throw new Error("The durable voice reply record could not be reloaded.");
    }

    try {
      const ready = await transcribeAsset(env, existing);
      return json(
        {
          ok: true,
          state: "ready",
          voiceReply: assetResult(ready),
          replayed: Boolean(existingOperation)
        },
        existingOperation ? 200 : 201,
        correlationId
      );
    } catch (error) {
      if (
        error instanceof MuseVoiceReplyError &&
        error.code === "transcription_pending"
      ) {
        return json(
          {
            ok: true,
            state: "transcription_pending",
            voiceReply: assetResult(existing),
            replayed: Boolean(existingOperation)
          },
          202,
          correlationId
        );
      }
      throw error;
    }
  } catch (error) {
    const failedAt = new Date().toISOString();
    const durable = await env.MEDIA_BUCKET.head(r2Key);
    if (!durable) {
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE muse_voice_reply_assets
           SET durability_status = 'failed'
           WHERE id = ? AND r2_etag IS NULL`
        ).bind(assetId),
        env.DB.prepare(
          `UPDATE operation_receipts
           SET status = 'failed', updated_at = ?
           WHERE idempotency_key = ?`
        ).bind(failedAt, idempotencyKey)
      ]);
    }
    if (error instanceof MuseVoiceReplyError) throw error;
    throw new MuseVoiceReplyError(
      503,
      "storage_unavailable",
      "The voice reply is still on this device. Retry when connected."
    );
  }
}

async function retryTranscription(
  request: Request,
  env: MuseVoiceReplyEnv,
  draftId: string,
  assetId: string
): Promise<Response> {
  assertMutation(request);
  const foundation = await requireFoundation(request, env, draftId);
  const asset = await loadAsset(
    env,
    assetId,
    foundation.livingMemoryId
  );
  if (!asset) {
    throw new MuseVoiceReplyError(
      404,
      "not_found",
      "That voice reply was not found."
    );
  }

  try {
    const ready = await transcribeAsset(env, asset);
    return json({
      ok: true,
      state: "ready",
      voiceReply: assetResult(ready),
      replayed: Boolean(asset.transcript_text)
    });
  } catch (error) {
    if (
      error instanceof MuseVoiceReplyError &&
      error.code === "transcription_pending"
    ) {
      return json(
        {
          ok: true,
          state: "transcription_pending",
          voiceReply: assetResult(asset),
          replayed: false
        },
        202
      );
    }
    throw error;
  }
}

async function streamVoiceReply(
  request: Request,
  env: MuseVoiceReplyEnv,
  draftId: string,
  assetId: string
): Promise<Response> {
  const foundation = await requireFoundation(request, env, draftId);
  const asset = await loadAsset(
    env,
    assetId,
    foundation.livingMemoryId
  );
  if (
    !asset ||
    asset.durability_status !== "durable" ||
    !asset.r2_etag
  ) {
    throw new MuseVoiceReplyError(
      404,
      "not_found",
      "That preserved voice reply was not found."
    );
  }

  const object = request.headers.has("Range")
    ? await env.MEDIA_BUCKET.get(asset.r2_key, { range: request.headers })
    : await env.MEDIA_BUCKET.get(asset.r2_key);
  if (!object) {
    throw new MuseVoiceReplyError(
      503,
      "object_unavailable",
      "The preserved voice reply is temporarily unavailable."
    );
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": asset.content_type,
    ETag: object.httpEtag,
    "X-Content-SHA256": asset.sha256
  });
  const range = object.range;
  if (
    request.headers.has("Range") &&
    range &&
    "offset" in range &&
    typeof range.offset === "number"
  ) {
    const length = range.length ?? object.size - range.offset;
    headers.set("Content-Length", String(length));
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + length - 1}/${asset.byte_size}`
    );
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(asset.byte_size));
  return new Response(object.body, { status: 200, headers });
}

export async function handleMuseVoiceReplyRoute(
  request: Request,
  env: MuseVoiceReplyEnv
): Promise<Response | null> {
  const route = matchRoute(new URL(request.url).pathname);
  if (!route) return null;

  const draftId = validIdentifier(route.draftId, "Draft ID");
  const assetId = validIdentifier(route.assetId, "Voice reply asset ID");

  try {
    if (route.kind === "asset" && request.method === "PUT") {
      return await uploadVoiceReply(
        request,
        env,
        draftId,
        assetId
      );
    }
    if (route.kind === "asset" && request.method === "POST") {
      return await retryTranscription(
        request,
        env,
        draftId,
        assetId
      );
    }
    if (route.kind === "media" && request.method === "GET") {
      return await streamVoiceReply(
        request,
        env,
        draftId,
        assetId
      );
    }
    return json(
      {
        ok: false,
        error: {
          code: "method",
          message: "Method not allowed."
        }
      },
      405
    );
  } catch (error) {
    const routeError =
      error instanceof MuseVoiceReplyError
        ? error
        : new MuseVoiceReplyError(
            500,
            "internal",
            "The Muse voice reply could not be completed."
          );
    return json(
      {
        ok: false,
        error: {
          code: routeError.code,
          message: routeError.message
        }
      },
      routeError.status
    );
  }
}

export const museVoiceReplyValidation = {
  hasAudioSignature
};
