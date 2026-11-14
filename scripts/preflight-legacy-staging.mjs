import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const httpsOrigin = (value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin === value &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};
const noWhitespace = (value) =>
  !/\s/u.test(value) &&
  [...value].every((character) => character.charCodeAt(0) >= 32);
const checks = [
  {
    name: "REALTIMEKIT_ACCOUNT_ID",
    group: "bootstrap",
    secret: false,
    purpose: "Cloudflare account hosting the isolated RealtimeKit app",
    valid: (value) => /^[a-f0-9]{32}$/iu.test(value),
  },
  {
    name: "REALTIMEKIT_API_TOKEN",
    group: "bootstrap",
    secret: true,
    purpose:
      "backend-only RealtimeKit access, separate from deployment credentials",
    valid: (value) => value.length >= 20 && noWhitespace(value),
  },
  {
    name: "REALTIMEKIT_APP_ID",
    group: "provider",
    secret: false,
    purpose: "isolated RealtimeKit app (not a raw SFU app)",
    valid: (value) => /^[A-Za-z0-9_-]{16,128}$/u.test(value),
  },
  {
    name: "REALTIMEKIT_CALL_PRESET",
    group: "provider",
    secret: false,
    purpose: "unrecorded video call preset shared by host and guest",
    valid: (value) => /^[A-Za-z0-9_-]{1,128}$/u.test(value),
  },
  {
    name: "REALTIMEKIT_CALL_PRESET_ID",
    group: "provider",
    secret: false,
    purpose: "preset ID for server-side permission verification",
    valid: (value) => /^[A-Za-z0-9_-]{8,128}$/u.test(value),
  },
  {
    name: "SESSION_SECRET",
    group: "runtime",
    secret: true,
    purpose: "existing application/participant sessions",
    valid: (value) => value.length >= 32,
  },
  {
    name: "MEMORIES_STAGING_ORIGIN",
    group: "runtime",
    secret: false,
    purpose: "exact isolated HTTPS application origin",
    valid: httpsOrigin,
  },
];
/** Shape only: never returns environment values, authenticates, creates resources or sends media. */
export function legacyStagingPreflight(env) {
  const results = checks.map((check) => {
    const value = env[check.name] ?? "";
    return {
      name: check.name,
      group: check.group,
      secret: check.secret,
      purpose: check.purpose,
      status: !value ? "missing" : check.valid(value) ? "present" : "invalid",
    };
  });
  const bootstrapReady = results
    .filter((result) => result.group === "bootstrap")
    .every((result) => result.status === "present");
  const shapeReady = results.every((result) => result.status === "present");
  return {
    status: shapeReady
      ? "shape_ready_live_proof_pending"
      : bootstrapReady
        ? "blocked_configuration"
        : "blocked_credentials",
    shapeReady,
    checks: results,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const report = legacyStagingPreflight(process.env);
  console.log("memoriesmystory remote Our Living Legacy staging preflight");
  console.log(
    "Values are redacted. No network request, resource creation or media capture occurred.",
  );
  for (const check of report.checks)
    console.log(`${check.name}: ${check.status} — ${check.purpose}`);
  console.log(`Result: ${report.status}.`);
  console.log(
    "RealtimeKit credentials stay server-side. Guests use the existing invitation; Clerk and deployment credentials are separate application concerns. No external-room fallback.",
  );
  if (!report.shapeReady) process.exitCode = 1;
}
