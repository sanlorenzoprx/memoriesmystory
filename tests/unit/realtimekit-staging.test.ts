import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Operator script shared with the manual Actions workflow.
import * as staging from "../../scripts/realtimekit-staging-proof.mjs";
const { runStagingProof, callPreset, stagingAppName } = staging;
const env = {
  REALTIMEKIT_ACCOUNT_ID: "a".repeat(32),
  REALTIMEKIT_API_TOKEN: "SECRET_TOKEN_CANARY",
  GITHUB_RUN_ID: "12345",
};
function mock(
  options: {
    fresh?: boolean;
    unsafe?: boolean;
    denyCreate?: boolean;
    wrongScope?: boolean;
    failSecond?: boolean;
    cleanupFail?: boolean;
    ambiguousMeeting?: boolean;
    duplicate?: boolean;
  } = {},
) {
  const peers = new Map<string, unknown>();
  let state = "ACTIVE";
  const app = { id: "app_test_001", name: stagingAppName };
  const preset = {
    ...callPreset,
    id: "preset_test001",
    permissions: {
      ...callPreset.permissions,
      ...(options.unsafe ? { can_record: true } : {}),
    },
  };
  const grants = (id: string, expires: string) =>
    `header.${Buffer.from(JSON.stringify({ meetingId: options.wrongScope ? "wrong_meeting" : "meeting_test001", participantId: id, exp: Math.floor(Date.parse(expires) / 1000) })).toString("base64url")}.PRIVATE_SIGNATURE_CANARY`;
  const fetch = vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input),
      path = url.pathname,
      method = init.method;
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    const ok = (data: unknown) => Response.json({ success: true, data });
    const absent = () =>
      Response.json(
        {
          success: false,
          errors: [{ code: 404, message: "PRIVATE_BODY_CANARY" }],
        },
        { status: 404 },
      );
    if (path.endsWith("/apps")) {
      if (method === "POST") {
        if (options.denyCreate)
          return Response.json(
            {
              success: false,
              errors: [{ code: 10000, message: "SECRET_TOKEN_CANARY" }],
            },
            { status: 403 },
          );
        return ok({ app });
      }
      return ok(options.fresh ? [] : options.duplicate ? [app, app] : [app]);
    }
    if (path.endsWith("/presets"))
      return ok(method === "POST" ? preset : options.fresh ? [] : [preset]);
    if (path.endsWith("/presets/preset_test001")) return ok(preset);
    if (path.endsWith("/meetings")) {
      if (options.ambiguousMeeting) throw new Error("PRIVATE_BODY_CANARY");
      return ok({ id: "meeting_test001" });
    }
    if (path.endsWith("/participants")) {
      if (method === "GET") return ok([...peers].map(([id]) => ({ id })));
      const id = body.custom_participant_id.endsWith("host")
        ? "participant_host001"
        : "participant_guest001";
      peers.set(id, body);
      if (options.failSecond && id.includes("guest"))
        throw new Error("SECRET_TOKEN_CANARY");
      return ok({ id, token: grants(id, body.token.expires_on) });
    }
    if (path.endsWith("/token")) {
      const id = path.split("/").at(-2)!;
      return ok({ token: grants(id, body.expires_on) });
    }
    if (path.includes("/participants/")) {
      const id = path.split("/").at(-1)!;
      if (method === "DELETE") {
        peers.delete(id);
        return ok({});
      }
      return peers.has(id) ? ok({ id }) : absent();
    }
    if (path.endsWith("/meetings/meeting_test001")) {
      if (method === "PATCH") {
        if (options.cleanupFail) throw new Error("SECRET_TOKEN_CANARY");
        state = body.status;
      }
      return ok({
        status: state,
        record_on_start: false,
        live_stream_on_start: false,
        transcribe_on_end: false,
        summarize_on_end: false,
        persist_chat: false,
      });
    }
    throw new Error("Unexpected fixture path");
  });
  return { fetch, peers };
}
describe("isolated RealtimeKit staging API proof", () => {
  it("creates only designated staging resources, verifies short scoped grants and closes the synthetic meeting", async () => {
    const s = mock({ fresh: true }),
      result = await runStagingProof(env, s.fetch);
    expect(result).toMatchObject({
      ok: true,
      status: "staging_api_proof_passed",
      cleanupConfirmed: true,
    });
    expect(result.checks).toContain(
      "two_scoped_short_lived_participant_grants_verified",
    );
    expect(s.peers.size).toBe(0);
    const writes = s.fetch.mock.calls.filter(([, i]) => i.method === "POST");
    expect(writes.filter(([u]) => u.endsWith("/apps"))).toHaveLength(1);
    expect(writes.filter(([u]) => u.endsWith("/presets"))).toHaveLength(1);
    const meeting = JSON.parse(
      writes.find(([u]) => u.endsWith("/meetings"))![1].body as string,
    );
    expect(meeting).toMatchObject({
      record_on_start: false,
      live_stream_on_start: false,
      transcribe_on_end: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/CANARY/);
    expect(JSON.stringify(result)).not.toContain(env.REALTIMEKIT_ACCOUNT_ID);
  });
  it("reuses matching staging app/preset without changing them", async () => {
    const s = mock();
    expect((await runStagingProof(env, s.fetch)).ok).toBe(true);
    expect(
      s.fetch.mock.calls.some(
        ([url, init]) =>
          (url.endsWith("/apps") || url.endsWith("/presets")) &&
          init.method !== "GET",
      ),
    ).toBe(false);
  });
  it("refuses ambiguous or unsafe existing resources before allocating a meeting", async () => {
    for (const options of [{ duplicate: true }, { unsafe: true }]) {
      const s = mock(options);
      expect((await runStagingProof(env, s.fetch)).ok).toBe(false);
      expect(
        s.fetch.mock.calls.some(([url]) => url.endsWith("/meetings")),
      ).toBe(false);
    }
  });
  it("cleans up known and uncertain participant allocations after a partial failure", async () => {
    const s = mock({ failSecond: true }),
      result = await runStagingProof(env, s.fetch);
    expect(result).toMatchObject({
      ok: false,
      stage: "create_synthetic_guest",
      cleanupConfirmed: true,
    });
    expect(s.peers.size).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/CANARY/);
  });
  it("rejects a token scope mismatch and still removes the participant", async () => {
    const s = mock({ wrongScope: true });
    expect(await runStagingProof(env, s.fetch)).toMatchObject({
      ok: false,
      status: "participant_grant_scope_or_expiry_mismatch",
      cleanupConfirmed: true,
    });
    expect(s.peers.size).toBe(0);
  });
  it("never labels failed cleanup or ambiguous meeting creation as confirmed", async () => {
    for (const options of [{ cleanupFail: true }, { ambiguousMeeting: true }]) {
      const s = mock(options),
        result = await runStagingProof(env, s.fetch);
      expect(result).toMatchObject({ ok: false, cleanupConfirmed: false });
      expect(
        s.fetch.mock.calls.filter(([url]) => url.endsWith("/meetings")),
      ).toHaveLength(1);
      expect(JSON.stringify(result)).not.toMatch(/CANARY/);
    }
  });
  it("reports denied write permissions without exposing provider messages or retrying", async () => {
    const s = mock({ fresh: true, denyCreate: true });
    expect(await runStagingProof(env, s.fetch)).toMatchObject({
      ok: false,
      status: "provider_request_failed",
      stage: "create_staging_app",
      httpStatus: 403,
      providerCodes: [10000],
    });
    expect(s.fetch.mock.calls).toHaveLength(2);
  });
  it("requires credentials before making any request", async () => {
    const fetch = vi.fn();
    expect(await runStagingProof({}, fetch)).toEqual({
      ok: false,
      status: "missing_or_invalid_configuration",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
