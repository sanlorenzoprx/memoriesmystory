import { closeLegacyRemoteCall } from "./legacy-remote";
import type { RealtimeKitEnv } from "./realtimekit";
import { phase1Config } from "../config/phase-1";
import {
  legacyConsentVersion,
  participantsAllowRecording,
  type LegacyMode,
  type LegacyParticipant,
} from "../app/domain/our-living-legacy";
import {
  authenticateAppSession,
  sha256Text,
  type AppSession,
  type AuthSessionEnv,
} from "./auth-session";
import { readBoundedText } from "./request-body";
export type LegacyEnv = AuthSessionEnv & RealtimeKitEnv & { MEDIA_BUCKET: R2Bucket };
export type SessionRow = {
  id: string;
  memory_story_id: string;
  photo_asset_id: string;
  owner_user_id: string;
  mode: LegacyMode;
  status: string;
  deletion_requested_at?:string|null;
  consent_epoch: number;
  version: number;
};
export type ParticipantRow = {
  id: string;
  session_id: string;
  account_user_id: string | null;
  role: "host" | "guest";
  display_name: string | null;
  consent: "pending" | "accepted" | "declined";
  consent_version: string | null;
  invite_hash: string | null;
  invite_expires_at: string | null;
  joined_at: string | null;
  join_request_hash: string | null;
  access_hash: string | null;
  access_expires_at: string | null;
  revoked_at: string | null;
};
export class LegacyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
export const legacyId = /^[A-Za-z0-9_-]{8,120}$/;
export function legacyFail(status: number, code: string): never {
  throw new LegacyError(status, code);
}
export function legacyJson(
  value: unknown,
  status = 200,
  headers: HeadersInit = {},
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      ...headers,
    },
  });
}
export function legacyMutation(request: Request) {
  if (
    request.headers.get("X-Memories-Request") !== "legacy-v1" ||
    (request.headers.has("Origin") &&
      request.headers.get("Origin") !== new URL(request.url).origin)
  )
    legacyFail(403, "csrf");
}
export async function legacyBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse(await readBoundedText(request, 8000));
    if (!value || typeof value !== "object" || Array.isArray(value))
      legacyFail(400, "legacy_invalid");
    return value;
  } catch {
    legacyFail(400, "legacy_invalid");
  }
}
function name(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > phase1Config.legacy.maxNameCharacters
  )
    legacyFail(400, "legacy_name");
  return value.trim();
}
function cookieName(id: string) {
  return `memories_legacy_${id}`;
}
function cookie(request: Request, id: string) {
  return (
    (request.headers.get("Cookie") ?? "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${cookieName(id)}=`))
      ?.slice(cookieName(id).length + 1) ?? ""
  );
}
async function secretToken(env: LegacyEnv, value: string): Promise<string> {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    legacyFail(503, "legacy_unavailable");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
  return btoa(String.fromCharCode(...hash))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function participants(rows: ParticipantRow[]): LegacyParticipant[] {
  return rows.map((p) => ({
    id: p.id,
    role: p.role,
    displayName: p.display_name,
    consent: p.consent_version === legacyConsentVersion ? p.consent : "pending",
    joined:
      Boolean(p.joined_at) &&
      (p.role === "host" ||
        Boolean(
          p.access_expires_at && p.access_expires_at > new Date().toISOString(),
        )),
    revoked: Boolean(p.revoked_at),
  }));
}
export async function legacyAccess(
  request: Request,
  env: LegacyEnv,
  id: string,
): Promise<{
  session: SessionRow;
  actor: ParticipantRow;
  rows: ParticipantRow[];
  account: AppSession | null;
}> {
  if (!legacyId.test(id)) legacyFail(400, "legacy_invalid");
  const session = await env.DB.prepare(
    "SELECT * FROM legacy_sessions WHERE id=?",
  )
    .bind(id)
    .first<SessionRow>();
  if (!session) legacyFail(404, "legacy_not_found");
  if(session.deletion_requested_at)legacyFail(404,"legacy_not_found");
  const rows = (
    await env.DB.prepare(
      "SELECT * FROM legacy_participants WHERE session_id=? ORDER BY created_at,id",
    )
      .bind(id)
      .all<ParticipantRow>()
  ).results;
  const account = await authenticateAppSession(request, env);
  let actor: ParticipantRow | undefined;
  if (
    new URL(request.url).searchParams.get("as") !== "guest" &&
    account?.userId === session.owner_user_id
  )
    actor = rows.find((p) => p.role === "host" && !p.revoked_at);
  if (!actor) {
    const value = cookie(request, id);
    const accessHash = value
      ? await sha256Text(`legacy-access-v1:${id}:${value}`)
      : "";
    actor = rows.find(
      (p) =>
        p.role === "guest" &&
        !p.revoked_at &&
        p.joined_at &&
        p.access_expires_at! > new Date().toISOString() &&
        ((accessHash && p.access_hash === accessHash) ||
          (account && p.account_user_id === account.userId)),
    );
  }
  if (!actor) legacyFail(403, "legacy_participant_required");
  return { session, actor, rows, account };
}
async function list(request: Request, env: LegacyEnv) {
  const account = await authenticateAppSession(request, env);
  if (!account) legacyFail(401, "session_required");
  const memoryId = new URL(request.url).searchParams.get("memoryId") ?? "";
  if (!legacyId.test(memoryId)) legacyFail(400, "legacy_invalid");
  const owned = await env.DB.prepare(
    "SELECT id FROM memory_stories WHERE id=? AND owner_user_id=? AND status='complete'",
  )
    .bind(memoryId, account.userId)
    .first();
  if (!owned) legacyFail(404, "legacy_source_unavailable");
  const sessions = (
    await env.DB.prepare(
      "SELECT id,mode,status,created_at AS createdAt FROM legacy_sessions WHERE memory_story_id=? AND owner_user_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
    )
      .bind(memoryId, account.userId)
      .all()
  ).results;
  return legacyJson({ sessions });
}
async function create(request: Request, env: LegacyEnv) {
  legacyMutation(request);
  const account = await authenticateAppSession(request, env);
  if (!account) legacyFail(401, "session_required");
  const body = await legacyBody(request),
    key = request.headers.get("X-Idempotency-Key") ?? "";
  if (
    !legacyId.test(key) ||
    typeof body.memoryId !== "string" ||
    !legacyId.test(body.memoryId)
  )
    legacyFail(400, "legacy_invalid");
  const hostName = name(body.displayName),
    mode = body.mode;
  if (mode !== "in_person" && mode !== "remote")
    legacyFail(400, "legacy_invalid");
  const source = await env.DB.prepare(
    "SELECT id,primary_photo_asset_id FROM memory_stories WHERE id=? AND owner_user_id=? AND status='complete'",
  )
    .bind(body.memoryId, account.userId)
    .first<{ id: string; primary_photo_asset_id: string }>();
  if (!source) legacyFail(404, "legacy_source_unavailable");
  const photoId =
    typeof body.photoAssetId === "string"
      ? body.photoAssetId
      : source.primary_photo_asset_id;
  const photo = await env.DB.prepare(
    "SELECT id FROM media_assets WHERE id=? AND durability_status='durable' AND (id=? OR (role='enhanced_photo' AND source_asset_id=?))",
  )
    .bind(photoId, source.primary_photo_asset_id, source.primary_photo_asset_id)
    .first();
  if (!photo) legacyFail(404, "legacy_source_unavailable");
  const seed = await sha256Text(`legacy-create-v1:${account.userId}:${key}`),
    id = `legacy_${seed.slice(0, 40)}`,
    hostId = `participant_${seed.slice(0, 36)}_h`,
    guestId = `participant_${seed.slice(0, 36)}_g`;
  const invite = await secretToken(
      env,
      `legacy-invite-v1:${id}:${guestId}:${key}`,
    ),
    requestHash = await sha256Text(
      JSON.stringify([account.userId, body.memoryId, photoId, hostName, mode]),
    );
  const existing = await env.DB.prepare(
    "SELECT request_hash FROM operation_receipts WHERE idempotency_key=?",
  )
    .bind(key)
    .first<{ request_hash: string }>();
  if (existing && existing.request_hash !== requestHash)
    legacyFail(409, "idempotency_conflict");
  if (!existing) {
    const now = new Date().toISOString(),
      expires = new Date(
        Date.now() + phase1Config.legacy.inviteLifetimeHours * 3600000,
      ).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO legacy_sessions(id,memory_story_id,photo_asset_id,owner_user_id,mode,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      ).bind(id, source.id, photoId, account.userId, mode, now, now),
      env.DB.prepare(
        "INSERT INTO legacy_participants(id,session_id,account_user_id,role,display_name,joined_at,created_at) VALUES(?,?,?,'host',?,?,?)",
      ).bind(hostId, id, account.userId, hostName, now, now),
      env.DB.prepare(
        "INSERT INTO legacy_participants(id,session_id,role,invite_hash,invite_expires_at,created_at) VALUES(?,?,'guest',?,?,?)",
      ).bind(
        guestId,
        id,
        await sha256Text(`legacy-invite-v1:${id}:${invite}`),
        expires,
        now,
      ),
      env.DB.prepare(
        "INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,result_ref,correlation_id,created_at,updated_at) VALUES(?,'legacy_create','story',?,?,'succeeded',?,?,?,?)",
      ).bind(
        key,
        source.id,
        requestHash,
        id,
        `cor_${crypto.randomUUID()}`,
        now,
        now,
      ),
    ]);
  }
  return legacyJson(
    {
      sessionId: id,
      joinPath: `/legacy/${id}/join#${invite}`,
      replayed: Boolean(existing),
    },
    existing ? 200 : 201,
  );
}
async function join(request: Request, env: LegacyEnv, id: string) {
  legacyMutation(request);
  if (!legacyId.test(id)) legacyFail(400, "legacy_invalid");
  const body = await legacyBody(request),
    displayName = name(body.displayName),
    key = request.headers.get("X-Idempotency-Key") ?? "";
  if (
    !legacyId.test(key) ||
    typeof body.inviteToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(body.inviteToken)
  )
    legacyFail(400, "legacy_invalid");
  const inviteHash = await sha256Text(
    `legacy-invite-v1:${id}:${body.inviteToken}`,
  );
  const participant = await env.DB.prepare(
    "SELECT * FROM legacy_participants WHERE session_id=? AND role='guest' AND invite_hash=? AND revoked_at IS NULL",
  )
    .bind(id, inviteHash)
    .first<ParticipantRow>();
  if (!participant) legacyFail(403, "legacy_invite_unavailable");
  const requestHash = await sha256Text(
    JSON.stringify([inviteHash, key, displayName]),
  );
  if (participant.joined_at && participant.join_request_hash !== requestHash)
    legacyFail(409, "legacy_invite_used");
  if (
    !participant.joined_at &&
    participant.invite_expires_at! <= new Date().toISOString()
  )
    legacyFail(403, "legacy_invite_unavailable");
  const access = await secretToken(
      env,
      `legacy-access-v1:${id}:${inviteHash}:${key}`,
    ),
    now = new Date().toISOString();
  const expires =
    participant.access_expires_at ??
    new Date(
      Date.now() + phase1Config.legacy.guestAccessDays * 86400000,
    ).toISOString();
  if (expires <= now) legacyFail(403, "legacy_invite_unavailable");
  const account = await authenticateAppSession(request, env);
  const owner = await env.DB.prepare(
    "SELECT owner_user_id FROM legacy_sessions WHERE id=? AND status!='closed'",
  )
    .bind(id)
    .first<{ owner_user_id: string }>();
  if (!owner) legacyFail(404, "legacy_not_found");
  if (!participant.joined_at)
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE legacy_participants SET display_name=?,account_user_id=?,joined_at=?,join_request_hash=?,access_hash=?,access_expires_at=? WHERE id=? AND joined_at IS NULL AND revoked_at IS NULL",
      ).bind(
        displayName,
        account?.userId !== owner.owner_user_id
          ? (account?.userId ?? null)
          : null,
        now,
        requestHash,
        await sha256Text(`legacy-access-v1:${id}:${access}`),
        expires,
        participant.id,
      ),
      env.DB.prepare(
        "UPDATE legacy_sessions SET version=version+1,updated_at=? WHERE id=?",
      ).bind(now, id),
    ]);
  const accepted = await env.DB.prepare(
    "SELECT join_request_hash FROM legacy_participants WHERE id=? AND revoked_at IS NULL",
  )
    .bind(participant.id)
    .first<{ join_request_hash: string }>();
  if (accepted?.join_request_hash !== requestHash)
    legacyFail(409, "legacy_invite_used");
  return legacyJson({ sessionId: id, participantId: participant.id }, 200, {
    "Set-Cookie": `${cookieName(id)}=${access}; Path=/resources/legacy-sessions/${id}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, Math.floor((Date.parse(expires) - Date.now()) / 1000))}`,
  });
}
export async function handleLegacySessionRoute(
  request: Request,
  env: LegacyEnv,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === "/resources/legacy-sessions") {
    try {
      if (request.method === "GET") return await list(request, env);
      if (request.method === "POST") return await create(request, env);
      return legacyJson({ error: { code: "method" } }, 405);
    } catch (error) {
      const e =
        error instanceof LegacyError
          ? error
          : new LegacyError(503, "legacy_unavailable");
      return legacyJson({ error: { code: e.code } }, e.status);
    }
  }
  const match = path.match(
    /^\/resources\/legacy-sessions\/([^/]+)(?:\/(join|photo|consent|revoke|invitation))?$/,
  );
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]!);
    if (match[2] === "join" && request.method === "POST")
      return await join(request, env, id);
    const { session, actor, rows } = await legacyAccess(request, env, id);
    if (match[2] === "invitation" && request.method === "GET") {
      if (actor.role !== "host") legacyFail(403, "legacy_host_required");
      const guest = rows.find(
        (p) =>
          p.role === "guest" &&
          !p.revoked_at &&
          !p.joined_at &&
          p.invite_expires_at! > new Date().toISOString(),
      );
      if (!guest) return legacyJson({ joinPath: null });
      const receipt = await env.DB.prepare(
        "SELECT idempotency_key FROM operation_receipts WHERE operation_kind='legacy_create' AND result_ref=?",
      )
        .bind(id)
        .first<{ idempotency_key: string }>();
      if (!receipt) legacyFail(503, "legacy_unavailable");
      const token = await secretToken(
        env,
        `legacy-invite-v1:${id}:${guest.id}:${receipt.idempotency_key}`,
      );
      return legacyJson({ joinPath: `/legacy/${id}/join#${token}` });
    }
    if (match[2] === "photo" && request.method === "GET") {
      const photo = await env.DB.prepare(
        "SELECT r2_key,content_type FROM media_assets WHERE id=? AND durability_status='durable'",
      )
        .bind(session.photo_asset_id)
        .first<{ r2_key: string; content_type: string }>();
      if (!photo) legacyFail(404, "legacy_source_unavailable");
      const object = await env.MEDIA_BUCKET.get(photo.r2_key);
      if (!object) legacyFail(503, "legacy_source_unavailable");
      return new Response(object.body, {
        headers: {
          "Content-Type": photo.content_type,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    if (!match[2] && request.method === "GET")
      return legacyJson({
        id: session.id,
        ...(actor.role==="host"?{memoryId:session.memory_story_id}:{}),
        mode: session.mode,
        status: session.status,
        version: session.version,
        consentEpoch: session.consent_epoch,
        consentVersion: legacyConsentVersion,
        actorId: actor.id,
        actorRole: actor.role,
        photoUrl: `/resources/legacy-sessions/${id}/photo${actor.role === "guest" ? "?as=guest" : ""}`,
        participants: participants(rows),
        canRecord:
          session.status !== "closed" &&
          participantsAllowRecording(participants(rows)),
      });
    legacyMutation(request);
    if (request.method !== "POST") legacyFail(405, "method");
    const body = await legacyBody(request),
      now = new Date().toISOString();
    if (match[2] === "consent") {
      if (body.participantId !== undefined && body.participantId !== actor.id)
        legacyFail(403, "legacy_self_required");
      if (
        session.status === "closed" ||
        body.version !== legacyConsentVersion ||
        typeof body.agree !== "boolean"
      )
        legacyFail(409, "legacy_consent_changed");
      const decision = body.agree ? "accepted" : "declined";
      if (
        actor.consent === decision &&
        actor.consent_version === legacyConsentVersion
      )
        return legacyJson({ ok: true, replayed: true });
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO legacy_consent_events(id,session_id,participant_id,decision,consent_version,scope,created_at) VALUES(?,?,?,?,?,?,?)",
        ).bind(
          `consent_${crypto.randomUUID()}`,
          id,
          actor.id,
          decision,
          legacyConsentVersion,
          session.mode === "remote" ? "audio_video" : "audio",
          now,
        ),
        env.DB.prepare(
          "UPDATE legacy_participants SET consent=?,consent_version=? WHERE id=? AND revoked_at IS NULL",
        ).bind(decision, legacyConsentVersion, actor.id),
        env.DB.prepare(
          "UPDATE legacy_sessions SET consent_epoch=consent_epoch+1,version=version+1,updated_at=?,status=CASE WHEN status='live' THEN 'paused' ELSE status END WHERE id=?",
        ).bind(now, id),
      ]);
      return legacyJson({ ok: true });
    }
    if (match[2] === "revoke") {
      if (actor.role !== "host") legacyFail(403, "legacy_host_required");
      const target = rows.find(
        (p) => p.id === body.participantId && p.role === "guest",
      );
      if (!target) legacyFail(404, "legacy_not_found");
      if (target.revoked_at) return legacyJson({ ok: true, replayed: true });
      await closeLegacyRemoteCall(env, id);
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE legacy_participants SET revoked_at=?,consent='declined',access_hash=NULL WHERE id=?",
        ).bind(now, target.id),
        env.DB.prepare(
          "UPDATE legacy_sessions SET consent_epoch=consent_epoch+1,version=version+1,status=CASE WHEN status='live' THEN 'paused' ELSE status END,updated_at=? WHERE id=?",
        ).bind(now, id),
      ]);
      return legacyJson({ ok: true });
    }
    legacyFail(405, "method");
  } catch (error) {
    const e =
      error instanceof LegacyError
        ? error
        : new LegacyError(503, "legacy_unavailable");
    return legacyJson({ error: { code: e.code } }, e.status);
  }
}
