import { phase1Config } from "../config/phase-1";
import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";

export type MediaRouteEnv = AuthSessionEnv & {
  readonly DB: D1Database;
  readonly MEDIA_BUCKET: R2Bucket;
};

type OriginalRole = "original_photo" | "original_audio";

type MediaRow = {
  id: string;
  draft_id: string;
  role: OriginalRole;
  r2_key: string;
  content_type: string;
  byte_size: number;
  duration_ms: number | null;
  sha256: string;
  r2_etag: string | null;
  durability_status: "pending" | "durable" | "failed";
  created_at: string;
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

type DraftRow = {
  id: string;
  owner_user_id: string | null;
  anonymous_identity_hash: string | null;
  status: string;
};

type RouteMatch = {
  readonly draftId: string;
  readonly kind: "photo" | "audio" | "status" | "media";
  readonly assetId?: string;
};

class MediaRouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

const identifierPattern = /^[A-Za-z0-9_-]{8,120}$/;
const sha256Pattern = /^[a-f0-9]{64}$/i;
const noAutomaticExpiry = "9999-12-31T23:59:59.999Z";

function json(body: unknown, status = 200, correlationId?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  if (correlationId) headers.set("X-Correlation-ID", correlationId);
  return new Response(JSON.stringify(body), { status, headers });
}

function matchRoute(pathname: string): RouteMatch | null {
  const status = pathname.match(/^\/resources\/drafts\/([^/]+)\/media-status$/);
  if (status) return { draftId: decodeURIComponent(status[1] ?? ""), kind: "status" };

  const media = pathname.match(/^\/resources\/drafts\/([^/]+)\/media\/([^/]+)$/);
  if (media) {
    return {
      draftId: decodeURIComponent(media[1] ?? ""),
      kind: "media",
      assetId: decodeURIComponent(media[2] ?? "")
    };
  }

  const upload = pathname.match(/^\/resources\/drafts\/([^/]+)\/(photo|audio)$/);
  if (!upload) return null;
  return {
    draftId: decodeURIComponent(upload[1] ?? ""),
    kind: upload[2] as "photo" | "audio"
  };
}

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) {
    throw new MediaRouteError(400, `${name} is required.`, "missing_header");
  }
  return value;
}

function validIdentifier(value: string, label: string): string {
  if (!identifierPattern.test(value)) {
    throw new MediaRouteError(400, `${label} is invalid.`, "invalid_identifier");
  }
  return value;
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

function assertSameOriginMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== "media-v1") {
    throw new MediaRouteError(403, "The upload request could not be verified.", "csrf");
  }

  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new MediaRouteError(403, "The upload origin is not allowed.", "origin");
  }
}

function extensionFor(contentType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg"
  };
  const extension = extensions[contentType];
  if (!extension) {
    throw new MediaRouteError(415, "That media format is not supported.", "content_type");
  }
  return extension;
}

function hasMediaSignature(bytes: Uint8Array, contentType: string): boolean {
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));

  switch (contentType) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes[0] === 0x89 && text(1, 3) === "PNG" && bytes[4] === 0x0d
      );
    case "image/webp":
      return text(0, 4) === "RIFF" && text(8, 4) === "WEBP";
    case "image/heic":
    case "image/heif": {
      const brand = text(8, 4);
      return text(4, 4) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand);
    }
    case "audio/webm":
      return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    case "audio/mp4":
      return text(4, 4) === "ftyp";
    case "audio/mpeg":
      return text(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] ?? 0) >= 0xe0);
    case "audio/wav":
      return text(0, 4) === "RIFF" && text(8, 4) === "WAVE";
    case "audio/ogg":
      return text(0, 4) === "OggS";
    default:
      return false;
  }
}

async function ensureDraft(
  env: MediaRouteEnv,
  draftId: string,
  token: string,
  locale: string
): Promise<DraftRow> {
  if (token.length < 32 || token.length > 256) {
    throw new MediaRouteError(403, "The local draft could not be verified.", "draft_token");
  }
  const tokenHash = await sha256(token);
  let draft = await env.DB.prepare(
    "SELECT id, owner_user_id, anonymous_identity_hash, status FROM memory_story_drafts WHERE id = ?"
  )
    .bind(draftId)
    .first<DraftRow>();

  if (!draft) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO memory_story_drafts (
        id, owner_user_id, anonymous_identity_hash, status, ui_locale,
        created_at, updated_at, expires_at, version
      ) VALUES (?, NULL, ?, 'local_draft', ?, ?, ?, ?, 1)`
    )
      .bind(draftId, tokenHash, locale || phase1Config.localization.defaultLocale, now, now, noAutomaticExpiry)
      .run();
    draft = await env.DB.prepare(
      "SELECT id, owner_user_id, anonymous_identity_hash, status FROM memory_story_drafts WHERE id = ?"
    )
      .bind(draftId)
      .first<DraftRow>();
  }

  if (!draft || !draft.anonymous_identity_hash || !safeEqual(draft.anonymous_identity_hash, tokenHash)) {
    throw new MediaRouteError(403, "The local draft could not be verified.", "draft_scope");
  }
  return draft;
}

async function authorizeDraft(
  request: Request,
  env: MediaRouteEnv,
  draftId: string
): Promise<DraftRow> {
  const draft = await env.DB.prepare(
    "SELECT id, owner_user_id, anonymous_identity_hash, status FROM memory_story_drafts WHERE id = ?"
  )
    .bind(draftId)
    .first<DraftRow>();

  if (!draft) {
    throw new MediaRouteError(404, "That preserved draft was not found.", "not_found");
  }
  const token = request.headers.get("X-Draft-Token")?.trim();
  if (token && draft.anonymous_identity_hash) {
    const tokenHash = await sha256(token);
    if (safeEqual(draft.anonymous_identity_hash, tokenHash)) return draft;
  }
  const session = await authenticateAppSession(request, env);
  if (session && draft.owner_user_id === session.userId) return draft;

  throw new MediaRouteError(403, "That preserved original belongs to another archive.", "draft_scope");
}

function receipt(row: MediaRow, operation: OperationRow) {
  return {
    assetId: row.id,
    role: row.role,
    byteSize: row.byte_size,
    durationMs: row.duration_ms,
    sha256: row.sha256,
    r2Etag: row.r2_etag,
    durableAt: operation.updated_at,
    correlationId: operation.correlation_id
  };
}

async function loadReceipt(
  env: MediaRouteEnv,
  assetId: string,
  operation: OperationRow
): Promise<Response> {
  const asset = await env.DB.prepare(
    `SELECT id, draft_id, role, r2_key, content_type, byte_size, duration_ms,
      sha256, r2_etag, durability_status, created_at
     FROM media_assets WHERE id = ?`
  )
    .bind(assetId)
    .first<MediaRow>();
  if (!asset || asset.durability_status !== "durable" || !asset.r2_etag) {
    throw new MediaRouteError(503, "The durable receipt is being recovered. Retry safely.", "receipt_recovery");
  }
  return json({ ok: true, receipt: receipt(asset, operation), replayed: true }, 200, operation.correlation_id);
}

async function uploadOriginal(
  request: Request,
  env: MediaRouteEnv,
  route: RouteMatch,
  role: OriginalRole
): Promise<Response> {
  assertSameOriginMutation(request);
  const draftId = validIdentifier(route.draftId, "Draft ID");
  const assetId = validIdentifier(requiredHeader(request, "X-Asset-ID"), "Asset ID");
  const idempotencyKey = validIdentifier(
    requiredHeader(request, "X-Idempotency-Key"),
    "Idempotency key"
  );
  const token = requiredHeader(request, "X-Draft-Token");
  const contentSha = requiredHeader(request, "X-Content-SHA256").toLowerCase();
  if (!sha256Pattern.test(contentSha)) {
    throw new MediaRouteError(400, "The media checksum is invalid.", "checksum");
  }

  const contentType = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const supported = role === "original_photo"
    ? (phase1Config.media.supportedImageMimeTypes as readonly string[])
    : (phase1Config.media.supportedAudioMimeTypes as readonly string[]);
  if (!supported.includes(contentType)) {
    throw new MediaRouteError(415, "That media format is not supported.", "content_type");
  }

  const announcedSize = Number(
    request.headers.get("X-Content-Length") ?? request.headers.get("Content-Length")
  );
  const maximum = role === "original_photo"
    ? phase1Config.media.maxImageBytes
    : phase1Config.media.maxAudioBytes;
  if (Number.isFinite(announcedSize) && announcedSize > maximum) {
    throw new MediaRouteError(413, "That media file is too large.", "media_size");
  }

  const durationMs = role === "original_audio"
    ? Number(requiredHeader(request, "X-Audio-Duration-MS"))
    : null;
  if (
    durationMs !== null &&
    (!Number.isFinite(durationMs) || durationMs < 100 || durationMs > phase1Config.entitlements.freeVoiceSecondsPerStory * 1000 + 1000)
  ) {
    throw new MediaRouteError(400, "The recording duration is invalid.", "duration");
  }

  await ensureDraft(env, draftId, token, request.headers.get("X-UI-Locale") ?? "");
  if (role === "original_audio") {
    const photo = await env.DB.prepare(
      "SELECT id FROM media_assets WHERE draft_id = ? AND role = 'original_photo' AND durability_status = 'durable' LIMIT 1"
    )
      .bind(draftId)
      .first();
    if (!photo) {
      throw new MediaRouteError(409, "Preserve the photograph before the voice recording.", "photo_required");
    }
  }

  const extension = extensionFor(contentType);
  const r2Key = `drafts/${draftId}/assets/${assetId}/original.${extension}`;
  const requestHash = await sha256(
    `${role}|${assetId}|${contentType}|${announcedSize}|${durationMs ?? ""}|${contentSha}`
  );
  const existingOperation = await env.DB.prepare(
    `SELECT idempotency_key, request_hash, status, result_ref, correlation_id,
      created_at, updated_at FROM operation_receipts WHERE idempotency_key = ?`
  )
    .bind(idempotencyKey)
    .first<OperationRow>();

  if (existingOperation && !safeEqual(existingOperation.request_hash, requestHash)) {
    throw new MediaRouteError(409, "That retry key belongs to a different upload.", "idempotency_conflict");
  }
  if (existingOperation?.status === "succeeded" && existingOperation.result_ref) {
    return loadReceipt(env, existingOperation.result_ref, existingOperation);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > maximum) {
    throw new MediaRouteError(body.byteLength === 0 ? 400 : 413, "The media body size is invalid.", "media_size");
  }
  if (Number.isFinite(announcedSize) && announcedSize > 0 && announcedSize !== body.byteLength) {
    throw new MediaRouteError(400, "The media body was incomplete.", "incomplete_body");
  }
  const verifiedSha = await sha256(body);
  if (!safeEqual(verifiedSha, contentSha)) {
    throw new MediaRouteError(400, "The media checksum did not match.", "checksum_mismatch");
  }
  if (!hasMediaSignature(new Uint8Array(body), contentType)) {
    throw new MediaRouteError(415, "The media contents do not match the selected format.", "signature");
  }

  const existingAsset = await env.DB.prepare(
    `SELECT id, draft_id, role, r2_key, content_type, byte_size, duration_ms,
      sha256, r2_etag, durability_status, created_at
     FROM media_assets WHERE id = ?`
  )
    .bind(assetId)
    .first<MediaRow>();
  if (
    existingAsset &&
    (existingAsset.draft_id !== draftId || existingAsset.role !== role ||
      existingAsset.r2_key !== r2Key || existingAsset.sha256 !== contentSha ||
      existingAsset.byte_size !== body.byteLength)
  ) {
    throw new MediaRouteError(409, "That original asset identity is already in use.", "asset_conflict");
  }

  const now = new Date().toISOString();
  const correlationId = existingOperation?.correlation_id ?? `cor_${crypto.randomUUID()}`;
  if (!existingOperation) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO media_assets (
          id, draft_id, role, r2_key, content_type, byte_size, duration_ms,
          sha256, r2_etag, durability_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?)`
      ).bind(assetId, draftId, role, r2Key, contentType, body.byteLength, durationMs, contentSha, now),
      env.DB.prepare(
        `INSERT INTO operation_receipts (
          idempotency_key, operation_kind, scope_type, scope_id, request_hash,
          status, result_ref, correlation_id, created_at, updated_at
        ) VALUES (?, ?, 'asset', ?, ?, 'started', NULL, ?, ?, ?)`
      ).bind(idempotencyKey, role === "original_photo" ? "upload_photo" : "upload_audio", assetId, requestHash, correlationId, now, now)
    ]);
  } else {
    await env.DB.prepare(
      "UPDATE media_assets SET durability_status = 'pending' WHERE id = ? AND durability_status = 'failed'"
    ).bind(assetId).run();
    await env.DB.prepare(
      "UPDATE operation_receipts SET status = 'started', updated_at = ? WHERE idempotency_key = ?"
    ).bind(now, idempotencyKey).run();
  }

  try {
    let object = await env.MEDIA_BUCKET.head(r2Key);
    if (object) {
      if (object.customMetadata?.sha256 !== contentSha || object.size !== body.byteLength) {
        throw new MediaRouteError(409, "An immutable object already exists for that asset.", "r2_conflict");
      }
    } else {
      object = await env.MEDIA_BUCKET.put(r2Key, body, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: { contentType, cacheControl: "private, no-store" },
        customMetadata: { draftId, assetId, role, sha256: contentSha, correlationId }
      });
      object = await env.MEDIA_BUCKET.head(r2Key);
    }
    if (!object || object.customMetadata?.sha256 !== contentSha) {
      throw new Error("R2 did not return immutable-object evidence.");
    }

    const durableAt = new Date().toISOString();
    const nextDraftStatus = role === "original_photo" ? "photo_durable" : "originals_durable";
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE media_assets SET r2_etag = ?, durability_status = 'durable'
         WHERE id = ? AND draft_id = ? AND sha256 = ?`
      ).bind(object.etag, assetId, draftId, contentSha),
      env.DB.prepare(
        `UPDATE operation_receipts SET status = 'succeeded', result_ref = ?, updated_at = ?
         WHERE idempotency_key = ? AND request_hash = ?`
      ).bind(assetId, durableAt, idempotencyKey, requestHash),
      env.DB.prepare(
        "UPDATE memory_story_drafts SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?"
      ).bind(nextDraftStatus, durableAt, draftId)
    ]);

    const asset: MediaRow = {
      id: assetId,
      draft_id: draftId,
      role,
      r2_key: r2Key,
      content_type: contentType,
      byte_size: body.byteLength,
      duration_ms: durationMs,
      sha256: contentSha,
      r2_etag: object.etag,
      durability_status: "durable",
      created_at: existingAsset?.created_at ?? now
    };
    const operation: OperationRow = {
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      status: "succeeded",
      result_ref: assetId,
      correlation_id: correlationId,
      created_at: existingOperation?.created_at ?? now,
      updated_at: durableAt
    };
    return json({ ok: true, receipt: receipt(asset, operation), replayed: Boolean(existingOperation) }, existingOperation ? 200 : 201, correlationId);
  } catch (error) {
    const failedAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE media_assets SET durability_status = 'failed' WHERE id = ? AND r2_etag IS NULL").bind(assetId),
      env.DB.prepare("UPDATE operation_receipts SET status = 'failed', updated_at = ? WHERE idempotency_key = ?").bind(failedAt, idempotencyKey),
      env.DB.prepare("UPDATE memory_story_drafts SET status = 'needs_connection', updated_at = ?, version = version + 1 WHERE id = ?").bind(failedAt, draftId)
    ]);
    if (error instanceof MediaRouteError) throw error;
    throw new MediaRouteError(503, "The original is still on this device. Retry when connected.", "storage_unavailable");
  }
}

async function mediaStatus(request: Request, env: MediaRouteEnv, draftId: string): Promise<Response> {
  await authorizeDraft(request, env, draftId);
  const result = await env.DB.prepare(
    `SELECT id, draft_id, role, r2_key, content_type, byte_size, duration_ms,
      sha256, r2_etag, durability_status, created_at
     FROM media_assets WHERE draft_id = ? AND role IN ('original_photo', 'original_audio')
     ORDER BY created_at`
  ).bind(draftId).all<MediaRow>();
  const durable = result.results.filter((asset) => asset.durability_status === "durable" && asset.r2_etag);
  return json({
    ok: true,
    originalsDurable:
      durable.some((asset) => asset.role === "original_photo") &&
      durable.some((asset) => asset.role === "original_audio"),
    assets: durable.map((asset) => ({
      assetId: asset.id,
      role: asset.role,
      byteSize: asset.byte_size,
      durationMs: asset.duration_ms,
      sha256: asset.sha256,
      r2Etag: asset.r2_etag
    }))
  });
}

async function streamMedia(request: Request, env: MediaRouteEnv, draftId: string, assetId: string): Promise<Response> {
  await authorizeDraft(request, env, draftId);
  const asset = await env.DB.prepare(
    `SELECT id, draft_id, role, r2_key, content_type, byte_size, duration_ms,
      sha256, r2_etag, durability_status, created_at
     FROM media_assets WHERE id = ? AND draft_id = ?`
  ).bind(assetId, draftId).first<MediaRow>();
  if (!asset || asset.durability_status !== "durable") {
    throw new MediaRouteError(404, "That preserved original was not found.", "not_found");
  }
  const object = await env.MEDIA_BUCKET.get(asset.r2_key, { range: request.headers });
  if (!object) {
    throw new MediaRouteError(503, "The preserved original is temporarily unavailable.", "object_unavailable");
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": asset.content_type,
    ETag: object.httpEtag,
    "X-Content-SHA256": asset.sha256
  });
  const range = object.range;
  if (range && "offset" in range && typeof range.offset === "number") {
    const length = range.length ?? object.size - range.offset;
    headers.set("Content-Length", String(length));
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + length - 1}/${asset.byte_size}`);
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(asset.byte_size));
  return new Response(object.body, { status: 200, headers });
}

export async function handleMediaRoute(request: Request, env: MediaRouteEnv): Promise<Response | null> {
  const route = matchRoute(new URL(request.url).pathname);
  if (!route) return null;

  try {
    validIdentifier(route.draftId, "Draft ID");
    if (route.kind === "photo" && request.method === "PUT") {
      return await uploadOriginal(request, env, route, "original_photo");
    }
    if (route.kind === "audio" && request.method === "PUT") {
      return await uploadOriginal(request, env, route, "original_audio");
    }
    if (route.kind === "status" && request.method === "GET") {
      return await mediaStatus(request, env, route.draftId);
    }
    if (route.kind === "media" && request.method === "GET" && route.assetId) {
      return await streamMedia(request, env, route.draftId, validIdentifier(route.assetId, "Asset ID"));
    }
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    const routeError = error instanceof MediaRouteError
      ? error
      : new MediaRouteError(500, "The preservation request could not be completed.", "internal");
    return json({ ok: false, error: { code: routeError.code, message: routeError.message } }, routeError.status);
  }
}

export const mediaValidation = { hasMediaSignature };
