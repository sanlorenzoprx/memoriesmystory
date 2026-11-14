import { phase1Config } from "../config/phase-1";
import {
  groupById,
  recordingConsentCurrent,
  sourceKeyId,
  type RemoteRecordingEnv,
  type RemoteRecordingRow,
  type RemoteSourceRow,
} from "./legacy-remote-recording-data";
import {
  readProviderRecording,
  startProviderRecording,
  stopProviderRecording,
  providerSources,
  recordingDownloadUrl,
  recordingFilePrefix,
  recordingSegment,
  type ProviderRecording,
  type RecordingParticipant,
} from "./realtimekit-recording-provider";
import { realtimeKitRequest, RealtimeKitError } from "./realtimekit";
import { storeOriginalSource } from "./original-source-storage";

/** One alarm-backed recording worker per session. No browser connection is needed for preservation. */
export class LegacyRecorder {
  private running = false;
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: RemoteRecordingEnv,
  ) {}
  async fetch(request: Request) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/arm")
      return new Response(null, { status: 405 });
    const body = (await request.json()) as { sessionId?: unknown };
    if (
      typeof body.sessionId !== "string" ||
      !/^[A-Za-z0-9_-]{8,120}$/.test(body.sessionId)
    )
      return new Response(null, { status: 400 });
    return this.state.blockConcurrencyWhile(async () => {
      const previous = await this.state.storage.get<string>("sessionId");
      if (previous && previous !== body.sessionId)
        return new Response(null, { status: 409 });
      await this.state.storage.put({
        sessionId: body.sessionId,
        armNonce: crypto.randomUUID(),
      });
      await this.state.storage.setAlarm(Date.now() + 1000);
      return new Response(null, { status: 202 });
    });
  }
  async alarm() {
    if (this.running) {
      await this.state.storage.setAlarm(Date.now() + 1000);
      return;
    }
    this.running = true;
    let group: RemoteRecordingRow | null = null,
      lease = "";
    try {
      const sessionId = await this.state.storage.get<string>("sessionId");
      if (!sessionId) return;
      const armNonce = await this.state.storage.get<string>("armNonce");
      // Preserve an independent retry even when D1 or the provider is unavailable.
      await this.state.storage.setAlarm(Date.now() + 60000);
      const watchdog = await this.state.storage.get<{
        meetingId: string;
        deadline: number;
      }>("captureWatchdog");
      if (watchdog && Date.now() >= watchdog.deadline) {
        await this.forceCloseWithoutDatabase(watchdog.meetingId);
        await this.state.storage.put("forcedClosed", watchdog.meetingId);
        await this.state.storage.delete("captureWatchdog");
      }
      group = await this.env.DB.prepare(
        "SELECT * FROM legacy_remote_recordings WHERE session_id=? AND (phase NOT IN ('preserved','partial_preserved','needs_review','failed','discarded') OR capture_stopped=0) ORDER BY created_at,id LIMIT 1",
      )
        .bind(sessionId)
        .first<RemoteRecordingRow>();
      if (!group) {
        await this.state.blockConcurrencyWhile(async () => {
          if ((await this.state.storage.get("armNonce")) === armNonce)
            await this.state.storage.deleteAlarm();
        });
        return;
      }
      const now = new Date().toISOString();
      lease = crypto.randomUUID();
      const locked = await this.env.DB.prepare(
        "UPDATE legacy_remote_recordings SET lease_token=?,lease_expires_at=? WHERE id=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) RETURNING *",
      )
        .bind(lease, new Date(Date.now() + 120000).toISOString(), group.id, now)
        .first<RemoteRecordingRow>();
      if (!locked) {
        await this.state.storage.setAlarm(Date.now() + 5000);
        return;
      }
      group = locked;
      if (!group.capture_stopped)
        await this.state.storage.put("captureWatchdog", {
          meetingId: group.provider_meeting_id,
          deadline:
            Date.parse(group.created_at) +
            group.max_duration_seconds * 1000 +
            60000,
        });
      await this.step(group, lease);
    } catch (error) {
      const permanent =
        error instanceof Error &&
        [
          "recording_track_manifest_invalid",
          "recording_attribution_unconfirmed",
          "recording_participant_missing",
          "recording_output_missing",
          "recording_source_invalid",
          "recording_source_changed",
          "recording_meeting_mismatch",
          "recording_download_origin_invalid",
          "recording_source_too_large",
          "source_signature_invalid",
          "source_too_large",
        ].includes(error.message);
      if (
        group &&
        lease &&
        group.capture_stopped &&
        (permanent ||
          group.failure_count >=
            phase1Config.legacy.remotePreservationRetryLimit - 1)
      )
        await this.update(group, lease, {
          phase: "needs_review",
          failure_code: "recording_source_review_required",
        }).catch(() => {});
      else if (group && lease)
        await this.env.DB.prepare(
          "UPDATE legacy_remote_recordings SET failure_code='recording_processing_interrupted',failure_count=failure_count+1,updated_at=? WHERE id=? AND lease_token=?",
        )
          .bind(new Date().toISOString(), group.id, lease)
          .run()
          .catch(() => {});
    } finally {
      try {
        if (group && lease) {
          await this.env.DB.prepare(
            "UPDATE legacy_remote_recordings SET lease_token=NULL,lease_expires_at=NULL WHERE id=? AND lease_token=?",
          )
            .bind(group.id, lease)
            .run()
            .catch(() => {});
          const current = await groupById(this.env, group.id);
          if (current?.capture_stopped)
            await this.state.storage.delete("captureWatchdog");
          if (
            current &&
            (![
              "preserved",
              "partial_preserved",
              "needs_review",
              "failed",
              "discarded",
            ].includes(current.phase) ||
              !current.capture_stopped)
          ) {
            const delay = current.failure_count
              ? Math.min(60000, 5000 * 2 ** Math.min(current.failure_count, 4))
              : current.phase === "recording"
                ? 5000
                : 1000;
            await this.state.storage.setAlarm(Date.now() + delay);
          }
        }
      } finally {
        this.running = false;
      }
    }
  }
  private async update(
    group: RemoteRecordingRow,
    lease: string,
    fields: Record<string, string | number | null>,
  ) {
    const columns = Object.keys(fields); // Internal literals only; never request keys.
    const result = await this.env.DB.prepare(
      `UPDATE legacy_remote_recordings SET ${columns.map((key) => `${key}=?`).join(",")},updated_at=? WHERE id=? AND lease_token=?`,
    )
      .bind(...Object.values(fields), new Date().toISOString(), group.id, lease)
      .run();
    if (result.meta.changes === 0) throw new Error("recording_lease_lost");
  }
  private async assertLeaseAndConsent(
    group: RemoteRecordingRow,
    lease: string,
  ) {
    const current = await groupById(this.env, group.id);
    if (
      !current ||
      current.lease_token !== lease ||
      !(await recordingConsentCurrent(this.env, current))
    )
      throw new Error("recording_consent_changed");
    await this.env.DB.prepare(
      "UPDATE legacy_remote_recordings SET lease_expires_at=? WHERE id=? AND lease_token=?",
    )
      .bind(new Date(Date.now() + 120000).toISOString(), group.id, lease)
      .run();
  }
  private async records(group: RemoteRecordingRow) {
    const result: ProviderRecording[] = [];
    for (const id of [group.provider_track_id, group.provider_composite_id])
      if (id) {
        const record = await readProviderRecording(this.env, id);
        if (
          record.meeting_id &&
          record.meeting_id !== group.provider_meeting_id
        )
          throw new Error("recording_meeting_mismatch");
        result.push(record);
      }
    return result;
  }
  private async step(group: RemoteRecordingRow, lease: string) {
    const consent = await recordingConsentCurrent(this.env, group);
    const session = await this.env.DB.prepare(
      "SELECT deletion_requested_at,status FROM legacy_sessions WHERE id=?",
    )
      .bind(group.session_id)
      .first<{ deletion_requested_at: string | null; status: string }>();
    const deletion = Boolean(
      !session || session.deletion_requested_at || session.status === "closed",
    );
    const forcedClosed =
      (await this.state.storage.get("forcedClosed")) ===
      group.provider_meeting_id;
    if (forcedClosed)
      await this.env.DB.prepare(
        "UPDATE legacy_remote_calls SET state='failed',updated_at=? WHERE session_id=?",
      )
        .bind(new Date().toISOString(), group.session_id)
        .run();
    const expired =
      Date.now() >=
        Date.parse(group.created_at) + group.max_duration_seconds * 1000 ||
      forcedClosed;
    if ((!consent || deletion || expired) && !group.stop_requested_at) {
      await this.update(group, lease, {
        stop_requested_at: new Date().toISOString(),
      });
      group.stop_requested_at = new Date().toISOString();
    }
    if (["allocating_track", "allocating_composite"].includes(group.phase)) {
      // This phase on alarm entry means the last allocation outcome was uncertain.
      const rows = await realtimeKitRequest<ProviderRecording[]>(
        this.env,
        `/recordings?meeting_id=${recordingSegment(group.provider_meeting_id)}&per_page=100`,
      );
      if (!Array.isArray(rows) || rows.length >= 100)
        throw new Error("recording_allocation_unconfirmed");
      const known = new Set(
        [group.provider_track_id, group.provider_composite_id].filter(Boolean),
      );
      const candidates = rows.filter(
        (record) =>
          !known.has(record.id) &&
          typeof record.output_file_name === "string" &&
          record.output_file_name.startsWith(recordingFilePrefix(group.id)),
      );
      if (candidates.length === 1) {
        await this.update(
          group,
          lease,
          group.phase === "allocating_track"
            ? {
                provider_track_id: candidates[0]!.id,
                phase: "queued_composite",
              }
            : { provider_composite_id: candidates[0]!.id, phase: "preparing" },
        );
        return;
      }
      // Never repeat an uncertain start. Stop every recorder scoped to this private meeting.
      let stopped = true;
      for (const record of rows)
        if (!(await stopProviderRecording(this.env, record.id)))
          stopped = false;
      await this.closeAdmission(group);
      await this.update(group, lease, {
        phase: "needs_review",
        capture_stopped: stopped ? 1 : 0,
        failure_code: "recording_allocation_unconfirmed",
      });
      return;
    }
    if (
      group.stop_requested_at &&
      [
        "queued",
        "queued_composite",
        "preparing",
        "recording",
        "failed",
        "needs_review",
      ].includes(group.phase) &&
      !group.capture_stopped
    ) {
      await this.update(group, lease, { phase: "stopping" });
      group.phase = "stopping";
    }
    if (group.phase === "queued" || group.phase === "queued_composite") {
      if (!consent) throw new Error("recording_consent_changed");
      const track = group.phase === "queued";
      await this.update(group, lease, {
        phase: track ? "allocating_track" : "allocating_composite",
      });
      try {
        const id = await startProviderRecording(this.env, {
          meetingId: group.provider_meeting_id,
          recordingId: group.id,
          kind: track ? "track" : "composite",
          maxSeconds: group.max_duration_seconds,
        });
        await this.update(
          group,
          lease,
          track
            ? { provider_track_id: id, phase: "queued_composite" }
            : { provider_composite_id: id, phase: "preparing" },
        );
      } catch (error) {
        if (
          error instanceof RealtimeKitError &&
          [400, 401, 403, 404, 422].includes(error.status)
        ) {
          await this.update(group, lease, {
            phase: track ? "failed" : "stopping",
            capture_stopped: track ? 1 : 0,
            stop_requested_at: new Date().toISOString(),
            failure_code: "recording_provider_rejected",
          });
        } else throw error;
      }
      return;
    }
    if (group.phase === "preparing" || group.phase === "recording") {
      const records = await this.records(group);
      if (
        records.length === 2 &&
        records.every((record) => record.status === "RECORDING")
      ) {
        if (group.phase !== "recording")
          await this.update(group, lease, { phase: "recording" });
        return;
      }
      if (
        records.some((record) =>
          ["UPLOADING", "UPLOADED", "ERRORED"].includes(record.status),
        )
      )
        await this.update(group, lease, {
          phase: "stopping",
          stop_requested_at: new Date().toISOString(),
        });
      return;
    }
    if (group.phase === "stopping") {
      let stopped = true;
      for (const id of [group.provider_track_id, group.provider_composite_id])
        if (id && !(await stopProviderRecording(this.env, id))) stopped = false;
      if (!stopped) return;
      await this.state.storage.delete("captureWatchdog");
      await this.update(group, lease, {
        capture_stopped: 1,
        phase: deletion
          ? "discarded"
          : !consent
            ? "needs_review"
            : "processing",
        failure_code: deletion || consent ? null : "recording_consent_changed",
      });
      return;
    }
    if (group.phase !== "processing") return;
    if (!consent) {
      await this.update(group, lease, {
        phase: deletion ? "discarded" : "needs_review",
        failure_code: "recording_consent_changed",
      });
      return;
    }
    const records = await this.records(group);
    if (
      records.some((record) =>
        ["INVOKED", "RECORDING", "PAUSED", "UPLOADING"].includes(record.status),
      )
    )
      return;
    const snapshot = JSON.parse(
      group.consent_snapshot_json,
    ) as RecordingParticipant[];
    const composite =
        records.find((record) => record.id === group.provider_composite_id) ??
        null,
      track =
        records.find((record) => record.id === group.provider_track_id) ?? null;
    const manifest = providerSources(composite, track, snapshot, true);
    if (!manifest.length) {
      await this.update(group, lease, {
        phase: "failed",
        failure_code: "recording_outputs_missing",
      });
      return;
    }
    for (const source of manifest) {
      if (source.filename.length > 1024)
        throw new Error("recording_source_invalid");
      const id = `remote_source_${(await sourceKeyId(`${group.id}:${source.providerRecordingId}:${source.filename}`)).slice(0, 40)}`;
      await this.env.DB.prepare(
        "INSERT INTO legacy_remote_sources(id,recording_id,participant_id,kind,provider_recording_id,provider_filename,content_type,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      )
        .bind(
          id,
          group.id,
          source.participantId,
          source.kind,
          source.providerRecordingId,
          source.filename,
          source.contentType,
          new Date().toISOString(),
        )
        .run();
    }
    const pending = await this.env.DB.prepare(
      "SELECT * FROM legacy_remote_sources WHERE recording_id=? AND durability_status='pending' ORDER BY kind,id LIMIT 1",
    )
      .bind(group.id)
      .first<RemoteSourceRow>();
    if (pending) {
      const source = manifest.find(
        (item) =>
          item.providerRecordingId === pending.provider_recording_id &&
          item.filename === pending.provider_filename,
      );
      if (!source || source.participantId !== pending.participant_id)
        throw new Error("recording_source_changed");
      await this.assertLeaseAndConsent(group, lease);
      const response = await fetch(recordingDownloadUrl(source.downloadUrl), {
        redirect: "manual",
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok || !response.body)
        throw new Error("recording_download_failed");
      if (
        Number(response.headers.get("Content-Length")) >
        phase1Config.legacy.remoteSourceMaximumBytes
      ) {
        await response.body.cancel();
        throw new Error("recording_source_too_large");
      }
      const stored = await storeOriginalSource(
        this.env.MEDIA_BUCKET,
        response.body,
        {
          sessionId: group.session_id,
          sourceId: pending.id,
          contentType: pending.content_type,
          maximumBytes: phase1Config.legacy.remoteSourceMaximumBytes,
          assertAuthorized: () => this.assertLeaseAndConsent(group, lease),
        },
      );
      await this.env.DB.prepare(
        "UPDATE legacy_remote_sources SET r2_key=?,sha256=?,byte_size=?,r2_etag=?,durable_at=?,durability_status='durable' WHERE id=? AND durability_status='pending'",
      )
        .bind(
          stored.r2Key,
          stored.sha256,
          stored.byteSize,
          stored.etag,
          new Date().toISOString(),
          pending.id,
        )
        .run();
      return;
    }
    await this.assertLeaseAndConsent(group, lease);
    const complete = Boolean(
      composite?.status === "UPLOADED" &&
        snapshot.every((person) =>
          manifest.some((source) => source.participantId === person.id),
        ),
    );
    await this.update(group, lease, {
      phase: complete ? "preserved" : "partial_preserved",
      preserved_at: new Date().toISOString(),
      failure_code: complete ? null : "recording_partial_sources",
    });
  }
  private async forceCloseWithoutDatabase(meetingId: string) {
    // Every cleanup branch runs even if another provider endpoint is unavailable.
    let confirmed = true;
    try {
      await realtimeKitRequest(
        this.env,
        `/meetings/${recordingSegment(meetingId)}`,
        "PATCH",
        { status: "INACTIVE" },
      );
    } catch {
      confirmed = false;
    }
    try {
      const records = await realtimeKitRequest<ProviderRecording[]>(
        this.env,
        `/recordings?meeting_id=${recordingSegment(meetingId)}&per_page=100`,
      );
      if (!Array.isArray(records) || records.length >= 100)
        throw new Error("recording_cleanup_unconfirmed");
      for (const record of records) {
        try {
          await stopProviderRecording(this.env, record.id);
        } catch {
          confirmed = false;
        }
      }
    } catch {
      confirmed = false;
    }
    try {
      const peers = await realtimeKitRequest<{ id: string }[]>(
        this.env,
        `/meetings/${recordingSegment(meetingId)}/participants?per_page=100`,
      );
      if (!Array.isArray(peers) || peers.length >= 100)
        throw new Error("recording_cleanup_unconfirmed");
      for (const peer of peers) {
        try {
          await realtimeKitRequest(
            this.env,
            `/meetings/${recordingSegment(meetingId)}/participants/${recordingSegment(peer.id)}`,
            "DELETE",
          );
        } catch (error) {
          if (!(error instanceof RealtimeKitError) || error.status !== 404)
            confirmed = false;
        }
      }
    } catch {
      confirmed = false;
    }
    if (!confirmed) throw new Error("recording_cleanup_unconfirmed");
  }
  private async closeAdmission(group: RemoteRecordingRow) {
    await this.env.DB.prepare(
      "UPDATE legacy_remote_calls SET state='failed',updated_at=? WHERE session_id=?",
    )
      .bind(new Date().toISOString(), group.session_id)
      .run();
    await realtimeKitRequest(
      this.env,
      `/meetings/${recordingSegment(group.provider_meeting_id)}`,
      "PATCH",
      { status: "INACTIVE" },
    );
    const peers = (
      await this.env.DB.prepare(
        "SELECT provider_participant_id FROM legacy_remote_participants WHERE session_id=?",
      )
        .bind(group.session_id)
        .all<{ provider_participant_id: string }>()
    ).results;
    for (const peer of peers) {
      try {
        await realtimeKitRequest(
          this.env,
          `/meetings/${recordingSegment(group.provider_meeting_id)}/participants/${recordingSegment(peer.provider_participant_id)}`,
          "DELETE",
        );
      } catch (error) {
        if (!(error instanceof RealtimeKitError) || error.status !== 404)
          throw error;
      }
    }
  }
}
