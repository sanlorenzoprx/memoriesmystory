import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Read metadata permissions only; never retrieve archive content or worker settings/secrets. */
export async function checkArchiveStagingAccess(
  env,
  fetcher = globalThis.fetch,
) {
  const account = env.REALTIMEKIT_ACCOUNT_ID ?? "",
    token = env.REALTIMEKIT_API_TOKEN ?? "";
  if (!/^[a-f0-9]{32}$/iu.test(account) || !token || /\s/u.test(token))
    return { ok: false, status: "missing_or_invalid_configuration" };
  const endpoints = {
    worker_scripts: "workers/scripts",
    d1_databases: "d1/database",
    r2_buckets: "r2/buckets",
  };
  const checks = await Promise.all(
    Object.entries(endpoints).map(async ([capability, path]) => {
      try {
        const response = await fetcher(
          `https://api.cloudflare.com/client/v4/accounts/${account}/${path}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            redirect: "error",
            signal: globalThis.AbortSignal.timeout(20000),
          },
        );
        if (!response.ok)
          return {
            capability,
            accessible: false,
            status: [401, 403].includes(response.status)
              ? "access_denied"
              : "provider_request_failed",
            httpStatus: response.status,
          };
        const body = await response.json(),
          result = body?.result ?? body?.data,
          rows = capability === "r2_buckets" ? result?.buckets : result;
        if (body?.success !== true || !Array.isArray(rows))
          return {
            capability,
            accessible: false,
            status: "unexpected_metadata_shape",
            httpStatus: response.status,
          };
        const count = rows.filter((row) => {
          const name = String(row?.name ?? row?.id ?? "");
          return /^memoriesmystory[-_]/u.test(name) && /staging/iu.test(name);
        }).length;
        return {
          capability,
          accessible: true,
          status: "metadata_read_verified",
          httpStatus: response.status,
          matchingStagingResourceCount: count,
        };
      } catch {
        return {
          capability,
          accessible: false,
          status: "provider_connection_failed",
        };
      }
    }),
  );
  return {
    ok: true,
    status: "read_only_archive_capability_check_complete",
    checks,
    scope: "metadata_read_only_no_content_or_configuration_changes",
    deploymentWriteAccess: "not_tested",
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkArchiveStagingAccess(process.env);
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Existing token: private archive staging read capabilities\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\nRead-only metadata lists for Worker scripts, D1 databases and R2 buckets in the already configured account. No private content, Worker settings/secrets, credential values, resource identifiers or provider bodies are exported. No resource, deployment, media or billing changes. Read access does not establish deployment/write permissions. RealtimeKit call access is a separate verified capability.\n`,
    );
  if (!result.ok) process.exitCode = 1;
}
