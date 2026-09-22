import { appIdentity } from "../config/app-identity";
import {
  normalizeShareSelection,
  type LivingMemoryShareArtifactSelection
} from "../app/domain";
import { authenticateAppSession, sha256Text, type AuthSessionEnv } from "./auth-session";

export type SharingEnv = AuthSessionEnv & {
  readonly DB: D1Database;
  readonly MEDIA_BUCKET: R2Bucket;
  readonly SHARE_TOKEN_PEPPER?: string;
};

type StoryRow = {
  id: string;
  owner_user_id: string;
  status: "draft" | "complete";
  primary_photo_asset_id: string | null;
  primary_audio_asset_id: string | null;
  current_transcript_revision_id: string | null;
};

type ShareRow = {
  id: string;
  memory_story_id: string;
  owner_user_id: string;
  token_hash: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type ShareArtifactRow = {
  id: string;
  share_id: string;
  memory_story_id: string;
  owner_user_id: string;
  include_photo: number;
  include_voice: number;
  include_captions: number;
  include_narrator_attribution: number;
  include_brand_attribution: number;
  caption: string | null;
};

type OperationRow = {
  idempotency_key: string;
  request_hash: string;
  status: "started" | "succeeded" | "failed";
  result_ref: string | null;
};

type PublicShareRow = {
  share_id: string;
  story_id: string;
  include_photo: number;
  include_voice: number;
  include_captions: number;
  include_narrator_attribution: number;
  include_brand_attribution: number;
  caption: string | null;
  primary_photo_asset_id: string;
  primary_audio_asset_id: string;
  transcript_text: string | null;
};

type MediaRow = {
  id: string;
  r2_key: string;
  content_type: string;
  byte_size: number;
  sha256: string;
  durability_status: "pending" | "durable" | "failed";
};

class SharingRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const requestHeader = "share-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,180}$/;
const shareTokenPattern = /^[A-Za-z0-9_-]{40,100}$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}

function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new SharingRouteError(403, "csrf", "The sharing request could not be verified.");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new SharingRouteError(403, "origin", "The sharing request origin is not allowed.");
  }
}

function validIdentifier(value: string | null, label: string): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new SharingRouteError(400, "invalid_identifier", `${label} is invalid.`);
  }
  return candidate;
}

function requirePepper(env: SharingEnv): string {
  const pepper = env.SHARE_TOKEN_PEPPER?.trim() ?? "";
  if (pepper.length < 32) {
    throw new SharingRouteError(503, "share_unconfigured", "Family sharing is not configured yet.");
  }
  return pepper;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function deterministicShareToken(
  pepper: string,
  ownerUserId: string,
  storyId: string,
  idempotencyKey: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`share-v1|${ownerUserId}|${storyId}|${idempotencyKey}`)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function normalizedSelection(body: unknown): LivingMemoryShareArtifactSelection {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const caption = typeof input.caption === "string" ? input.caption : null;

  return normalizeShareSelection({
    includePhoto: true,
    includeVoice: input.includeVoice !== false,
    includeCaptions: input.includeCaptions === true,
    includeNarratorAttribution: input.includeNarratorAttribution === true,
    includeBrandAttribution: input.includeBrandAttribution !== false,
    caption
  });
}
async function requireOwner(
  request: Request,
  env: SharingEnv,
  storyId: string
): Promise<{ readonly userId: string; readonly story: StoryRow }> {
  const session = await authenticateAppSession(request, env);
  if (!session) {
    throw new SharingRouteError(401, "session_required", "Sign in to share this Living Memory.");
  }

  const story = await env.DB.prepare(
    `SELECT id, owner_user_id, status, primary_photo_asset_id,
            primary_audio_asset_id, current_transcript_revision_id
     FROM memory_stories WHERE id = ? AND owner_user_id = ?`
  ).bind(storyId, session.userId).first<StoryRow>();

  if (!story) {
    throw new SharingRouteError(404, "not_found", "That Living Memory was not found.");
  }
  if (story.status !== "complete" || !story.primary_photo_asset_id || !story.primary_audio_asset_id) {
    throw new SharingRouteError(
      409,
      "living_memory_not_complete",
      "Complete the Living Memory before sharing it."
    );
  }

  return { userId: session.userId, story };
}

async function transcriptText(
  env: SharingEnv,
  story: StoryRow
): Promise<string | null> {
  if (!story.current_transcript_revision_id) return null;
  const row = await env.DB.prepare(
    `SELECT text FROM transcript_revisions
     WHERE id = ? AND memory_story_id = ?`
  ).bind(story.current_transcript_revision_id, story.id)
    .first<{ readonly text: string }>();
  return row?.text ?? null;
}

async function previewShare(
  request: Request,
  env: SharingEnv,
  storyId: string
): Promise<Response> {
  assertMutation(request);
  const { story } = await requireOwner(request, env, storyId);
  const selection = normalizedSelection(await request.json().catch(() => null));
  const transcript = selection.includeCaptions ? await transcriptText(env, story) : null;

  if (selection.includeCaptions && !transcript) {
    throw new SharingRouteError(
      409,
      "captions_unavailable",
      "Captions are not ready. You can share the photograph and voice without them."
    );
  }

  return json({
    ok: true,
    preview: {
      photo: true,
      voice: selection.includeVoice,
      captions: selection.includeCaptions ? transcript : null,
      narratorAttribution: selection.includeNarratorAttribution
        ? "Story told in the storyteller's own voice."
        : null,
      brandAttribution: selection.includeBrandAttribution ? appIdentity.brandName : null,
      caption: selection.caption
    }
  });
}

async function loadShare(
  env: SharingEnv,
  shareId: string
): Promise<{ readonly share: ShareRow; readonly artifact: ShareArtifactRow }> {
  const share = await env.DB.prepare(
    `SELECT id, memory_story_id, owner_user_id, token_hash, revoked_at, created_at, updated_at
     FROM memory_story_shares WHERE id = ?`
  ).bind(shareId).first<ShareRow>();
  const artifact = await env.DB.prepare(
    `SELECT id, share_id, memory_story_id, owner_user_id, include_photo, include_voice,
            include_captions, include_narrator_attribution, include_brand_attribution, caption
     FROM living_memory_share_artifacts WHERE share_id = ?`
  ).bind(shareId).first<ShareArtifactRow>();

  if (!share || !artifact) {
    throw new SharingRouteError(503, "share_recovery", "The family share is being recovered.");
  }
  return { share, artifact };
}

async function createShare(
  request: Request,
  env: SharingEnv,
  storyId: string
): Promise<Response> {
  assertMutation(request);
  const { userId, story } = await requireOwner(request, env, storyId);
  const pepper = requirePepper(env);
  const idempotencyKey = validIdentifier(
    request.headers.get("X-Idempotency-Key"),
    "Idempotency key"
  );
  const selection = normalizedSelection(await request.json().catch(() => null));
  const transcript = selection.includeCaptions ? await transcriptText(env, story) : null;

  if (selection.includeCaptions && !transcript) {
    throw new SharingRouteError(
      409,
      "captions_unavailable",
      "Captions are not ready. You can share the photograph and voice without them."
    );
  }

  const requestHash = await sha256Text(
    JSON.stringify({
      storyId,
      includePhoto: true,
      includeVoice: selection.includeVoice,
      includeCaptions: selection.includeCaptions,
      includeNarratorAttribution: selection.includeNarratorAttribution,
      includeBrandAttribution: selection.includeBrandAttribution,
      caption: selection.caption
    })
  );

  const existing = await env.DB.prepare(
    `SELECT idempotency_key, request_hash, status, result_ref
     FROM operation_receipts WHERE idempotency_key = ?`
  ).bind(idempotencyKey).first<OperationRow>();

  if (existing && existing.request_hash !== requestHash) {
    throw new SharingRouteError(
      409,
      "idempotency_conflict",
      "That retry key was already used for a different family share."
    );
  }

  const token = await deterministicShareToken(pepper, userId, storyId, idempotencyKey);
  const tokenHash = await sha256Text(`${pepper}:${token}`);
  const shareSeed = await sha256Text(`${userId}|${storyId}|${idempotencyKey}`);
  const shareId = `share_${shareSeed.slice(0, 48)}`;
  const artifactId = `share_artifact_${shareSeed.slice(0, 40)}`;

  if (existing?.status === "succeeded" && existing.result_ref) {
    const loaded = await loadShare(env, existing.result_ref);
    return json({
      ok: true,
      shareId: loaded.share.id,
      sharePath: `/shared/${token}`,
      revoked: Boolean(loaded.share.revoked_at),
      replayed: true
    });
  }

  const now = new Date().toISOString();
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO operation_receipts (
        idempotency_key, operation_kind, scope_type, scope_id, request_hash,
        status, result_ref, correlation_id, created_at, updated_at
      ) VALUES (?, 'create_share', 'story', ?, ?, 'started', NULL, ?, ?, ?)`
    ).bind(
      idempotencyKey,
      storyId,
      requestHash,
      `share_${crypto.randomUUID()}`,
      now,
      now
    ).run();
  }

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO memory_story_shares (
          id, memory_story_id, owner_user_id, token_hash, visibility,
          revoked_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'private_link', NULL, ?, ?)`
      ).bind(shareId, storyId, userId, tokenHash, now, now),
      env.DB.prepare(
        `INSERT OR IGNORE INTO living_memory_share_artifacts (
          id, share_id, memory_story_id, owner_user_id,
          include_photo, include_voice, include_captions,
          include_narrator_attribution, include_brand_attribution,
          caption, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        artifactId,
        shareId,
        storyId,
        userId,
        selection.includeVoice ? 1 : 0,
        selection.includeCaptions ? 1 : 0,
        selection.includeNarratorAttribution ? 1 : 0,
        selection.includeBrandAttribution ? 1 : 0,
        selection.caption,
        now,
        now
      ),
      env.DB.prepare(
        `UPDATE operation_receipts
         SET status = 'succeeded', result_ref = ?, updated_at = ?
         WHERE idempotency_key = ? AND request_hash = ?`
      ).bind(shareId, now, idempotencyKey, requestHash),
      env.DB.prepare(
        `INSERT OR IGNORE INTO product_events (
          id, event_name, user_id, memory_story_id, session_id,
          referral_id, share_channel, idempotency_key, occurred_at
        ) VALUES (?, 'living_memory_share_artifact_created', ?, ?, NULL, NULL, NULL, ?, ?)`
      ).bind(
        `product_event_${shareSeed.slice(0, 40)}`,
        userId,
        storyId,
        `share_event_${shareSeed.slice(0, 48)}`,
        now
      )
    ]);
  } catch (error) {
    await env.DB.prepare(
      `UPDATE operation_receipts SET status = 'failed', updated_at = ?
       WHERE idempotency_key = ? AND request_hash = ?`
    ).bind(new Date().toISOString(), idempotencyKey, requestHash).run().catch(() => undefined);
    throw error;
  }

  return json({
    ok: true,
    shareId,
    sharePath: `/shared/${token}`,
    revoked: false,
    replayed: false
  }, 201);
}
async function revokeShare(
  request: Request,
  env: SharingEnv,
  storyId: string,
  shareId: string
): Promise<Response> {
  assertMutation(request);
  const { userId } = await requireOwner(request, env, storyId);
  const share = await env.DB.prepare(
    `SELECT id, memory_story_id, owner_user_id, token_hash, revoked_at, created_at, updated_at
     FROM memory_story_shares WHERE id = ? AND memory_story_id = ? AND owner_user_id = ?`
  ).bind(shareId, storyId, userId).first<ShareRow>();

  if (!share) {
    throw new SharingRouteError(404, "share_not_found", "That family share was not found.");
  }

  if (!share.revoked_at) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE memory_story_shares
       SET revoked_at = ?, updated_at = ?
       WHERE id = ? AND revoked_at IS NULL`
    ).bind(now, now, shareId).run();
  }

  return json({ ok: true, shareId, revoked: true });
}

async function publicShareByToken(
  env: SharingEnv,
  token: string
): Promise<PublicShareRow> {
  if (!shareTokenPattern.test(token)) {
    throw new SharingRouteError(404, "share_not_found", "That family share is unavailable.");
  }
  const pepper = requirePepper(env);
  const tokenHash = await sha256Text(`${pepper}:${token}`);

  const row = await env.DB.prepare(
    `SELECT
       s.id AS share_id,
       s.memory_story_id AS story_id,
       a.include_photo,
       a.include_voice,
       a.include_captions,
       a.include_narrator_attribution,
       a.include_brand_attribution,
       a.caption,
       ms.primary_photo_asset_id,
       ms.primary_audio_asset_id,
       CASE WHEN a.include_captions = 1 THEN tr.text ELSE NULL END AS transcript_text
     FROM memory_story_shares s
     JOIN living_memory_share_artifacts a ON a.share_id = s.id
     JOIN memory_stories ms ON ms.id = s.memory_story_id
     LEFT JOIN transcript_revisions tr ON tr.id = ms.current_transcript_revision_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND ms.status = 'complete'`
  ).bind(tokenHash).first<PublicShareRow>();

  if (!row) {
    throw new SharingRouteError(404, "share_not_found", "That family share is unavailable.");
  }
  return row;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function publicSharePage(
  env: SharingEnv,
  token: string
): Promise<Response> {
  const share = await publicShareByToken(env, token);
  const caption = share.caption
    ? `<p class="caption">${escapeHtml(share.caption)}</p>`
    : "";
  const transcript = share.include_captions === 1 && share.transcript_text
    ? `<section><h2>Words from this memory</h2><p>${escapeHtml(share.transcript_text)}</p></section>`
    : "";
  const voice = share.include_voice === 1
    ? `<audio controls preload="metadata" src="/shared/${token}/voice"></audio>`
    : "";
  const narrator = share.include_narrator_attribution === 1
    ? "<p>Story told in the storyteller's own voice.</p>"
    : "";
  const brand = share.include_brand_attribution === 1
    ? `<p class="brand">Preserved with ${escapeHtml(appIdentity.brandName)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>A Living Memory</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#f7f4ef;color:#26211d}
main{max-width:720px;margin:auto;padding:24px}
img{max-width:100%;height:auto;border-radius:14px}
audio{width:100%;margin:18px 0}
.caption{font-size:1.15rem}.brand{opacity:.7;font-size:.9rem}
</style>
</head>
<body><main>
<h1>A Living Memory</h1>
${caption}
<img alt="Shared memory photograph" src="/shared/${token}/photo">
${voice}
${narrator}
${transcript}
${brand}
</main></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
    }
  });
}

async function publicShareMedia(
  request: Request,
  env: SharingEnv,
  token: string,
  kind: "photo" | "voice"
): Promise<Response> {
  const share = await publicShareByToken(env, token);
  if (kind === "voice" && share.include_voice !== 1) {
    throw new SharingRouteError(404, "share_media_not_found", "That shared media is unavailable.");
  }

  const assetId = kind === "photo"
    ? share.primary_photo_asset_id
    : share.primary_audio_asset_id;
  const media = await env.DB.prepare(
    `SELECT id, r2_key, content_type, byte_size, sha256, durability_status
     FROM media_assets
     WHERE id = ? AND memory_story_id = ?`
  ).bind(assetId, share.story_id).first<MediaRow>();

  if (!media || media.durability_status !== "durable") {
    throw new SharingRouteError(404, "share_media_not_found", "That shared media is unavailable.");
  }

  const object = await env.MEDIA_BUCKET.get(media.r2_key, { range: request.headers });
  if (!object) {
    throw new SharingRouteError(503, "share_media_unavailable", "That shared media is temporarily unavailable.");
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": media.content_type,
    ETag: object.httpEtag
  });
  const range = object.range;
  if (range && "offset" in range && typeof range.offset === "number") {
    const length = range.length ?? object.size - range.offset;
    headers.set("Content-Length", String(length));
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + length - 1}/${media.byte_size}`
    );
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(media.byte_size));
  return new Response(object.body, { status: 200, headers });
}
export async function handleSharingRoute(
  request: Request,
  env: SharingEnv
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;

  const previewMatch = pathname.match(
    /^\/resources\/living-memories\/([^/]+)\/share-preview$/
  );
  const createMatch = pathname.match(
    /^\/resources\/living-memories\/([^/]+)\/shares$/
  );
  const revokeMatch = pathname.match(
    /^\/resources\/living-memories\/([^/]+)\/shares\/([^/]+)$/
  );
  const publicMediaMatch = pathname.match(/^\/shared\/([^/]+)\/(photo|voice)$/);
  const publicMatch = pathname.match(/^\/shared\/([^/]+)$/);

  if (!previewMatch && !createMatch && !revokeMatch && !publicMediaMatch && !publicMatch) {
    return null;
  }

  try {
    if (previewMatch?.[1] && request.method === "POST") {
      return await previewShare(
        request,
        env,
        validIdentifier(decodeURIComponent(previewMatch[1]), "Living Memory ID")
      );
    }
    if (createMatch?.[1] && request.method === "POST") {
      return await createShare(
        request,
        env,
        validIdentifier(decodeURIComponent(createMatch[1]), "Living Memory ID")
      );
    }
    if (revokeMatch?.[1] && revokeMatch[2] && request.method === "DELETE") {
      return await revokeShare(
        request,
        env,
        validIdentifier(decodeURIComponent(revokeMatch[1]), "Living Memory ID"),
        validIdentifier(decodeURIComponent(revokeMatch[2]), "Share ID")
      );
    }
    if (publicMediaMatch?.[1] && publicMediaMatch[2] && request.method === "GET") {
      return await publicShareMedia(
        request,
        env,
        decodeURIComponent(publicMediaMatch[1]),
        publicMediaMatch[2] as "photo" | "voice"
      );
    }
    if (publicMatch?.[1] && request.method === "GET") {
      return await publicSharePage(env, decodeURIComponent(publicMatch[1]));
    }

    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    const routeError = error instanceof SharingRouteError
      ? error
      : new SharingRouteError(500, "internal", "The family share could not be completed.");
    return json(
      { ok: false, error: { code: routeError.code, message: routeError.message } },
      routeError.status
    );
  }
}
