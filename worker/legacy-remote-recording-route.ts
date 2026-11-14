import { realtimeKitConfigured } from "./realtimekit";
import { phase1Config } from "../config/phase-1";
import {
  legacyAccess,
  legacyMutation,
  legacyBody,
  legacyId,
  legacyJson,
  legacyFail,
  LegacyError,
} from "./legacy-sessions";
import {
  groupById,
  sourceKeyId,
  armRemoteRecorder,
  requestRemoteRecordingStop,
  recordingConsentCurrent,
  type RemoteRecordingEnv,
  type RemoteRecordingRow,
  type RemoteSourceRow,
} from "./legacy-remote-recording-data";
import {
  participantsAllowRecording,
  legacyConsentVersion,
} from "../app/domain/our-living-legacy";

export async function remoteRecordingViews(
  env: RemoteRecordingEnv,
  sessionId: string,
  actorRole: "host" | "guest",
) {
  const groups = (
    await env.DB.prepare(
      "SELECT * FROM legacy_remote_recordings WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 50",
    )
      .bind(sessionId)
      .all<RemoteRecordingRow>()
  ).results;
  return Promise.all(
    groups.map(async (group) => {
      const sources = (
        await env.DB.prepare(
          "SELECT x.*,EXISTS(SELECT 1 FROM legacy_remote_source_claims c WHERE c.source_id=x.id) AS speaker_confirmed FROM legacy_remote_sources x WHERE x.recording_id=? AND x.durability_status='durable' ORDER BY x.kind,x.participant_id,x.id",
        )
          .bind(group.id)
          .all<RemoteSourceRow & { speaker_confirmed: number }>()
      ).results;
      const visible = ["preserved", "partial_preserved"].includes(group.phase);
      return {
        id: group.id,
        phase: group.phase,
        captureStopped: Boolean(group.capture_stopped),
        requestedAt: group.created_at,
        preservedAt: group.preserved_at,
        completeness: "review_required" as const,
        sources: visible
          ? sources.map((source) => ({
              id: source.id,
              kind: source.kind,
              participantId: source.participant_id,
              byteSize: source.byte_size!,
              sha256: source.sha256!,
              speakerConfirmed: Boolean(source.speaker_confirmed),
              mediaUrl: `/resources/legacy-sessions/${sessionId}/remote-recordings/${group.id}/sources/${source.id}${actorRole === "guest" ? "?as=guest" : ""}`,
            }))
          : [],
      };
    }),
  );
}
export async function handleRemoteRecordingRoute(
  request: Request,
  env: RemoteRecordingEnv,
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(
    /^\/resources\/legacy-sessions\/([^/]+)\/remote-recordings(?:\/([^/]+)(?:\/(stop|retry|sources)(?:\/([^/]+)(?:\/(claim))?)?)?)?$/,
  );
  if (!match) return null;
  try {
    const sessionId = decodeURIComponent(match[1]!),
      access = await legacyAccess(request, env, sessionId);
    if (access.session.mode !== "remote")
      legacyFail(409, "legacy_in_person_only");
    const groupId = match[2] ? decodeURIComponent(match[2]) : null,
      sourceId = match[4] ? decodeURIComponent(match[4]) : null;
    if (!groupId && request.method === "GET")
      return legacyJson({
        recordings: await remoteRecordingViews(
          env,
          sessionId,
          access.actor.role,
        ),
        available:
          env.LEGACY_REMOTE_RECORDING_ENABLED === "true" &&
          Boolean(env.LEGACY_RECORDERS),
      });
    if (groupId && !legacyId.test(groupId)) legacyFail(400, "legacy_invalid");
    if (sourceId && !legacyId.test(sourceId)) legacyFail(400, "legacy_invalid");
    if (sourceId) {
      const source = await env.DB.prepare(
        "SELECT x.* FROM legacy_remote_sources x JOIN legacy_remote_recordings r ON r.id=x.recording_id WHERE x.id=? AND r.id=? AND r.session_id=? AND r.phase IN ('preserved','partial_preserved') AND x.durability_status='durable'",
      )
        .bind(sourceId, groupId, sessionId)
        .first<RemoteSourceRow>();
      if (!source) legacyFail(404, "legacy_not_found");
      if (request.method === "GET" && !match[5]) {
        const object = await env.MEDIA_BUCKET.get(source.r2_key!, {
          range: request.headers,
        });
        if (!object) legacyFail(503, "legacy_recording_pending");
        const headers = new Headers({
          "Content-Type": source.content_type,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Accept-Ranges": "bytes",
        });
        headers.set("Content-Length", String(object.size));
        let status = 200;
        if (
          request.headers.has("Range") &&
          object.range &&
          "offset" in object.range
        ) {
          const offset = object.range.offset ?? 0,
            length = object.range.length ?? object.size;
          headers.set(
            "Content-Range",
            `bytes ${offset}-${offset + length - 1}/${object.size}`,
          );
          headers.set("Content-Length", String(length));
          status = 206;
        }
        return new Response(object.body, { status, headers });
      }
      legacyMutation(request);
      if (request.method !== "POST" || match[5] !== "claim")
        legacyFail(405, "method");
      if (
        source.participant_id !== access.actor.id ||
        source.kind !== "participant_audio"
      )
        legacyFail(403, "legacy_self_required");
      const body = await legacyBody(request),
        note = typeof body.note === "string" ? body.note.trim() : "";
      if (
        body.confirm !== true ||
        !note ||
        note.length > phase1Config.legacy.maxSpeakerNoteCharacters
      )
        legacyFail(400, "legacy_invalid");
      const key = request.headers.get("X-Idempotency-Key") ?? "";
      if (!legacyId.test(key)) legacyFail(400, "legacy_invalid");
      const id = `remote_claim_${(await sourceKeyId(`${source.id}:${access.actor.id}:${key}`)).slice(0, 40)}`;
      const old = await env.DB.prepare(
        "SELECT note FROM legacy_remote_source_claims WHERE id=?",
      )
        .bind(id)
        .first<{ note: string }>();
      if (old && old.note !== note) legacyFail(409, "idempotency_conflict");
      if (!old)
        await env.DB.prepare(
          "INSERT INTO legacy_remote_source_claims(id,source_id,participant_id,note,created_at) VALUES(?,?,?,?,?)",
        )
          .bind(id, source.id, access.actor.id, note, new Date().toISOString())
          .run();
      return legacyJson({ ok: true });
    }
    legacyMutation(request);
    if (request.method !== "POST") legacyFail(405, "method");
    if (groupId && match[3] === "retry") {
      if (access.actor.role !== "host") legacyFail(403, "legacy_host_required");
      const group = await groupById(env, groupId);
      if (!group || group.session_id !== sessionId)
        legacyFail(404, "legacy_not_found");
      if (["preserved", "partial_preserved", "discarded"].includes(group.phase))
        return legacyJson({ ok: true });
      // A retry may recover interrupted storage, never allocate a replacement recorder.
      if (["needs_review", "failed"].includes(group.phase)) {
        if (
          !group.capture_stopped ||
          !group.provider_track_id ||
          !group.provider_composite_id ||
          !(await recordingConsentCurrent(env, group))
        )
          legacyFail(409, "legacy_recording_review_required");
        await env.DB.prepare(
          "UPDATE legacy_remote_recordings SET phase='processing',failure_code=NULL,failure_count=0,updated_at=? WHERE id=? AND capture_stopped=1 AND phase IN ('needs_review','failed')",
        )
          .bind(new Date().toISOString(), group.id)
          .run();
      }
      await armRemoteRecorder(env, sessionId);
      return legacyJson({ ok: true }, 202);
    }
    if (groupId && match[3] === "stop") {
      const group = await groupById(env, groupId);
      if (!group || group.session_id !== sessionId)
        legacyFail(404, "legacy_not_found");
      // Either participant may stop capture; this does not change their future consent.
      await requestRemoteRecordingStop(env, sessionId);
      return legacyJson({ ok: true }, 202);
    }
    if (groupId) legacyFail(405, "method");
    if (access.actor.role !== "host") legacyFail(403, "legacy_host_required");
    if (
      env.LEGACY_REMOTE_RECORDING_ENABLED !== "true" ||
      !env.LEGACY_RECORDERS ||
      !realtimeKitConfigured(env)
    )
      legacyFail(503, "legacy_remote_recording_unavailable");
    const key = request.headers.get("X-Idempotency-Key") ?? "";
    if (!legacyId.test(key)) legacyFail(400, "legacy_invalid");
    const id = `remote_recording_${(await sourceKeyId(`${sessionId}:${access.actor.id}:${key}`)).slice(0, 40)}`;
    const old = await groupById(env, id);
    if (old) {
      await armRemoteRecorder(env, sessionId);
      return legacyJson({ recordingId: id, replayed: true }, 200);
    }
    if (
      access.session.status === "closed" ||
      !participantsAllowRecording(
        access.rows.map((p) => ({
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
      )
    )
      legacyFail(409, "legacy_consent_changed");
    const call = await env.DB.prepare(
      "SELECT meeting_id FROM legacy_remote_calls WHERE session_id=? AND state='ready'",
    )
      .bind(sessionId)
      .first<{ meeting_id: string }>();
    if (!call) legacyFail(409, "legacy_call_unavailable");
    const busy = await env.DB.prepare(
      "SELECT id FROM legacy_remote_recordings WHERE session_id=? AND (phase NOT IN ('preserved','partial_preserved','needs_review','failed','discarded') OR capture_stopped=0) LIMIT 1",
    )
      .bind(sessionId)
      .first();
    if (busy) legacyFail(409, "legacy_recording_busy");
    const now = new Date().toISOString(),
      today = now.slice(0, 10) + "T00:00:00.000Z";
    const usage = await env.DB.prepare(
      "SELECT count(*) AS n FROM legacy_remote_recording_usage WHERE owner_user_id=? AND created_at>=?",
    )
      .bind(access.session.owner_user_id, today)
      .first<{ n: number }>();
    if ((usage?.n ?? 0) >= phase1Config.legacy.remoteRecordingDailyLimit)
      legacyFail(429, "legacy_recording_daily_limit");
    const peers = (
      await env.DB.prepare(
        "SELECT participant_id,provider_participant_id FROM legacy_remote_participants WHERE session_id=?",
      )
        .bind(sessionId)
        .all<{ participant_id: string; provider_participant_id: string }>()
    ).results;
    if (
      peers.length !== 2 ||
      !access.rows.every((p) =>
        peers.some((peer) => peer.participant_id === p.id),
      )
    )
      legacyFail(409, "legacy_call_unavailable");
    const snapshot = access.rows.map((p) => ({
      id: p.id,
      displayName: p.display_name,
      role: p.role,
      consentVersion: legacyConsentVersion,
      providerId: peers.find((peer) => peer.participant_id === p.id)!
        .provider_participant_id,
    }));
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO legacy_remote_recordings(id,session_id,created_by_participant_id,source_photo_asset_id,consent_epoch,consent_snapshot_json,provider_meeting_id,phase,max_duration_seconds,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'queued',?,?,?)",
      ).bind(
        id,
        sessionId,
        access.actor.id,
        access.session.photo_asset_id,
        access.session.consent_epoch,
        JSON.stringify(snapshot),
        call.meeting_id,
        phase1Config.legacy.maxRecordingSeconds,
        now,
        now,
      ),
      env.DB.prepare(
        "INSERT INTO legacy_remote_recording_usage(recording_id,owner_user_id,daily_limit,created_at) VALUES(?,?,?,?)",
      ).bind(
        id,
        access.session.owner_user_id,
        phase1Config.legacy.remoteRecordingDailyLimit,
        now,
      ),
    ]);
    await armRemoteRecorder(env, sessionId);
    return legacyJson({ recordingId: id }, 202);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("remote recording daily limit")
    )
      return legacyJson(
        { error: { code: "legacy_recording_daily_limit" } },
        429,
      );
    const e =
      error instanceof LegacyError
        ? error
        : new LegacyError(503, "legacy_remote_recording_unavailable");
    return legacyJson({ error: { code: e.code } }, e.status);
  }
}
