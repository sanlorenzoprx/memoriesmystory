/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import {
  closeLegacyRemoteCall,
  handleLegacyRemoteRoute,
} from "../../worker/legacy-remote";
import type { TestD1 } from "../helpers/legacy-runtime";
const databases: TestD1[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const db of databases.splice(0)) db.close();
});
async function setup() {
  const fixture = await setupLegacyFixture("remote");
  databases.push(fixture.db);
  const env = {
    ...fixture.env,
    REALTIMEKIT_ACCOUNT_ID: "account_test",
    REALTIMEKIT_APP_ID: "app_test",
    REALTIMEKIT_API_TOKEN: "PRIVATE_API_CANARY",
    REALTIMEKIT_CALL_PRESET: "family-call",
    REALTIMEKIT_CALL_PRESET_ID: "preset-test",
  };
  const created = await fixture.create();
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
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
          token: "UNUSED_TOKEN_CANARY",
        },
      });
    }
    if (path.endsWith("/token"))
      return Response.json({
        success: true,
        data: { token: "SCOPED_PARTICIPANT_CANARY" },
      });
    return Response.json({ success: true, data: {} });
  });
  vi.stubGlobal("fetch", fetch);
  async function call(cookie = fixture.owner, method = "POST", csrf = true) {
    return (await handleLegacyRemoteRoute(
      new Request(
        `https://example.test/resources/legacy-sessions/${created.sessionId}/call`,
        {
          method,
          headers: {
            Cookie: cookie,
            ...(csrf ? { "X-Memories-Request": "legacy-v1" } : {}),
          },
        },
      ),
      env,
    ))!;
  }
  return { ...fixture, ...created, env, fetch, remote: call };
}
describe("RealtimeKit participant-scoped calling", () => {
  it("requires session access and CSRF before any provider operation", async () => {
    const s = await setup();
    expect((await s.remote("")).status).toBe(403);
    expect((await s.remote(s.owner, "POST", false)).status).toBe(403);
    expect((await s.remote(s.owner, "GET")).status).toBe(200);
    expect(s.fetch).not.toHaveBeenCalled();
  });
  it("creates one unrecorded meeting and two scoped identities, reuses mapping after retries, and admits a guest without recording consent or an account", async () => {
    const s = await setup();
    const first = await s.remote();
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toContain("no-store");
    const text = await first.text();
    expect(text).toContain("SCOPED_PARTICIPANT_CANARY");
    expect(text).not.toContain("PRIVATE_API_CANARY");
    expect(text).not.toContain("UNUSED_TOKEN_CANARY");
    const retry = await s.remote();
    expect(retry.status).toBe(200);
    const joined = await s.join(s.sessionId, s.joinPath);
    const guestCookie = joined.headers.get("Set-Cookie")!.split(";")[0]!;
    expect((await s.remote(guestCookie)).status).toBe(200);
    const creates = s.fetch.mock.calls.filter(([url]) =>
      url.endsWith("/meetings"),
    );
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0]![1]!.body as string)).toMatchObject({
      record_on_start: false,
      transcribe_on_end: false,
      live_stream_on_start: false,
    });
    expect(
      s.fetch.mock.calls.filter(([url]) => url.endsWith("/participants")),
    ).toHaveLength(2);
    const grants = s.fetch.mock.calls.filter(([url]) => url.endsWith("/token"));
    for (const [, init] of grants) {
      const expiry = Date.parse(JSON.parse(init!.body as string).expires_on);
      expect(expiry - Date.now()).toBeLessThanOrEqual(900000);
      expect(expiry).toBeGreaterThan(Date.now());
    }
    expect(
      s.db.database.prepare("SELECT consent FROM legacy_participants").all(),
    ).toEqual([{ consent: "pending" }, { consent: "pending" }]);
    expect(
      s.db.database.prepare("SELECT * FROM legacy_recordings").all(),
    ).toHaveLength(0);
  });
  it("lets a guest wait without allocating rooms or requiring recording agreement", async () => {
    const s = await setup();
    const joined = await s.join(s.sessionId, s.joinPath);
    expect(
      (await s.remote(joined.headers.get("Set-Cookie")!.split(";")[0]!)).status,
    ).toBe(409);
    expect(s.fetch.mock.calls.some(([url]) => url.endsWith("/meetings"))).toBe(
      false,
    );
  });
  it("does not repeat an ambiguous provider allocation or expose its failure body", async () => {
    const s = await setup();
    s.fetch.mockImplementation(async (input: string) => {
      if (input.includes("/presets/"))
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
      throw new Error("PRIVATE_UPSTREAM_BODY");
    });
    const failure = await s.remote();
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain("PRIVATE_UPSTREAM");
    expect((await s.remote()).status).toBe(503);
    expect(
      s.fetch.mock.calls.filter(([url]) => url.endsWith("/meetings")),
    ).toHaveLength(1);
  });
  it("refuses a preset that allows recording before creating a meeting", async () => {
    const s = await setup();
    s.fetch.mockResolvedValue(
      Response.json({
        success: true,
        data: { name: "family-call", permissions: { can_record: true } },
      }),
    );
    expect((await s.remote()).status).toBe(503);
    expect(s.fetch).toHaveBeenCalledTimes(1);
  });
  it("serializes simultaneous room creation", async () => {
    const s = await setup();
    const results = await Promise.all([s.remote(), s.remote()]);
    expect(results.some((result) => result.status === 200)).toBe(true);
    expect(results.every((result) => [200, 409].includes(result.status))).toBe(
      true,
    );
    expect(
      s.fetch.mock.calls.filter(([url]) => url.endsWith("/meetings")),
    ).toHaveLength(1);
  });
  it("closes provider admission and deletes participant identities when the host removes access; closed mappings cannot mint tokens", async () => {
    const s = await setup();
    await s.remote();
    const guest = s.db.database
      .prepare("SELECT id FROM legacy_participants WHERE role='guest'")
      .get() as { id: string };
    // Use the configured environment: the existing fixture intentionally has no provider credentials.
    const { handleLegacySessionRoute } =
      await import("../../worker/legacy-sessions");
    const response = await handleLegacySessionRoute(
      new Request(
        `https://example.test/resources/legacy-sessions/${s.sessionId}/revoke`,
        {
          method: "POST",
          headers: { Cookie: s.owner, "X-Memories-Request": "legacy-v1" },
          body: JSON.stringify({ participantId: guest.id }),
        },
      ),
      s.env,
    );
    expect(response!.status).toBe(200);
    const patch = s.fetch.mock.calls.find(
      ([url, init]) =>
        url.endsWith("/meetings/meeting-provider-test") &&
        init?.method === "PATCH",
    );
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      status: "INACTIVE",
    });
    expect(
      s.fetch.mock.calls.filter(([, init]) => init?.method === "DELETE"),
    ).toHaveLength(2);
    expect((await s.remote()).status).toBe(503);
    await closeLegacyRemoteCall(s.env, s.sessionId);
  });
  it("keeps closure retryable if the provider cannot confirm removal", async () => {
    const s = await setup();
    await s.remote();
    s.fetch.mockRejectedValueOnce(new Error("interruption"));
    await expect(closeLegacyRemoteCall(s.env, s.sessionId)).rejects.toThrow();
    expect((await s.remote()).status).toBe(503);
    await closeLegacyRemoteCall(s.env, s.sessionId);
    expect(
      s.db.database.prepare("SELECT state FROM legacy_remote_calls").get(),
    ).toEqual({ state: "closed" });
  });
  it("deletion closes provider admission before removing mappings and originals", async () => {
    const s = await setup();
    await s.remote();
    const { handleDeletionRoute } = await import("../../worker/deletion");
    const result = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(result!.status).toBe(200);
    expect(
      s.fetch.mock.calls.filter(([, init]) => init?.method === "DELETE"),
    ).toHaveLength(2);
    expect(
      s.db.database.prepare("SELECT * FROM legacy_remote_calls").all(),
    ).toHaveLength(0);
    expect(s.bucket.objects.size).toBe(0);
    expect((await s.remote()).status).toBe(404);
  });
  it("rejects a late allocation after deletion closes the session", async () => {
    const s = await setup();
    s.db.database
      .prepare(
        "UPDATE legacy_sessions SET status='closed',deletion_requested_at=? WHERE id=?",
      )
      .run(new Date().toISOString(), s.sessionId);
    expect(() =>
      s.db.database
        .prepare(
          "INSERT INTO legacy_remote_calls(session_id,state,created_at,updated_at) VALUES(?,'provisioning',?,?)",
        )
        .run(s.sessionId, "now", "now"),
    ).toThrow(/closed/);
    expect((await s.remote()).status).toBe(404);
    expect(s.fetch).not.toHaveBeenCalled();
  });
  it("keeps mappings and denies new grants when deletion cannot confirm provider removal", async () => {
    const s = await setup();
    await s.remote();
    s.fetch.mockRejectedValueOnce(new Error("provider unavailable"));
    const { handleDeletionRoute } = await import("../../worker/deletion");
    const result = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(result!.status).toBe(500);
    expect(
      s.db.database.prepare("SELECT * FROM legacy_remote_calls").all(),
    ).toHaveLength(1);
    expect(s.bucket.objects.size).toBe(2);
    expect((await s.remote()).status).toBe(404);
  });
});
