/** RealtimeKit REST boundary. Never log upstream bodies, credentials or participant tokens. */
export type RealtimeKitEnv = {
  REALTIMEKIT_ACCOUNT_ID?: string;
  REALTIMEKIT_APP_ID?: string;
  REALTIMEKIT_API_TOKEN?: string;
  REALTIMEKIT_CALL_PRESET?: string;
  REALTIMEKIT_CALL_PRESET_ID?: string;
};
export function realtimeKitConfigured(env: RealtimeKitEnv) {
  return Boolean(
    env.REALTIMEKIT_ACCOUNT_ID &&
    env.REALTIMEKIT_APP_ID &&
    env.REALTIMEKIT_API_TOKEN &&
    env.REALTIMEKIT_CALL_PRESET &&
    env.REALTIMEKIT_CALL_PRESET_ID,
  );
}
export class RealtimeKitError extends Error {
  constructor(readonly status: number) {
    super("remote_unavailable");
  }
}
export async function realtimeKitRequest<T>(
  env: RealtimeKitEnv,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!realtimeKitConfigured(env)) throw new Error("remote_unavailable");
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.REALTIMEKIT_ACCOUNT_ID!)}/realtime/kit/${encodeURIComponent(env.REALTIMEKIT_APP_ID!)}`;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.REALTIMEKIT_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new RealtimeKitError(response.status);
  const result = (await response.json()) as { success?: boolean; data?: T };
  if (result.success !== true || (!result.data && method !== "DELETE"))
    throw new Error("remote_unavailable");
  return (result.data ?? {}) as T;
}

/** Never trust a general admin preset for an unrecorded guest call. */
export async function assertUnrecordedCallPreset(env: RealtimeKitEnv) {
  const preset = await realtimeKitRequest<{
    name: string;
    permissions: Record<string, unknown>;
  }>(env, `/presets/${encodeURIComponent(env.REALTIMEKIT_CALL_PRESET_ID!)}`);
  const permissions = preset.permissions;
  if (
    preset.name !== env.REALTIMEKIT_CALL_PRESET ||
    !permissions ||
    permissions.can_record !== false ||
    permissions.can_livestream !== false ||
    permissions.can_change_participant_permissions !== false ||
    permissions.transcription_enabled !== false ||
    permissions.kick_participant !== false ||
    permissions.recorder_type !== "NONE"
  )
    throw new Error("remote_unsafe_preset");
}
