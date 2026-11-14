import { phase1Config } from "../config/phase-1";
import {
  legacyAccess,
  legacyFail,
  legacyJson,
  legacyMutation,
  LegacyError,
  type LegacyEnv,
} from "./legacy-sessions";
import {
  assertUnrecordedCallPreset,
  RealtimeKitError,
  realtimeKitRequest,
  realtimeKitConfigured,
  type RealtimeKitEnv,
} from "./realtimekit";
type RemoteEnv = LegacyEnv & RealtimeKitEnv;
type CallRow = {
  state: "provisioning" | "ready" | "failed" | "closed";
  meeting_id: string | null;
};
const segment = (value: string) => encodeURIComponent(value);

/** Close admission before kicking existing peers. Keep mapping for retry if upstream fails. */
export async function closeLegacyRemoteCall(
  env: { DB: D1Database } & RealtimeKitEnv,
  id: string,
) {
  const row = await env.DB.prepare(
    "SELECT state,meeting_id FROM legacy_remote_calls WHERE session_id=?",
  )
    .bind(id)
    .first<CallRow>();
  if (!row || row.state === "closed") return;
  // An in-flight/ambiguous allocation must be reconciled before claiming removal succeeded.
  if (!row.meeting_id) throw new Error("remote_reconciliation_required");
  await env.DB.prepare(
    "UPDATE legacy_remote_calls SET state='failed',updated_at=? WHERE session_id=?",
  )
    .bind(new Date().toISOString(), id)
    .run();
  await realtimeKitRequest(
    env,
    `/meetings/${segment(row.meeting_id)}`,
    "PATCH",
    { status: "INACTIVE" },
  );
  const peers = await env.DB.prepare(
    "SELECT provider_participant_id FROM legacy_remote_participants WHERE session_id=?",
  )
    .bind(id)
    .all<{ provider_participant_id: string }>();
  for (const peer of peers.results) {
    try {
      await realtimeKitRequest(
        env,
        `/meetings/${segment(row.meeting_id)}/participants/${segment(peer.provider_participant_id)}`,
        "DELETE",
      );
    } catch (error) {
      // Deleting a participant revokes all its tokens and removes an active peer.
      // A repeated deletion may find the participant already absent.
      if (!(error instanceof RealtimeKitError) || error.status !== 404)
        throw error;
    }
  }
  await env.DB.prepare(
    "UPDATE legacy_remote_calls SET state='closed',updated_at=? WHERE session_id=?",
  )
    .bind(new Date().toISOString(), id)
    .run();
}

export async function handleLegacyRemoteRoute(
  request: Request,
  env: RemoteEnv,
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(
    /^\/resources\/legacy-sessions\/([^/]+)\/call$/,
  );
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]!);
    const access = await legacyAccess(request, env, id);
    if (access.session.mode !== "remote" || access.session.status === "closed")
      legacyFail(409, "legacy_call_unavailable");
    if (request.method === "GET")
      return legacyJson({ available: realtimeKitConfigured(env) });
    legacyMutation(request);
    if (request.method !== "POST") legacyFail(405, "method");
    if (!realtimeKitConfigured(env)) legacyFail(503, "legacy_call_unavailable");
    await assertUnrecordedCallPreset(env);
    let call = await env.DB.prepare(
      "SELECT state,meeting_id FROM legacy_remote_calls WHERE session_id=?",
    )
      .bind(id)
      .first<CallRow>();
    if (!call) {
      if (access.actor.role !== "host") legacyFail(409, "legacy_call_waiting");
      const now = new Date().toISOString();
      const claim = await env.DB.prepare(
        "INSERT OR IGNORE INTO legacy_remote_calls(session_id,state,created_at,updated_at) VALUES(?,'provisioning',?,?) RETURNING session_id",
      )
        .bind(id, now, now)
        .first();
      if (!claim) legacyFail(409, "legacy_call_waiting");
      try {
        const meeting = await realtimeKitRequest<{ id: string }>(
          env,
          "/meetings",
          "POST",
          {
            title: `Our Living Legacy ${id}`,
            record_on_start: false,
            live_stream_on_start: false,
            transcribe_on_end: false,
            summarize_on_end: false,
            persist_chat: false,
          },
        );
        if (!meeting.id) throw new Error("remote_invalid");
        await env.DB.prepare(
          "UPDATE legacy_remote_calls SET meeting_id=?,updated_at=? WHERE session_id=?",
        )
          .bind(meeting.id, now, id)
          .run();
        for (const participant of access.rows.filter((p) => !p.revoked_at)) {
          const peer = await realtimeKitRequest<{ id: string }>(
            env,
            `/meetings/${segment(meeting.id)}/participants`,
            "POST",
            {
              name: participant.role === "host" ? "Host" : "Guest",
              custom_participant_id: participant.id,
              preset_name: env.REALTIMEKIT_CALL_PRESET,
              token: {
                expires_on: new Date(
                  Date.now() +
                    phase1Config.legacy.remoteTokenLifetimeSeconds * 1000,
                ).toISOString(),
              },
            },
          );
          if (!peer.id) throw new Error("remote_invalid");
          await env.DB.prepare(
            "INSERT INTO legacy_remote_participants(participant_id,session_id,provider_participant_id) VALUES(?,?,?)",
          )
            .bind(participant.id, id, peer.id)
            .run();
        }
        await env.DB.prepare(
          "UPDATE legacy_remote_calls SET state='ready',updated_at=? WHERE session_id=? AND state='provisioning'",
        )
          .bind(new Date().toISOString(), id)
          .run();
      } catch {
        await env.DB.prepare(
          "UPDATE legacy_remote_calls SET state='failed',updated_at=? WHERE session_id=?",
        )
          .bind(new Date().toISOString(), id)
          .run();
        legacyFail(503, "legacy_call_unavailable");
      }
      call = await env.DB.prepare(
        "SELECT state,meeting_id FROM legacy_remote_calls WHERE session_id=?",
      )
        .bind(id)
        .first<CallRow>();
    }
    if (call?.state === "provisioning") legacyFail(409, "legacy_call_waiting");
    if (call?.state !== "ready" || !call.meeting_id)
      legacyFail(503, "legacy_call_unavailable");
    const peer = await env.DB.prepare(
      "SELECT provider_participant_id FROM legacy_remote_participants WHERE participant_id=? AND session_id=?",
    )
      .bind(access.actor.id, id)
      .first<{ provider_participant_id: string }>();
    if (!peer) legacyFail(503, "legacy_call_unavailable");
    const grant = await realtimeKitRequest<{ token: string }>(
      env,
      `/meetings/${segment(call.meeting_id)}/participants/${segment(peer.provider_participant_id)}/token`,
      "POST",
      {
        expires_on: new Date(
          Math.min(
            Date.now() + phase1Config.legacy.remoteTokenLifetimeSeconds * 1000,
            access.actor.role === "guest"
              ? Date.parse(access.actor.access_expires_at!)
              : Infinity,
          ),
        ).toISOString(),
      },
    );
    if (!grant.token) legacyFail(503, "legacy_call_unavailable");
    // Recheck after the provider round trip: revoked/deleted participants get no new grant.
    await legacyAccess(request, env, id);
    const current = await env.DB.prepare(
      "SELECT state FROM legacy_remote_calls WHERE session_id=?",
    )
      .bind(id)
      .first<{ state: string }>();
    if (current?.state !== "ready") legacyFail(409, "legacy_call_unavailable");
    return legacyJson({ authToken: grant.token });
  } catch (error) {
    const e =
      error instanceof LegacyError
        ? error
        : new LegacyError(503, "legacy_call_unavailable");
    return legacyJson({ error: { code: e.code } }, e.status);
  }
}
