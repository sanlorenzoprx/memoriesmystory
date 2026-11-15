import { handleDeletionRoute } from "../../worker/deletion";
/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { handleRemoteRecordingRoute } from "../../worker/legacy-remote-recording-route";
import { handleLegacyRemoteRoute } from "../../worker/legacy-remote";
import { handleArchiveExportRoute } from "../../worker/archive-export";
import type { ArchiveExportManifest } from "../../app/domain/archive-export";
import { legacyConsentVersion } from "../../app/domain/our-living-legacy";
const cleanups: (() => void)[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const close of cleanups.splice(0)) close();
});
async function setup() {
  const s = await setupLegacyFixture("remote");
  cleanups.push(() => s.db.close());
  const arm = vi.fn(async () => new Response(null, { status: 202 }));
  const env = {
    ...s.env,
    REALTIMEKIT_ACCOUNT_ID: "account_test",
    REALTIMEKIT_APP_ID: "app_test",
    REALTIMEKIT_API_TOKEN: "PRIVATE_CANARY",
    REALTIMEKIT_CALL_PRESET: "family-call",
    REALTIMEKIT_CALL_PRESET_ID: "preset-test",
    LEGACY_REMOTE_RECORDING_ENABLED: "true",
    LEGACY_RECORDERS: {
      idFromName: () => "test",
      get: () => ({ fetch: arm }),
    } as unknown as DurableObjectNamespace,
  };
  const created = await s.create(),
    id = created.sessionId;
  const join = await s.join(id, created.joinPath),
    guest = join.headers.get("Set-Cookie")!.split(";")[0]!;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = new URL(input).pathname;
      if (path.endsWith("/presets/preset-test"))
        return Response.json({
          success: true,
          data: {
            name: "family-call",
            permissions: {
              can_record: false,
              can_livestream: false,
              can_change_participant_permissions: false,
              transcription_enabled: false,
              kick_participant: false,
              recorder_type: "NONE",
            },
          },
        });
      if (path.endsWith("/meetings"))
        return Response.json({
          success: true,
          data: { id: "meeting-provider-test" },
        });
      if (path.endsWith("/participants")) {
        const body = JSON.parse(init!.body as string);
        return Response.json({
          success: true,
          data: {
            id: `provider_${body.custom_participant_id}`,
            token: "UNUSED_CANARY",
          },
        });
      }
      if (path.endsWith("/token"))
        return Response.json({
          success: true,
          data: { token: "PARTICIPANT_CANARY" },
        });
      return Response.json({ success: true, data: {} });
    }),
  );
  expect(
    (await handleLegacyRemoteRoute(
      new Request(`https://example.test/resources/legacy-sessions/${id}/call`, {
        method: "POST",
        headers: { Cookie: s.owner, "X-Memories-Request": "legacy-v1" },
      }),
      env,
    ))!.status,
  ).toBe(200);
  async function agree() {
    for (const actor of [s.owner, guest])
      expect(
        (
          await s.call(
            `/${id}/consent`,
            "POST",
            { agree: true, version: legacyConsentVersion },
            actor,
          )
        ).status,
      ).toBe(200);
  }
  async function call(
    path = "",
    method = "POST",
    cookie = s.owner,
    key = "remote_recording_test_001",
    csrf = true,
    body?: unknown,
  ) {
    return (await handleRemoteRecordingRoute(
      new Request(
        `https://example.test/resources/legacy-sessions/${id}/remote-recordings${path}`,
        {
          method,
          headers: {
            Cookie: cookie,
            "X-Idempotency-Key": key,
            ...(csrf ? { "X-Memories-Request": "legacy-v1" } : {}),
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      ),
      env,
    ))!;
  }
  return { ...s, id, guest, env, arm, agree, remote: call };
}
describe("consent-controlled remote recording archive routes", () => {
  it("requires own consent, host authority and CSRF before scheduling capture", async () => {
    const s = await setup();
    expect((await s.remote()).status).toBe(409);
    await s.agree();
    expect((await s.remote("", "POST", s.guest)).status).toBe(403);
    expect((await s.remote("", "POST", s.owner, undefined, false)).status).toBe(
      403,
    );
    expect(s.arm).not.toHaveBeenCalled();
    expect((await s.remote()).status).toBe(202);
    expect(s.arm).toHaveBeenCalledOnce();
  });
  it("replays the same request without duplicate capture or budget charges and rejects another active recording", async () => {
    const s = await setup();
    await s.agree();
    const first = (await (await s.remote()).json()) as { recordingId: string };
    expect(await (await s.remote()).json()).toMatchObject({
      ...first,
      replayed: true,
    });
    expect(
      (await s.remote("", "POST", s.owner, "remote_recording_test_002")).status,
    ).toBe(409);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM legacy_remote_recordings")
        .get()!.n,
    ).toBe(1);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM legacy_remote_recording_usage")
        .get()!.n,
    ).toBe(1);
  });
  it("allows the guest to stop and persists that intent even when the coordinator is unavailable", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.remote()).json()) as {
      recordingId: string;
    };
    s.arm.mockRejectedValueOnce(new Error("synthetic coordinator unavailable"));
    expect(
      (await s.remote(`/${recordingId}/stop`, "POST", s.guest)).status,
    ).toBe(503);
    expect(
      s.db.database
        .prepare(
          "SELECT stop_requested_at FROM legacy_remote_recordings WHERE id=?",
        )
        .get(recordingId)!.stop_requested_at,
    ).toBeTruthy();
    expect(
      (await s.remote(`/${recordingId}/stop`, "POST", s.guest)).status,
    ).toBe(202);
  });
  it("does not report queued recordings as saved or expose provider capabilities", async () => {
    const s = await setup();
    await s.agree();
    await s.remote();
    const response = await s.remote("", "GET", s.guest),
      text = await response.text();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(JSON.parse(text).recordings[0]).toMatchObject({
      phase: "queued",
      captureStopped: false,
      sources: [],
    });
    expect(text).not.toMatch(
      /CANARY|provider_|meeting-provider|consent_snapshot|r2_key/,
    );
    expect((await s.remote("", "GET", "")).status).toBe(403);
  });
  it("prevents false archive completion and immutable consent snapshot changes at the database boundary", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.remote()).json()) as {
      recordingId: string;
    };
    expect(() =>
      s.db.database
        .prepare(
          "UPDATE legacy_remote_recordings SET phase='preserved',capture_stopped=1,preserved_at=? WHERE id=?",
        )
        .run(new Date().toISOString(), recordingId),
    ).toThrow(/durably confirmed/);
    expect(() =>
      s.db.database
        .prepare(
          "UPDATE legacy_remote_recordings SET consent_epoch=consent_epoch+1 WHERE id=?",
        )
        .run(recordingId),
    ).toThrow(/immutable/);
    expect(() =>
      s.db.database
        .prepare(
          "UPDATE legacy_remote_recordings SET phase='partial_preserved',capture_stopped=1,preserved_at=? WHERE id=?",
        )
        .run(new Date().toISOString(), recordingId),
    ).toThrow(/durably confirmed/);
  });
  it("keeps verified sources private and limits voice claims to the recorded participant", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.remote()).json()) as {
      recordingId: string;
    };
    const sql = s.db.database,
      now = new Date().toISOString();
    sql
      .prepare(
        "UPDATE legacy_remote_recordings SET provider_track_id='track-test-001',provider_composite_id='composite-test-001',phase='processing',capture_stopped=1 WHERE id=?",
      )
      .run(recordingId);
    const people = sql
      .prepare("SELECT id,role FROM legacy_participants WHERE session_id=?")
      .all(s.id) as { id: string; role: string }[];
    for (const person of [...people, { id: null, role: "composite" }]) {
      const sourceId = `remote_source_${person.role}`,
        kind = person.id ? "participant_audio" : "composite_video",
        provider = person.id ? "track-test-001" : "composite-test-001";
      sql
        .prepare(
          "INSERT INTO legacy_remote_sources(id,recording_id,participant_id,kind,provider_recording_id,provider_filename,content_type,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          sourceId,
          recordingId,
          person.id,
          kind,
          provider,
          `${sourceId}.webm`,
          person.id ? "audio/webm" : "video/mp4",
          now,
        );
      await s.bucket.put(
        `private/${sourceId}`,
        new Uint8Array([1, 2, 3, 4]).buffer,
      );
      sql
        .prepare(
          "UPDATE legacy_remote_sources SET durability_status='durable',r2_key=?,sha256=?,byte_size=4,r2_etag='etag',durable_at=? WHERE id=?",
        )
        .run(`private/${sourceId}`, "a".repeat(64), now, sourceId);
    }
    sql
      .prepare(
        "UPDATE legacy_participants SET access_expires_at='2000-01-01T00:00:00.000Z' WHERE session_id=? AND role='guest'",
      )
      .run(s.id);
    expect(() =>
      sql
        .prepare(
          "UPDATE legacy_remote_recordings SET phase='preserved',preserved_at=? WHERE id=?",
        )
        .run(now, recordingId),
    ).toThrow(/durably confirmed/);
    sql
      .prepare(
        "UPDATE legacy_participants SET access_expires_at='2099-01-01T00:00:00.000Z' WHERE session_id=? AND role='guest'",
      )
      .run(s.id);
    sql
      .prepare(
        "UPDATE legacy_remote_recordings SET phase='preserved',preserved_at=? WHERE id=?",
      )
      .run(now, recordingId);
    const source = `/${recordingId}/sources/remote_source_guest`;
    expect((await s.remote(source, "GET", "")).status).toBe(403);
    const playback = await s.remote(source, "GET", s.guest);
    expect(playback.status).toBe(200);
    expect(playback.headers.get("Cache-Control")).toContain("no-store");
    expect(playback.headers.get("Content-Length")).toBe("4");
    expect(new Uint8Array(await playback.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
    const note = { confirm: true, note: "This is my voice." };
    expect(
      (
        await s.remote(
          `${source}/claim`,
          "POST",
          s.owner,
          undefined,
          true,
          note,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await s.remote(
          `${source}/claim`,
          "POST",
          s.guest,
          undefined,
          true,
          note,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await s.remote(
          `${source}/claim`,
          "POST",
          s.guest,
          undefined,
          true,
          note,
        )
      ).status,
    ).toBe(200);
    expect(
      sql
        .prepare("SELECT count(*) AS n FROM legacy_remote_source_claims")
        .get()!.n,
    ).toBe(1);
    expect(() =>
      sql
        .prepare(
          "UPDATE legacy_remote_sources SET sha256=? WHERE id='remote_source_guest'",
        )
        .run("b".repeat(64)),
    ).toThrow(/immutable/);
    // F01: the owner's archive export carries these sources with consent and attribution.
    const exported = (await handleArchiveExportRoute(
      new Request("https://example.test/resources/archive-export/manifest", {
        headers: { Cookie: s.owner },
      }),
      s.env,
    ))!;
    const manifest = (await exported.json()) as ArchiveExportManifest,
      memory = manifest.memories[0]!,
      conversation = memory.sharedConversations![0]!,
      recording = conversation.recordings[0]!;
    expect(conversation).toMatchObject({ id: s.id, mode: "remote" });
    expect(conversation.participants.map((p) => p.role).sort()).toEqual(["guest", "host"]);
    expect(conversation.consentHistory.every((c) => c.decision === "accepted")).toBe(true);
    expect(recording).toMatchObject({ kind: "remote", state: "preserved" });
    expect(recording.consentAtRecording).toHaveLength(2);
    expect(recording.fileIds.sort()).toEqual(["remote_source_composite", "remote_source_guest", "remote_source_host"]);
    // Only the guest identified their own voice; nothing is inferred for the host.
    expect(recording.selfIdentifiedSpeakers).toEqual([
      expect.objectContaining({ role: "guest", fileId: "remote_source_guest", note: "This is my voice." }),
    ]);
    const roles = memory.files.filter((f) => f.kind === "session-source").map((f) => f.role).sort();
    expect(roles).toEqual(["shared_conversation_video", "shared_conversation_voice", "shared_conversation_voice"]);
    const download = (await handleArchiveExportRoute(
      new Request("https://example.test/resources/archive-export/file/session-source/remote_source_guest", { headers: { Cookie: s.owner } }),
      s.env,
    ))!;
    expect(download.status).toBe(200);
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
    // A conversation guest is not the archive owner and cannot export.
    expect(
      (await handleArchiveExportRoute(
        new Request("https://example.test/resources/archive-export/file/session-source/remote_source_guest", { headers: { Cookie: s.guest } }),
        s.env,
      ))!.status,
    ).toBe(401);
    expect(JSON.stringify(manifest)).not.toContain("private/remote_source");
    expect(JSON.stringify(manifest)).not.toContain("meeting-provider-test");
  });

  it("waits for capture cleanup before deletion and removes quarantined attempts only in the owned session", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.remote()).json()) as {
      recordingId: string;
    };
    await s.bucket.put(
      `legacy/${s.id}/sources/unconfirmed/original`,
      new Uint8Array([1, 2, 3, 4]).buffer,
    );
    await s.bucket.put(
      "legacy/another_session/sources/original",
      new Uint8Array([9]).buffer,
    );
    async function remove() {
      return (await handleDeletionRoute(
        new Request(`https://example.test/resources/drafts/${s.memory}`, {
          method: "DELETE",
          headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
        }),
        s.env,
      ))!;
    }
    expect((await remove()).status).toBe(409);
    expect(
      s.db.database
        .prepare("SELECT id FROM memory_stories WHERE id=?")
        .get(s.memory),
    ).toBeTruthy();
    expect(
      s.bucket.objects.has(`legacy/${s.id}/sources/unconfirmed/original`),
    ).toBe(true);
    s.db.database
      .prepare(
        "UPDATE legacy_remote_recordings SET capture_stopped=1,phase='discarded' WHERE id=?",
      )
      .run(recordingId);
    expect((await remove()).status).toBe(200);
    expect([...s.bucket.objects.keys()]).toEqual([
      "legacy/another_session/sources/original",
    ]);
    expect(
      s.db.database
        .prepare("SELECT id FROM legacy_remote_recordings WHERE id=?")
        .get(recordingId),
    ).toBeUndefined();
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM legacy_remote_recording_usage")
        .get()!.n,
    ).toBe(1);
  });

  it("enforces the daily capture budget even after old recording groups become terminal", async () => {
    const s = await setup();
    await s.agree();
    for (let i = 0; i < 3; i++) {
      const response = await s.remote(
        "",
        "POST",
        s.owner,
        `remote_budget_test_${i}`,
      );
      expect(response.status).toBe(202);
      const { recordingId } = (await response.json()) as {
        recordingId: string;
      };
      s.db.database
        .prepare(
          "UPDATE legacy_remote_recordings SET phase='failed',capture_stopped=1 WHERE id=?",
        )
        .run(recordingId);
    }
    expect(
      (await s.remote("", "POST", s.owner, "remote_budget_test_4")).status,
    ).toBe(429);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM legacy_remote_recordings")
        .get()!.n,
    ).toBe(3);
    expect(() =>
      s.db.database
        .prepare(
          "INSERT INTO legacy_remote_recording_usage(recording_id,owner_user_id,daily_limit,created_at) VALUES('bypass_attempt','owner_legacy_test',3,?)",
        )
        .run(new Date().toISOString()),
    ).toThrow(/daily limit/);
  });
});
