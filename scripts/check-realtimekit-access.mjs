import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Read-only account-scoped probe. Never return supplied values or upstream bodies. */
export async function checkRealtimeKitAccess(env, fetcher = globalThis.fetch) {
  const account = env.REALTIMEKIT_ACCOUNT_ID ?? "";
  const token = env.REALTIMEKIT_API_TOKEN ?? "";
  if (!/^[a-f0-9]{32}$/iu.test(account) || !token || /\s/u.test(token))
    return { ok: false, status: "missing_or_invalid_configuration" };
  try {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${account}/realtime/kit/apps`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        redirect: "error",
        signal: globalThis.AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      return { ok: false, status: response.status === 401 || response.status === 403
        ? "access_denied" : "provider_request_failed", httpStatus: response.status };
    const body = await response.json();
    if (body?.success !== true || !Array.isArray(body.data))
      return { ok: false, status: "unexpected_provider_response" };
    return { ok: true, status: "realtimekit_read_access_verified" };
  } catch {
    return { ok: false, status: "provider_connection_failed" };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkRealtimeKitAccess(process.env);
  console.log(JSON.stringify(result));
  console.log("Read-only check: no app, meeting, recording, media, deployment or billing changes.");
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## RealtimeKit access check\n\nResult: **${result.status}**.\n\nRead-only app-list request. No credentials, account/app identifiers or provider response bodies are included. No resource or billing changes. This does not establish meeting-write permissions, live call quality or recording durability.\n`);
  }
  if (!result.ok) process.exitCode = 1;
}
