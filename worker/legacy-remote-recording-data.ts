import { legacyConsentVersion } from "../app/domain/our-living-legacy";
import type { RemoteRecordingPhase } from "../app/domain/legacy-remote-recording";
import type { LegacyEnv } from "./legacy-sessions";
export type RemoteRecordingEnv = LegacyEnv & {
  LEGACY_RECORDERS?: DurableObjectNamespace;
  LEGACY_REMOTE_RECORDING_ENABLED?: string;
};
export type RemoteRecordingRow = {
  id: string;
  session_id: string;
  created_by_participant_id: string;
  source_photo_asset_id: string;
  consent_epoch: number;
  consent_snapshot_json: string;
  provider_meeting_id: string;
  provider_track_id: string | null;
  provider_composite_id: string | null;
  phase: RemoteRecordingPhase;
  capture_stopped: number;
  stop_requested_at: string | null;
  max_duration_seconds: number;
  created_at: string;
  updated_at: string;
  preserved_at: string | null;
  failure_code: string | null;
  failure_count: number;
  lease_token: string | null;
  lease_expires_at: string | null;
};
export type RemoteSourceRow = {
  id: string;
  recording_id: string;
  participant_id: string | null;
  kind: "composite_video" | "participant_audio";
  provider_recording_id: string;
  provider_filename: string;
  content_type: "video/mp4" | "video/webm" | "audio/webm";
  durability_status: "pending" | "durable" | "quarantined";
  r2_key: string | null;
  sha256: string | null;
  byte_size: number | null;
  r2_etag: string | null;
  durable_at: string | null;
};
export async function sourceKeyId(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export async function groupById(env: { DB: D1Database }, id: string) {
  return env.DB.prepare("SELECT * FROM legacy_remote_recordings WHERE id=?")
    .bind(id)
    .first<RemoteRecordingRow>();
}
export async function recordingConsentCurrent(
  env: { DB: D1Database },
  group: RemoteRecordingRow,
) {
  const session = await env.DB.prepare(
    "SELECT status,consent_epoch,deletion_requested_at FROM legacy_sessions WHERE id=?",
  )
    .bind(group.session_id)
    .first<{
      status: string;
      consent_epoch: number;
      deletion_requested_at: string | null;
    }>();
  if (
    !session ||
    session.status === "closed" ||
    session.deletion_requested_at ||
    session.consent_epoch !== group.consent_epoch
  )
    return false;
  const accepted = await env.DB.prepare(
    "SELECT count(*) AS n FROM legacy_participants WHERE session_id=? AND revoked_at IS NULL AND joined_at IS NOT NULL AND consent='accepted' AND consent_version=? AND (role='host' OR access_expires_at>?)",
  )
    .bind(group.session_id, legacyConsentVersion, new Date().toISOString())
    .first<{ n: number }>();
  return accepted?.n === 2;
}
export async function armRemoteRecorder(
  env: RemoteRecordingEnv,
  sessionId: string,
) {
  if (!env.LEGACY_RECORDERS) throw new Error("remote_recording_unavailable");
  const recorder = env.LEGACY_RECORDERS.get(
    env.LEGACY_RECORDERS.idFromName(sessionId),
  );
  const response = await recorder.fetch(
    "https://legacy-recorder.internal/arm",
    { method: "POST", body: JSON.stringify({ sessionId }) },
  );
  if (!response.ok) throw new Error("remote_recording_unavailable");
}
export async function requestRemoteRecordingStop(
  env: RemoteRecordingEnv,
  sessionId: string,
) {
  const pending = await env.DB.prepare(
    "SELECT id FROM legacy_remote_recordings WHERE session_id=? AND capture_stopped=0 LIMIT 1",
  )
    .bind(sessionId)
    .first();
  if (!pending) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE legacy_remote_recordings SET stop_requested_at=COALESCE(stop_requested_at,?),updated_at=? WHERE session_id=? AND capture_stopped=0",
  )
    .bind(now, now, sessionId)
    .run();
  await armRemoteRecorder(env, sessionId);
}
