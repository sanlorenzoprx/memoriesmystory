import { getPrivateObject, privateMediaResponse } from "./private-media";
import { authenticateAppSession, sha256Text } from "./auth-session";
import { readBoundedText } from "./request-body";
import {
  activeFamilyGrant,
  grantAllowsMemory,
  verifiedClerkRecipient,
  type FamilyAccessEnv,
  type FamilyGrant,
} from "./family-permissions";
import { phase1Config } from "../config/phase-1";
const limits = phase1Config.familyAccess,
  idPattern = /^[A-Za-z0-9_-]{8,120}$/;
class AccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
function fail(status: number, code = "family_access_invalid"): never {
  throw new AccessError(status, code);
}
function id(value: unknown): string {
  if (typeof value !== "string" || !idPattern.test(value)) fail(400);
  return value;
}
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
function grantView(g: FamilyGrant & { can_organize?: number }) {
  return {
    canOrganizeAlbums: g.can_organize === 1,
    id: g.id,
    archiveId: g.archive_id,
    role: g.role,
    scopeKind: g.scope_kind,
    scopeId: g.scope_id,
    targetEmail: g.target_email,
    state: g.state,
    version: g.version,
    expiresAt: g.expires_at,
  };
}
async function ownerArchive(
  env: FamilyAccessEnv,
  user: string,
  archiveId: string,
) {
  if (
    !(await env.DB.prepare(
      "SELECT id FROM family_archives WHERE id=? AND owner_user_id=?",
    )
      .bind(archiveId, user)
      .first())
  )
    fail(404, "family_access_not_found");
}
export async function handleFamilyAccessRoute(
  request: Request,
  env: FamilyAccessEnv,
  verifyRecipient = verifiedClerkRecipient,
): Promise<Response | null> {
  const url = new URL(request.url),
    match = url.pathname.match(
      /^\/resources\/family-access(?:\/(grants|invite|memberships)(?:\/([^/]+))?(?:\/(accept|revoke|view|media|album-permission)(?:\/([^/]+))?)?)?$/,
    );
  if (!match) return null;
  try {
    const kind = match[1],
      routeId = match[2],
      action = match[3],
      assetId = match[4];
    let invitation: FamilyGrant | null = null;
    if (kind === "invite") {
      if (!routeId || !/^[a-f0-9]{64}$/.test(routeId) || !env.SESSION_SECRET)
        fail(404, "family_access_not_found");
      invitation = await env.DB.prepare(
        "SELECT * FROM family_access_grants WHERE token_hash=?",
      )
        .bind(await sha256Text(`${env.SESSION_SECRET}:family-token:${routeId}`))
        .first<FamilyGrant>();
      if (
        !invitation ||
        invitation.state === "revoked" ||
        (invitation.state === "pending" &&
          invitation.expires_at <= new Date().toISOString())
      )
        fail(404, "family_access_not_found");
      if (request.method === "GET" && !action)
        return json({
          role: invitation.role,
          scopeKind: invitation.scope_kind,
          expiresAt: invitation.expires_at,
        });
    }
    const session = await authenticateAppSession(request, env);
    if (!session) fail(401, "session_required");
    const user = session.userId;
    if (request.method === "GET") {
      if (kind === "grants" && !routeId) {
        const archiveId = id(url.searchParams.get("archiveId"));
        await ownerArchive(env, user, archiveId);
        const after = url.searchParams.get("after");
        if (after) id(after);
        const rows = (
          await env.DB.prepare(
            "SELECT g.*,CASE WHEN p.grant_id IS NULL THEN 0 ELSE 1 END AS can_organize FROM family_access_grants g LEFT JOIN family_album_permissions p ON p.grant_id=g.id WHERE g.archive_id=? AND g.owner_user_id=? AND g.id>? ORDER BY g.id LIMIT ?",
          )
            .bind(archiveId, user, after ?? "", limits.pageSize + 1)
            .all<FamilyGrant & { can_organize: number }>()
        ).results;
        return json({
          grants: rows.slice(0, limits.pageSize).map(grantView),
          nextCursor:
            rows.length > limits.pageSize
              ? rows[limits.pageSize - 1]!.id
              : null,
        });
      }
      if (kind === "memberships" && !routeId) {
        const after = url.searchParams.get("after");
        if (after) id(after);
        const rows = (
          await env.DB.prepare(
            "SELECT g.*,CASE WHEN EXISTS(SELECT 1 FROM family_album_permissions ap WHERE ap.grant_id=g.id) THEN 1 ELSE 0 END AS can_organize,CASE g.scope_kind WHEN 'memory' THEN l.title WHEN 'chapter' THEN c.title ELSE a.title END AS scope_label FROM family_access_grants g JOIN family_archives a ON a.id=g.archive_id AND a.owner_user_id=g.owner_user_id LEFT JOIN family_memory_labels l ON g.scope_kind='memory' AND l.memory_story_id=g.scope_id LEFT JOIN family_chapters c ON g.scope_kind='chapter' AND c.id=g.scope_id AND c.archive_id=g.archive_id WHERE accepted_by_user_id=? AND state='accepted' AND g.id>? ORDER BY g.id LIMIT ?",
          )
            .bind(user, after ?? "", limits.pageSize + 1)
            .all<
              FamilyGrant & { scope_label: string | null; can_organize: number }
            >()
        ).results;
        return json({
          memberships: rows.slice(0, limits.pageSize).map((g) => ({
            label: g.scope_label,
            id: g.id,
            role: g.role,
            scopeKind: g.scope_kind,
            canOrganizeAlbums: g.can_organize === 1,
          })),
          nextCursor:
            rows.length > limits.pageSize
              ? rows[limits.pageSize - 1]!.id
              : null,
        });
      }
      if (
        kind === "memberships" &&
        routeId &&
        (action === "view" || action === "media")
      ) {
        const grant = await activeFamilyGrant(env, user, id(routeId));
        if (!grant) fail(403, "family_access_denied");
        const currentGrantId = grant.id;
        if (action === "media") {
          const asset = await env.DB.prepare(
            "SELECT a.id,a.memory_story_id,a.r2_key,a.content_type,a.byte_size,a.sha256 FROM media_assets a JOIN memory_stories m ON m.id=a.memory_story_id WHERE a.id=? AND a.durability_status='durable' AND ((a.id=m.primary_photo_asset_id AND a.role='original_photo') OR (a.id=m.primary_audio_asset_id AND a.role='original_audio'))",
          )
            .bind(id(assetId))
            .first<{
              id: string;
              memory_story_id: string;
              r2_key: string;
              content_type: string;
              byte_size: number;
              sha256: string;
            }>();
          if (
            !asset ||
            !(await grantAllowsMemory(env, grant, asset.memory_story_id))
          )
            fail(403, "family_access_denied");
          const { object, ranged } = await getPrivateObject(
            env.MEDIA_BUCKET,
            asset.r2_key,
            request,
          );
          if (!object) fail(503, "family_access_unavailable");
          // Re-check revocation after storage awaits before sending private bytes.
          if (
            !(await activeFamilyGrant(env, user, grant.id)) ||
            !(await grantAllowsMemory(env, grant, asset.memory_story_id))
          )
            fail(403, "family_access_denied");
          return privateMediaResponse(object, ranged, asset.byte_size, {
            "Content-Type": asset.content_type,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Content-SHA256": asset.sha256,
            "Referrer-Policy": "no-referrer",
          });
        }
        const after = url.searchParams.get("after");
        if (after) id(after);
        const rows = (
          await env.DB.prepare(
            "SELECT m.id,l.title,p.id AS photo_id,p.r2_key AS photo_key,v.id AS audio_id,v.r2_key AS audio_key FROM memory_stories m LEFT JOIN family_memory_labels l ON l.memory_story_id=m.id LEFT JOIN media_assets p ON p.id=m.primary_photo_asset_id AND p.memory_story_id=m.id AND p.role='original_photo' AND p.durability_status='durable' LEFT JOIN media_assets v ON v.id=m.primary_audio_asset_id AND v.memory_story_id=m.id AND v.role='original_audio' AND v.durability_status='durable' WHERE m.owner_user_id=? AND m.status='complete' AND m.id>? AND ((?='memory' AND m.id=?) OR (?<>'memory' AND EXISTS(SELECT 1 FROM family_chapter_memories cm JOIN family_chapters c ON c.id=cm.chapter_id WHERE cm.memory_story_id=m.id AND c.archive_id=? AND (?='archive' OR c.id=?)))) ORDER BY m.id LIMIT ?",
          )
            .bind(
              grant.owner_user_id,
              after ?? "",
              grant.scope_kind,
              grant.scope_id,
              grant.scope_kind,
              grant.archive_id,
              grant.scope_kind,
              grant.scope_id,
              limits.memoriesPageSize + 1,
            )
            .all<{
              id: string;
              title: string | null;
              photo_id: string | null;
              photo_key: string | null;
              audio_id: string | null;
              audio_key: string | null;
            }>()
        ).results;
        const memories = await Promise.all(
          rows.slice(0, limits.memoriesPageSize).map(async (row) => {
            async function media(asset: string | null, key: string | null) {
              return asset && key && (await env.MEDIA_BUCKET.head(key))
                ? `/resources/family-access/memberships/${currentGrantId}/media/${asset}`
                : null;
            }
            return {
              id: row.id,
              title: row.title,
              photoUrl: await media(row.photo_id, row.photo_key),
              audioUrl: await media(row.audio_id, row.audio_key),
            };
          }),
        );
        if (!(await activeFamilyGrant(env, user, grant.id)))
          fail(403, "family_access_denied");
        return json({
          membership: {
            id: grant.id,
            role: grant.role,
            scopeKind: grant.scope_kind,
            canOrganizeAlbums: Boolean(
              await env.DB.prepare(
                "SELECT 1 AS ok FROM family_album_permissions WHERE grant_id=?",
              )
                .bind(grant.id)
                .first(),
            ),
          },
          memories: (
            await Promise.all(
              memories.map(async (memory) =>
                (await grantAllowsMemory(env, grant, memory.id))
                  ? memory
                  : null,
              ),
            )
          ).filter(Boolean),
          nextCursor:
            rows.length > limits.memoriesPageSize
              ? rows[limits.memoriesPageSize - 1]!.id
              : null,
        });
      }
      fail(404, "family_access_not_found");
    }
    if (
      request.headers.get("X-Memories-Request") !== "family-v1" ||
      (request.headers.has("Origin") &&
        request.headers.get("Origin") !== url.origin)
    )
      fail(403, "csrf");
    if (request.method !== "POST") fail(405, "method");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(
        (await readBoundedText(request, limits.maximumRequestBytes)) || "{}",
      );
      if (!body || typeof body !== "object" || Array.isArray(body)) fail(400);
    } catch {
      fail(400);
    }
    if (kind === "invite" && action === "accept" && invitation) {
      if (invitation.state === "accepted") {
        if (invitation.accepted_by_user_id !== user)
          fail(403, "family_access_denied");
        return json({
          id: invitation.id,
          version: invitation.version,
          replayed: true,
        });
      }
      if (invitation.owner_user_id === user) fail(400);
      let verified = false;
      try {
        verified = await verifyRecipient(env, user, invitation.target_email);
      } catch {
        fail(503, "family_identity_unavailable");
      }
      if (!verified) fail(403, "family_recipient_mismatch");
      const now = new Date().toISOString();
      const results = await env.DB.batch([
        env.DB.prepare(
          "UPDATE family_access_grants SET state='accepted',accepted_by_user_id=?,accepted_at=?,updated_at=?,version=version+1 WHERE id=? AND state='pending' AND expires_at>? AND version=?",
        ).bind(user, now, now, invitation.id, now, invitation.version),
        env.DB.prepare(
          "INSERT INTO family_access_events(grant_id,version,action,actor_user_id,recorded_at) SELECT id,version,'accepted',?,? FROM family_access_grants WHERE id=? AND state='accepted' AND accepted_by_user_id=? AND changes()=1",
        ).bind(user, now, invitation.id, user),
      ]);
      if (!results[0]!.meta.changes) fail(409, "family_access_conflict");
      return json({ id: invitation.id, version: invitation.version + 1 });
    }
    if (kind === "grants" && routeId && action === "revoke") {
      const grant = await env.DB.prepare(
        "SELECT * FROM family_access_grants WHERE id=? AND owner_user_id=?",
      )
        .bind(id(routeId), user)
        .first<FamilyGrant>();
      if (!grant) fail(404, "family_access_not_found");
      if (grant.state === "revoked")
        return json({ id: grant.id, version: grant.version, replayed: true });
      if (body.version !== grant.version) fail(409, "family_access_conflict");
      const now = new Date().toISOString();
      const result = await env.DB.batch([
        env.DB.prepare(
          "UPDATE family_access_grants SET state='revoked',version=version+1,updated_at=? WHERE id=? AND owner_user_id=? AND version=?",
        ).bind(now, grant.id, user, grant.version),
        env.DB.prepare(
          "INSERT INTO family_access_events SELECT id,version,'revoked',?,? FROM family_access_grants WHERE id=? AND state='revoked' AND changes()=1",
        ).bind(user, now, grant.id),
      ]);
      if (!result[0]!.meta.changes) fail(409, "family_access_conflict");
      return json({ id: grant.id, version: grant.version + 1 });
    }
    if (kind === "grants" && routeId && action === "album-permission") {
      // The owner alone decides, per accepted invitation, whether that person
      // may organize albums. Turning it off leaves their albums with the owner.
      const grant = await env.DB.prepare(
        "SELECT * FROM family_access_grants WHERE id=? AND owner_user_id=?",
      )
        .bind(id(routeId), user)
        .first<FamilyGrant>();
      if (!grant) fail(404, "family_access_not_found");
      if (body.allow !== true && body.allow !== false) fail(400);
      if (grant.state !== "accepted") fail(409, "family_access_conflict");
      const now = new Date().toISOString(),
        eventId = `album_permission_${crypto.randomUUID().replace(/-/g, "")}`;
      await env.DB.batch([
        body.allow
          ? env.DB.prepare(
              "INSERT INTO family_album_permissions(grant_id,granted_by_user_id,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM family_access_grants g WHERE g.id=? AND g.owner_user_id=? AND g.state='accepted') AND NOT EXISTS(SELECT 1 FROM family_album_permissions WHERE grant_id=?)",
            ).bind(grant.id, user, now, grant.id, user, grant.id)
          : env.DB.prepare(
              "DELETE FROM family_album_permissions WHERE grant_id=? AND EXISTS(SELECT 1 FROM family_access_grants g WHERE g.id=? AND g.owner_user_id=?)",
            ).bind(grant.id, grant.id, user),
        env.DB.prepare(
          "INSERT INTO family_album_permission_events(id,grant_id,action,actor_user_id,recorded_at) SELECT ?,?,?,?,? WHERE changes()=1",
        ).bind(eventId, grant.id, body.allow ? "allowed" : "removed", user, now),
      ]);
      const allowed = Boolean(
        await env.DB.prepare(
          "SELECT 1 AS ok FROM family_album_permissions WHERE grant_id=?",
        )
          .bind(grant.id)
          .first(),
      );
      return json({
        id: grant.id,
        version: grant.version,
        canOrganizeAlbums: allowed,
      });
    }
    if (kind !== "grants" || routeId) fail(404, "family_access_not_found");
    const archiveId = id(body.archiveId),
      scopeId = id(body.scopeId),
      scopeKind = body.scopeKind,
      role = body.role;
    await ownerArchive(env, user, archiveId);
    if (
      !["memory", "chapter", "archive"].includes(String(scopeKind)) ||
      !["viewer", "contributor"].includes(String(role))
    )
      fail(400);
    const targetEmail =
      typeof body.targetEmail === "string"
        ? body.targetEmail.trim().toLowerCase()
        : "";
    if (targetEmail.length > 254 || !/^\S+@[^\s@]+\.[^\s@]+$/.test(targetEmail))
      fail(400);
    if (scopeKind === "archive" && scopeId !== archiveId) fail(400);
    if (
      scopeKind === "chapter" &&
      !(await env.DB.prepare(
        "SELECT id FROM family_chapters WHERE id=? AND archive_id=?",
      )
        .bind(scopeId, archiveId)
        .first())
    )
      fail(404, "family_access_not_found");
    if (
      scopeKind === "memory" &&
      !(await env.DB.prepare(
        "SELECT id FROM memory_stories WHERE id=? AND owner_user_id=? AND status='complete'",
      )
        .bind(scopeId, user)
        .first())
    )
      fail(404, "family_access_not_found");
    const key = id(request.headers.get("X-Idempotency-Key")),
      receiptKey = `family_invite_${await sha256Text(`${user}:${key}`)}`,
      hash = await sha256Text(
        JSON.stringify({ archiveId, scopeId, scopeKind, role, targetEmail }),
      ),
      grantId = `family_grant_${(await sha256Text(receiptKey)).slice(0, 40)}`;
    if (!env.SESSION_SECRET) fail(503, "family_access_unavailable");
    const token = await sha256Text(
        `${env.SESSION_SECRET}:family-invitation:${receiptKey}`,
      ),
      path = `/family/join/${token}`;
    async function prior() {
      const row = await env.DB.prepare(
        "SELECT request_hash,result_ref FROM operation_receipts WHERE idempotency_key=? AND scope_type='user' AND scope_id=?",
      )
        .bind(receiptKey, user)
        .first<{ request_hash: string; result_ref: string }>();
      if (row && row.request_hash !== hash) fail(409, "idempotency_conflict");
      return row ? JSON.parse(row.result_ref) : null;
    }
    const old = await prior();
    async function replayCreation(result: Record<string, unknown>) {
      const current = await env.DB.prepare(
        "SELECT state,expires_at,token_hash FROM family_access_grants WHERE id=? AND owner_user_id=?",
      )
        .bind(grantId, user)
        .first<{ state: string; expires_at: string; token_hash: string }>();
      if (
        current?.state !== "pending" ||
        current.expires_at <= new Date().toISOString() ||
        current.token_hash !==
          (await sha256Text(`${env.SESSION_SECRET}:family-token:${token}`))
      )
        fail(409, "family_invitation_inactive");
      return json({ ...result, joinPath: path, replayed: true });
    }
    if (old) return await replayCreation(old);
    const now = new Date(),
      expires = new Date(
        now.getTime() + limits.invitationHours * 3600000,
      ).toISOString(),
      result = { id: grantId, version: 1, expiresAt: expires };
    try {
      const changes = await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO family_access_grants(id,archive_id,owner_user_id,role,scope_kind,scope_id,target_email,token_hash,expires_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM family_access_grants WHERE archive_id=? AND state<>'revoked')<?",
        ).bind(
          grantId,
          archiveId,
          user,
          role,
          scopeKind,
          scopeId,
          targetEmail,
          await sha256Text(`${env.SESSION_SECRET}:family-token:${token}`),
          expires,
          now.toISOString(),
          now.toISOString(),
          archiveId,
          limits.maximumGrants,
        ),
        env.DB.prepare(
          "INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,result_ref,correlation_id,created_at,updated_at) SELECT ?,'family_invite_create','user',?,?,'succeeded',?,?,?,? WHERE changes()=1",
        ).bind(
          receiptKey,
          user,
          hash,
          JSON.stringify(result),
          receiptKey,
          now.toISOString(),
          now.toISOString(),
        ),
        env.DB.prepare(
          "INSERT INTO family_access_events SELECT id,version,'invited',?,? FROM family_access_grants WHERE id=? AND EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?)",
        ).bind(user, now.toISOString(), grantId, receiptKey, hash),
      ]);
      if (!changes[0]!.meta.changes) fail(429, "family_access_limit");
    } catch (error) {
      const winner = await prior();
      if (winner) return await replayCreation(winner);
      throw error;
    }
    return json({ ...result, joinPath: path }, 201);
  } catch (error) {
    return error instanceof AccessError
      ? json({ error: { code: error.code } }, error.status)
      : json({ error: { code: "family_access_unavailable" } }, 503);
  }
}
