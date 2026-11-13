import { phase1Config } from "../config/phase-1";
import { normalizedTransform, validTransform } from "../app/domain/photo-scan";
import { authenticateAppSession, sha256Text } from "./auth-session";
import {
  MediaRouteError,
  authorizeDraft,
  type MediaRouteEnv,
} from "./media-routes";

class ScanError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
const identifier = /^[A-Za-z0-9_-]{8,120}$/;
const checksum = /^[a-f0-9]{64}$/;
function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
function fail(status: number, code: string): never {
  throw new ScanError(status, code);
}
function header(request: Request, name: string, pattern: RegExp) {
  const value = request.headers.get(name) ?? "";
  if (!pattern.test(value)) fail(400, "invalid_scan");
  return value;
}
function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i++] !== 255) return null;
    while (bytes[i] === 255) i++;
    const marker = bytes[i++]!;
    if (marker === 217 || marker === 218) return null;
    const size = (bytes[i]! << 8) | bytes[i + 1]!;
    if (size < 2 || i + size > bytes.length) return null;
    if ([192, 193, 194].includes(marker))
      return {
        height: (bytes[i + 3]! << 8) | bytes[i + 4]!,
        width: (bytes[i + 5]! << 8) | bytes[i + 6]!,
      };
    i += size;
  }
  return null;
}
async function readBytes(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) fail(400, "invalid_scan");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > phase1Config.media.maxImageBytes) {
        await reader.cancel();
        fail(413, "scan_too_large");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!length) fail(400, "invalid_scan");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function handlePhotoScanRoute(
  request: Request,
  env: MediaRouteEnv,
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(
    /^\/resources\/drafts\/([^/]+)\/scans$/,
  );
  if (!match) return null;
  try {
    const draftId = decodeURIComponent(match[1]!);
    if (!identifier.test(draftId)) fail(400, "invalid_scan");
    const draft = await authorizeDraft(request, env, draftId);
    const session = draft.owner_user_id
      ? await authenticateAppSession(request, env)
      : null;
    if (draft.owner_user_id && session?.userId !== draft.owner_user_id)
      fail(403, "owner_required");
    if (request.method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT m.id AS assetId,m.sha256,m.byte_size AS byteSize,m.source_asset_id AS sourceAssetId,p.source_sha256 AS sourceSha256,p.transform_json,p.metadata_basis AS metadataBasis,p.actor_type AS actorType,p.actor_user_id AS actorUserId,p.created_at AS createdAt
        FROM media_assets m JOIN archival_scan_provenance p ON p.asset_id=m.id WHERE m.draft_id=? AND m.durability_status='durable' ORDER BY m.created_at DESC,m.id DESC LIMIT 50`,
      )
        .bind(draftId)
        .all<{ transform_json: string; [key: string]: unknown }>();
      return json({
        scans: rows.results.map(({ transform_json, ...row }) => ({
          ...row,
          transform: JSON.parse(transform_json),
          mediaUrl: `/resources/drafts/${draftId}/media/${row.assetId}`,
        })),
      });
    }
    if (request.method !== "PUT") fail(405, "method");
    if (
      request.headers.get("X-Memories-Request") !== "scan-v1" ||
      (request.headers.has("Origin") &&
        request.headers.get("Origin") !== new URL(request.url).origin)
    )
      fail(403, "csrf");
    const assetId = header(request, "X-Asset-ID", identifier),
      sourceId = header(request, "X-Source-Asset-ID", identifier),
      sourceSha = header(request, "X-Source-SHA256", checksum),
      sha = header(request, "X-Content-SHA256", checksum),
      key = header(request, "X-Idempotency-Key", identifier);
    if (request.headers.get("Content-Type") !== "image/jpeg")
      fail(415, "invalid_scan");
    const metadata = request.headers.get("X-Scan-Transform") ?? "";
    if (metadata.length > 2048) fail(400, "invalid_scan");
    let raw: unknown;
    try {
      raw = JSON.parse(metadata);
    } catch {
      fail(400, "invalid_scan");
    }
    if (!validTransform(raw)) fail(400, "invalid_scan");
    const transform = normalizedTransform(raw);
    if (
      transform.outputWidth > phase1Config.scans.maxEdge ||
      transform.outputHeight > phase1Config.scans.maxEdge ||
      transform.outputWidth * transform.outputHeight >
        phase1Config.scans.maxPixels ||
      transform.sourceWidth * transform.sourceHeight >
        phase1Config.scans.maxDecodedPixels
    )
      fail(400, "invalid_scan");
    const source = await env.DB.prepare(
      "SELECT id,sha256,memory_story_id FROM media_assets WHERE id=? AND draft_id=? AND role='original_photo' AND durability_status='durable'",
    )
      .bind(sourceId, draftId)
      .first<{ id: string; sha256: string; memory_story_id: string | null }>();
    if (!source || source.sha256 !== sourceSha)
      fail(409, "scan_source_unavailable");
    const requestHash = await sha256Text(
      JSON.stringify([draftId, assetId, sourceId, sourceSha, sha, transform]),
    );
    const operation = await env.DB.prepare(
      "SELECT request_hash,status,result_ref FROM operation_receipts WHERE idempotency_key=?",
    )
      .bind(key)
      .first<{
        request_hash: string;
        status: string;
        result_ref: string | null;
      }>();
    if (operation && operation.request_hash !== requestHash)
      fail(409, "idempotency_conflict");
    const bytes = await readBytes(request),
      size = jpegSize(bytes);
    if (
      !size ||
      size.width !== transform.outputWidth ||
      size.height !== transform.outputHeight
    )
      fail(400, "invalid_scan");
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== sha) fail(400, "checksum_mismatch");
    const now = new Date().toISOString(),
      r2Key = `drafts/${draftId}/assets/${assetId}/scan.jpg`;
    if (!operation)
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO media_assets(id,draft_id,memory_story_id,role,source_asset_id,r2_key,content_type,byte_size,sha256,durability_status,created_by_user_id,created_at) VALUES(?,?,?,'enhanced_photo',?,?,'image/jpeg',?,?,'pending',?,?)`,
        ).bind(
          assetId,
          draftId,
          source.memory_story_id,
          sourceId,
          r2Key,
          bytes.length,
          sha,
          session?.userId ?? null,
          now,
        ),
        env.DB.prepare(
          "INSERT INTO archival_scan_provenance(asset_id,source_asset_id,source_sha256,transform_json,actor_type,actor_user_id,created_at) VALUES(?,?,?,?,?,?,?)",
        ).bind(
          assetId,
          sourceId,
          sourceSha,
          JSON.stringify(transform),
          session ? "owner" : "anonymous",
          session?.userId ?? null,
          now,
        ),
        env.DB.prepare(
          "INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,correlation_id,created_at,updated_at) VALUES(?,'upload_scan','asset',?,?,'started',?,?,?)",
        ).bind(
          key,
          assetId,
          requestHash,
          `cor_${crypto.randomUUID()}`,
          now,
          now,
        ),
      ]);
    const existing = await env.MEDIA_BUCKET.head(r2Key);
    if (
      existing &&
      (existing.size !== bytes.length ||
        existing.customMetadata?.sha256 !== sha)
    )
      fail(409, "asset_conflict");
    if (!existing)
      await env.MEDIA_BUCKET.put(r2Key, bytes, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "private, no-store",
        },
        customMetadata: {
          sha256: sha,
          sourceAssetId: sourceId,
          sourceSha256: sourceSha,
        },
      });
    const object = await env.MEDIA_BUCKET.head(r2Key);
    if (
      !object ||
      object.customMetadata?.sha256 !== sha ||
      object.size !== bytes.length
    )
      fail(503, "scan_backup_pending");
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE media_assets SET r2_etag=?,durability_status='durable' WHERE id=? AND draft_id=? AND sha256=?",
      ).bind(object.etag, assetId, draftId, sha),
      env.DB.prepare(
        "UPDATE operation_receipts SET status='succeeded',result_ref=?,updated_at=? WHERE idempotency_key=? AND request_hash=?",
      ).bind(assetId, new Date().toISOString(), key, requestHash),
    ]);
    return json(
      { ok: true, assetId, sha256: sha, replayed: Boolean(operation) },
      operation ? 200 : 201,
    );
  } catch (error) {
    const e =
      error instanceof ScanError || error instanceof MediaRouteError
        ? error
        : new ScanError(503, "scan_backup_pending");
    return json({ error: { code: e.code } }, e.status);
  }
}
