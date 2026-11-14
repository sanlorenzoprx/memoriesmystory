import { phase1Config } from "../config/phase-1";
import {
  legacyConsentVersion,
  participantsAllowRecording,
} from "../app/domain/our-living-legacy";
import { sha256Text } from "./auth-session";
import { hasMediaSignature } from "./media-routes";
import { readBoundedBytes, RequestBodyTooLarge } from "./request-body";
import {
  legacyAccess,
  legacyBody,
  legacyFail,
  legacyId,
  legacyJson,
  legacyMutation,
  LegacyError,
  type LegacyEnv,
  type ParticipantRow,
} from "./legacy-sessions";
type Recording = {
  id: string;
  session_id: string;
  captured_by_participant_id: string;
  consent_epoch: number;
  consent_snapshot_json: string;
  source_photo_asset_id: string;
  created_at: string;
  upload_expires_at: string;
};
type Media = {
  recording_id: string;
  r2_key: string;
  sha256: string;
  byte_size: number;
  content_type: string;
  duration_ms: number;
  interrupted: number;
  durability_status: string;
  r2_etag: string | null;
  durable_at: string | null;
};
function agreed(rows: ParticipantRow[]) {
  return participantsAllowRecording(
    rows.map((p) => ({
      id: p.id,
      role: p.role,
      displayName: p.display_name,
      consent:
        p.consent_version === legacyConsentVersion ? p.consent : "pending",
      joined:
        Boolean(p.joined_at) &&
        (p.role === "host" ||
          Boolean(
            p.access_expires_at &&
            p.access_expires_at > new Date().toISOString(),
          )),
      revoked: Boolean(p.revoked_at),
    })),
  );
}
function receipt(r: Recording, m: Media) {
  return {
    recordingId: r.id,
    status: "durable",
    sha256: m.sha256,
    byteSize: m.byte_size,
    durationMs: m.duration_ms,
    interrupted: Boolean(m.interrupted),
    capturedByParticipantId: r.captured_by_participant_id,
    photoAssetId: r.source_photo_asset_id,
    consentEpoch: r.consent_epoch,
    durableAt: m.durable_at,
  };
}
async function start(request: Request, env: LegacyEnv, id: string) {
  legacyMutation(request);
  const { session, actor, rows } = await legacyAccess(request, env, id);
  if (actor.role !== "host") legacyFail(403, "legacy_host_required");
  if (session.mode !== "in_person") legacyFail(409, "legacy_in_person_only");
  const key = request.headers.get("X-Idempotency-Key") ?? "";
  if (!legacyId.test(key)) legacyFail(400, "legacy_invalid");
  const recordingId = `recording_${(await sha256Text(`legacy-recording-v1:${id}:${actor.id}:${key}`)).slice(0, 40)}`;
  const existing = await env.DB.prepare(
    "SELECT * FROM legacy_recordings WHERE id=? AND session_id=?",
  )
    .bind(recordingId, id)
    .first<Recording>();
  if (
    session.status === "closed" ||
    !agreed(rows) ||
    (existing &&
      (existing.consent_epoch !== session.consent_epoch ||
        existing.upload_expires_at <= new Date().toISOString()))
  )
    legacyFail(409, "legacy_consent_changed");
  if (existing)
    return legacyJson({
      recordingId: existing.id,
      consentEpoch: existing.consent_epoch,
      uploadExpiresAt: existing.upload_expires_at,
      replayed: true,
    });
  if (session.status === "closed" || !agreed(rows))
    legacyFail(409, "legacy_consent_changed");
  const now = new Date().toISOString(),
    expires = new Date(
      Date.now() + phase1Config.legacy.recordingUploadHours * 3600000,
    ).toISOString();
  const events = (
    await env.DB.prepare(
      "SELECT e.id,e.participant_id,e.decision,e.consent_version,e.created_at FROM legacy_consent_events e JOIN legacy_participants p ON p.id=e.participant_id WHERE e.session_id=? AND p.revoked_at IS NULL AND e.decision='accepted' AND e.rowid=(SELECT max(latest.rowid) FROM legacy_consent_events latest WHERE latest.participant_id=p.id) ORDER BY e.participant_id",
    )
      .bind(id)
      .all()
  ).results;
  if (events.length !== 2) legacyFail(409, "legacy_consent_changed");
  await env.DB.prepare(
    "INSERT INTO legacy_recordings(id,session_id,captured_by_participant_id,consent_epoch,consent_snapshot_json,source_photo_asset_id,created_at,upload_expires_at) VALUES(?,?,?,?,?,?,?,?)",
  )
    .bind(
      recordingId,
      id,
      actor.id,
      session.consent_epoch,
      JSON.stringify(events),
      session.photo_asset_id,
      now,
      expires,
    )
    .run();
  return legacyJson(
    {
      recordingId,
      consentEpoch: session.consent_epoch,
      uploadExpiresAt: expires,
      replayed: false,
    },
    201,
  );
}
async function upload(request: Request, env: LegacyEnv, r: Recording) {
  legacyMutation(request);
  const access = await legacyAccess(request, env, r.session_id);
  if (
    access.actor.id !== r.captured_by_participant_id ||
    access.actor.role !== "host"
  )
    legacyFail(403, "legacy_host_required");
  const sha = request.headers.get("X-Content-SHA256") ?? "",
    type = (request.headers.get("Content-Type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase(),
    duration = Number(request.headers.get("X-Audio-Duration-MS")),
    partial = request.headers.get("X-Recording-Interrupted");
  if (
    !/^[a-f0-9]{64}$/.test(sha) ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > phase1Config.legacy.maxRecordingSeconds * 1000 + 1500 ||
    !["0", "1"].includes(partial ?? "")
  )
    legacyFail(400, "legacy_recording_invalid");
  if (
    !(phase1Config.media.supportedAudioMimeTypes as readonly string[]).includes(
      type,
    )
  )
    legacyFail(415, "legacy_recording_invalid");
  const existing = await env.DB.prepare(
    "SELECT * FROM legacy_recording_media WHERE recording_id=?",
  )
    .bind(r.id)
    .first<Media>();
  if (
    existing &&
    (existing.sha256 !== sha ||
      existing.content_type !== type ||
      existing.duration_ms !== duration ||
      existing.interrupted !== Number(partial))
  )
    legacyFail(409, "idempotency_conflict");
  if (existing?.durability_status === "durable")
    return legacyJson(receipt(r, existing));
  const check = async () => {
    const { session, rows } = await legacyAccess(request, env, r.session_id);
    if (
      session.status === "closed" ||
      session.consent_epoch !== r.consent_epoch ||
      !agreed(rows) ||
      r.upload_expires_at <= new Date().toISOString()
    )
      legacyFail(409, "legacy_consent_changed");
  };
  await check();
  const bytes = await readBoundedBytes(
    request,
    phase1Config.media.maxAudioBytes,
  );
  if (!bytes.length || !hasMediaSignature(bytes, type))
    legacyFail(415, "legacy_recording_invalid");
  const digest = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== sha) legacyFail(400, "checksum_mismatch");
  if (existing && existing.byte_size !== bytes.length)
    legacyFail(409, "idempotency_conflict");
  const key = `legacy/${r.session_id}/recordings/${r.id}/original`;
  if (!existing)
    await env.DB.prepare(
      "INSERT INTO legacy_recording_media(recording_id,r2_key,sha256,byte_size,content_type,duration_ms,interrupted,durability_status) VALUES(?,?,?,?,?,?,?,'pending') ON CONFLICT(recording_id) DO NOTHING",
    )
      .bind(r.id, key, sha, bytes.length, type, duration, Number(partial))
      .run();
  const media = (await env.DB.prepare(
    "SELECT * FROM legacy_recording_media WHERE recording_id=?",
  )
    .bind(r.id)
    .first<Media>())!;
  if (
    media.sha256 !== sha ||
    media.content_type !== type ||
    media.byte_size !== bytes.length ||
    media.duration_ms !== duration ||
    media.interrupted !== Number(partial)
  )
    legacyFail(409, "idempotency_conflict");
  await check();
  try {
    let object = await env.MEDIA_BUCKET.head(key);
    if (!object) {
      await env.MEDIA_BUCKET.put(key, bytes.buffer, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: { contentType: type, cacheControl: "private, no-store" },
        customMetadata: {
          sha256: sha,
          recordingId: r.id,
          sessionId: r.session_id,
        },
      });
      object = await env.MEDIA_BUCKET.head(key);
    }
    if (
      !object ||
      object.customMetadata?.sha256 !== sha ||
      object.size !== bytes.length
    )
      legacyFail(503, "legacy_recording_pending");
    await check();
    const durableAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE legacy_recording_media SET durability_status='durable',r2_etag=?,durable_at=? WHERE recording_id=? AND durability_status='pending'",
      ).bind(object.etag, durableAt, r.id),
      env.DB.prepare(
        "UPDATE legacy_sessions SET version=version+1,updated_at=? WHERE id=?",
      ).bind(durableAt, r.session_id),
    ]);
    const confirmed = (await env.DB.prepare(
      "SELECT * FROM legacy_recording_media WHERE recording_id=?",
    )
      .bind(r.id)
      .first<Media>())!;
    return legacyJson(receipt(r, confirmed), existing ? 200 : 201);
  } catch (error) {
    // Whole-memory deletion is explicit authority to remove a late, unconfirmed upload.
    // Consent withdrawal alone does not invent a retention/deletion policy.
    const parent = await env.DB.prepare(
      "SELECT deletion_requested_at FROM legacy_sessions WHERE id=?",
    )
      .bind(r.session_id)
      .first<{ deletion_requested_at: string | null }>();
    if (!parent || parent.deletion_requested_at)
      await env.MEDIA_BUCKET.delete(key);
    throw error;
  }
}
async function claim(request: Request, env: LegacyEnv, r: Recording) {
  legacyMutation(request);
  const { actor } = await legacyAccess(request, env, r.session_id),
    body = await legacyBody(request),
    key = request.headers.get("X-Idempotency-Key") ?? "";
  if (body.participantId !== undefined && body.participantId !== actor.id)
    legacyFail(403, "legacy_self_required");
  const start = body.startMs,
    end = body.endMs,
    note = body.note ?? "";
  const media = await env.DB.prepare(
    "SELECT duration_ms FROM legacy_recording_media WHERE recording_id=? AND durability_status='durable'",
  )
    .bind(r.id)
    .first<{ duration_ms: number }>();
  if (
    !media ||
    !legacyId.test(key) ||
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > media.duration_ms ||
    typeof note !== "string" ||
    note.length > phase1Config.legacy.maxSpeakerNoteCharacters
  )
    legacyFail(400, "legacy_recording_invalid");
  const claimId = `claim_${(await sha256Text(`legacy-claim-v1:${r.id}:${actor.id}:${key}`)).slice(0, 40)}`;
  const old = await env.DB.prepare(
    "SELECT start_ms,end_ms,note FROM legacy_recording_claims WHERE id=?",
  )
    .bind(claimId)
    .first<{ start_ms: number; end_ms: number; note: string }>();
  if (
    old &&
    (old.start_ms !== start || old.end_ms !== end || old.note !== note.trim())
  )
    legacyFail(409, "idempotency_conflict");
  if (!old)
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO legacy_recording_claims(id,recording_id,participant_id,start_ms,end_ms,note,attribution_type,created_at) VALUES(?,?,?,?,?,?,'self_identified',?)",
      ).bind(
        claimId,
        r.id,
        actor.id,
        start,
        end,
        note.trim(),
        new Date().toISOString(),
      ),
      env.DB.prepare(
        "UPDATE legacy_sessions SET version=version+1,updated_at=? WHERE id=?",
      ).bind(new Date().toISOString(), r.session_id),
    ]);
  return legacyJson({ claimId, replayed: Boolean(old) }, old ? 200 : 201);
}
export async function handleLegacyRecordingRoute(
  request: Request,
  env: LegacyEnv,
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(
    /^\/resources\/legacy-sessions\/([^/]+)\/recordings(?:\/([^/]+)(?:\/(media|claims))?)?$/,
  );
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]!);
    if (!legacyId.test(id)) legacyFail(400, "legacy_invalid");
    if (!match[2]) {
      if (request.method === "POST") return await start(request, env, id);
      if (request.method !== "GET") legacyFail(405, "method");
      const { actor } = await legacyAccess(request, env, id);
      const sources = (
        await env.DB.prepare(
          "SELECT r.*,m.* FROM legacy_recordings r JOIN legacy_recording_media m ON m.recording_id=r.id WHERE r.session_id=? AND m.durability_status='durable' ORDER BY r.created_at,r.id",
        )
          .bind(id)
          .all<Recording & Media>()
      ).results;
      const claims = (
        await env.DB.prepare(
          "SELECT c.id,c.recording_id AS recordingId,c.participant_id AS participantId,c.start_ms AS startMs,c.end_ms AS endMs,c.note,c.attribution_type AS attributionType,p.display_name AS displayName FROM legacy_recording_claims c JOIN legacy_recordings r ON r.id=c.recording_id JOIN legacy_participants p ON p.id=c.participant_id WHERE r.session_id=? ORDER BY c.created_at,c.id",
        )
          .bind(id)
          .all()
      ).results;
      return legacyJson({
        recordings: sources.map((r) => ({
          ...receipt(r, r),
          mediaUrl: `/resources/legacy-sessions/${id}/recordings/${r.id}/media${actor.role === "guest" ? "?as=guest" : ""}`,
          attribution: "unconfirmed",
          claims: claims.filter((c) => c.recordingId === r.id),
        })),
      });
    }
    const rid = decodeURIComponent(match[2]);
    if (!legacyId.test(rid)) legacyFail(400, "legacy_invalid");
    await legacyAccess(request, env, id);
    const recording = await env.DB.prepare(
      "SELECT * FROM legacy_recordings WHERE id=? AND session_id=?",
    )
      .bind(rid, id)
      .first<Recording>();
    if (!recording) legacyFail(404, "legacy_not_found");
    if (!match[3] && request.method === "PUT")
      return await upload(request, env, recording);
    if (match[3] === "claims" && request.method === "POST")
      return await claim(request, env, recording);
    if (match[3] === "media" && request.method === "GET") {
      const media = await env.DB.prepare(
        "SELECT * FROM legacy_recording_media WHERE recording_id=? AND durability_status='durable'",
      )
        .bind(rid)
        .first<Media>();
      if (!media) legacyFail(404, "legacy_not_found");
      const object = await env.MEDIA_BUCKET.get(
        media.r2_key,
        request.headers.has("Range") ? { range: request.headers } : undefined,
      );
      if (!object) legacyFail(503, "legacy_recording_pending");
      const headers = new Headers({
        "Content-Type": media.content_type,
        "Cache-Control": "private, no-store",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      });
      if (
        object.range &&
        "offset" in object.range &&
        typeof object.range.offset === "number"
      ) {
        const length = object.range.length ?? object.size - object.range.offset;
        headers.set(
          "Content-Range",
          `bytes ${object.range.offset}-${object.range.offset + length - 1}/${media.byte_size}`,
        );
        headers.set("Content-Length", String(length));
        return new Response(object.body, { status: 206, headers });
      }
      headers.set("Content-Length", String(media.byte_size));
      return new Response(object.body, { headers });
    }
    legacyFail(405, "method");
  } catch (error) {
    const e =
      error instanceof LegacyError
        ? error
        : error instanceof RequestBodyTooLarge
          ? new LegacyError(413, "legacy_recording_invalid")
          : new LegacyError(503, "legacy_recording_pending");
    return legacyJson({ error: { code: e.code } }, e.status);
  }
}
