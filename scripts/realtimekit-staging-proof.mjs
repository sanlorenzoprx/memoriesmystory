import { Buffer } from "node:buffer";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const stagingAppName = "memoriesmystory-staging";
export const stagingPresetName = "memoriesmystory-unrecorded";
export const callPreset = {
  name: stagingPresetName,
  config: {
    view_type: "GROUP_CALL",
    max_screenshare_count: 0,
    max_video_streams: { desktop: 2, mobile: 2 },
    media: {
      audio: { enable_high_bitrate: false, enable_stereo: false },
      video: { quality: "vga", frame_rate: 24, simulcast: true },
      screenshare: { quality: "vga", frame_rate: 5 },
    },
  },
  permissions: {
    accept_waiting_requests: false,
    can_accept_production_requests: false,
    can_change_participant_permissions: false,
    can_edit_display_name: false,
    can_livestream: false,
    can_record: false,
    can_spotlight: false,
    disable_participant_audio: false,
    disable_participant_screensharing: false,
    disable_participant_video: false,
    hidden_participant: false,
    kick_participant: false,
    pin_participant: false,
    recorder_type: "NONE",
    show_participant_list: true,
    waiting_room_type: "SKIP",
    stage_enabled: false,
    stage_access: "ALLOWED",
    transcription_enabled: false,
    chat: {
      private: {
        can_receive: false,
        can_send: false,
        files: false,
        text: false,
      },
      public: { can_send: false, files: false, text: false },
    },
    connected_meetings: {
      can_alter_connected_meetings: false,
      can_switch_connected_meetings: false,
      can_switch_to_parent_meeting: false,
    },
    media: {
      audio: { can_produce: "ALLOWED" },
      video: { can_produce: "ALLOWED" },
      screenshare: { can_produce: "NOT_ALLOWED" },
    },
    plugins: {
      can_close: false,
      can_edit_config: false,
      can_start: false,
      config: {},
    },
    polls: { can_create: false, can_view: false, can_vote: false },
  },
  ui: {
    design_tokens: {
      border_radius: "rounded",
      border_width: "thin",
      spacing_base: 4,
      theme: "light",
      colors: {
        background: {
          1000: "#ffffff",
          600: "#ffffff",
          700: "#f7f7f7",
          800: "#eeeeee",
          900: "#dddddd",
        },
        brand: {
          300: "#507060",
          400: "#405f50",
          500: "#304f40",
          600: "#203f30",
          700: "#102f20",
        },
        danger: "#a02020",
        success: "#206040",
        text: "#202020",
        text_on_brand: "#ffffff",
        video_bg: "#202020",
        warning: "#805000",
      },
    },
  },
};
const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/u.test(value);
const segment = (value) => {
  if (!validId(value)) throw new Error("invalid_provider_identifier");
  return encodeURIComponent(value);
};
class ProbeError extends Error {
  constructor(status, httpStatus, codes = []) {
    super(status);
    this.httpStatus = httpStatus;
    this.codes = codes;
  }
}
function assertPreset(preset) {
  if (
    preset?.name !== stagingPresetName ||
    preset.config?.view_type !== "GROUP_CALL"
  )
    throw new ProbeError("unsafe_staging_preset");
  const expected = callPreset.permissions;
  for (const field of [
    "can_record",
    "can_livestream",
    "can_change_participant_permissions",
    "kick_participant",
    "transcription_enabled",
    "hidden_participant",
    "recorder_type",
    "waiting_room_type",
  ]) {
    if (preset.permissions?.[field] !== expected[field])
      throw new ProbeError("unsafe_staging_preset");
  }
  for (const kind of ["audio", "video"])
    if (preset.permissions?.media?.[kind]?.can_produce !== "ALLOWED")
      throw new ProbeError("unsafe_staging_preset");
}
function assertGrant(token, meeting, participant, expires) {
  try {
    const claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    if (
      claims.meetingId !== meeting ||
      claims.participantId !== participant ||
      !Number.isFinite(claims.exp) ||
      Math.abs(claims.exp * 1000 - Date.parse(expires)) > 2000
    )
      throw new Error();
  } catch {
    throw new ProbeError("participant_grant_scope_or_expiry_mismatch");
  }
}

/** Explicit operator action: fixed staging resources only; no media, recording or billing activation. */
export async function runStagingProof(env, fetcher = globalThis.fetch) {
  if (
    !/^[a-f0-9]{32}$/iu.test(env.REALTIMEKIT_ACCOUNT_ID ?? "") ||
    !env.REALTIMEKIT_API_TOKEN ||
    /\s/u.test(env.REALTIMEKIT_API_TOKEN)
  )
    return { ok: false, status: "missing_or_invalid_configuration" };
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.REALTIMEKIT_ACCOUNT_ID}/realtime/kit`;
  const checks = [];
  let stage = "discover_staging_app",
    meetingPath,
    appId,
    presetId,
    failed;
  let meetingAllocationAttempted = false,
    peerAllocationUncertain = false;
  const peers = [];
  async function request(path, method = "GET", body) {
    const response = await fetcher(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.REALTIMEKIT_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(20000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true)
      throw new ProbeError(
        "provider_request_failed",
        response.status,
        Array.isArray(payload?.errors)
          ? payload.errors
              .map((item) => item?.code)
              .filter(Number.isSafeInteger)
              .slice(0, 5)
          : [],
      );
    return payload.data;
  }
  async function find(path, name) {
    const found = [];
    for (let page = 1; page <= 20; page++) {
      const rows = await request(
        `${path}?search=${encodeURIComponent(name)}&page_no=${page}&per_page=100`,
      );
      if (!Array.isArray(rows))
        throw new ProbeError("unexpected_provider_response");
      found.push(...rows.filter((row) => row.name === name));
      if (rows.length < 100) {
        if (found.length > 1)
          throw new ProbeError("ambiguous_staging_resource");
        return found[0];
      }
    }
    throw new ProbeError("resource_listing_limit");
  }
  try {
    let app = await find("/apps", stagingAppName);
    if (!app) {
      stage = "create_staging_app";
      const created = await request("/apps", "POST", { name: stagingAppName });
      app = created?.app;
    }
    appId = segment(app?.id);
    checks.push("staging_app_ready");
    stage = "discover_staging_preset";
    let preset = await find(`/${appId}/presets`, stagingPresetName);
    if (!preset) {
      stage = "create_staging_preset";
      preset = await request(`/${appId}/presets`, "POST", callPreset);
    }
    presetId = segment(preset?.id);
    stage = "verify_staging_preset";
    assertPreset(await request(`/${appId}/presets/${presetId}`));
    checks.push("restricted_preset_verified");
    stage = "create_synthetic_meeting";
    meetingAllocationAttempted = true;
    const meeting = await request(`/${appId}/meetings`, "POST", {
      title: `memoriesmystory-staging-api-${/^[0-9]+$/u.test(env.GITHUB_RUN_ID ?? "") ? env.GITHUB_RUN_ID : "manual"}`,
      record_on_start: false,
      live_stream_on_start: false,
      transcribe_on_end: false,
      summarize_on_end: false,
      persist_chat: false,
    });
    meetingPath = `/${appId}/meetings/${segment(meeting?.id)}`;
    stage = "verify_unrecorded_meeting";
    const stored = await request(meetingPath);
    for (const flag of [
      "record_on_start",
      "live_stream_on_start",
      "transcribe_on_end",
      "summarize_on_end",
      "persist_chat",
    ])
      if (stored?.[flag] !== false)
        throw new ProbeError("unsafe_staging_meeting");
    checks.push("unrecorded_meeting_verified");
    const expires = new Date(Date.now() + 900000).toISOString();
    for (const role of ["host", "guest"]) {
      stage = `create_synthetic_${role}`;
      peerAllocationUncertain = true;
      const peer = await request(`${meetingPath}/participants`, "POST", {
        name: `Synthetic ${role}`,
        custom_participant_id: `memoriesmystory-test-${role}`,
        preset_name: stagingPresetName,
        token: { expires_on: expires },
      });
      peers.push(segment(peer?.id));
      peerAllocationUncertain = false;
      assertGrant(peer?.token, meeting.id, peer.id, expires);
      stage = `refresh_synthetic_${role}`;
      const refreshed = await request(
        `${meetingPath}/participants/${segment(peer.id)}/token`,
        "POST",
        { expires_on: expires },
      );
      assertGrant(refreshed?.token, meeting.id, peer.id, expires);
    }
    checks.push("two_scoped_short_lived_participant_grants_verified");
  } catch (error) {
    failed = {
      ok: false,
      status:
        error instanceof ProbeError ? error.message : "staging_proof_failed",
      stage,
      ...(error instanceof ProbeError && error.httpStatus
        ? { httpStatus: error.httpStatus, providerCodes: error.codes }
        : {}),
    };
  }
  let cleanupConfirmed = !meetingAllocationAttempted;
  if (meetingPath) {
    try {
      await request(meetingPath, "PATCH", { status: "INACTIVE" });
      if (peerAllocationUncertain) {
        const allocated = await request(
          `${meetingPath}/participants?per_page=100`,
        );
        if (!Array.isArray(allocated) || allocated.length >= 100)
          throw new ProbeError("cleanup_listing_uncertain");
        for (const peer of allocated)
          if (!peers.includes(segment(peer.id))) peers.push(segment(peer.id));
      }
      for (const peer of peers) {
        await request(`${meetingPath}/participants/${peer}`, "DELETE");
        // Verify record absence; this is an API assertion, not a browser rejection test.
        try {
          await request(`${meetingPath}/participants/${peer}`);
          throw new ProbeError("participant_still_present");
        } catch (error) {
          if (!(error instanceof ProbeError) || error.httpStatus !== 404)
            throw error;
        }
      }
      const stored = await request(meetingPath);
      if (stored?.status !== "INACTIVE")
        throw new ProbeError("meeting_still_active");
      cleanupConfirmed = true;
      checks.push("meeting_closed_and_participant_records_removed");
    } catch {
      cleanupConfirmed = false;
    }
  }
  const configuration =
    appId && presetId
      ? {
          REALTIMEKIT_APP_ID: appId,
          REALTIMEKIT_CALL_PRESET: stagingPresetName,
          REALTIMEKIT_CALL_PRESET_ID: presetId,
        }
      : undefined;
  return {
    ...(failed ?? {
      ok: cleanupConfirmed,
      status: cleanupConfirmed
        ? "staging_api_proof_passed"
        : "staging_cleanup_needs_attention",
    }),
    checks,
    cleanupConfirmed,
    ...(configuration ? { configuration } : {}),
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await runStagingProof(process.env);
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## RealtimeKit staging API proof\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\nOnly non-secret configuration identifiers and bounded check statuses are included. No media was sent, no recording started, and billing was not activated. API proof does not establish live browser connectivity or archival durability.\n`,
    );
  if (!result.ok) process.exitCode = 1;
}
