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
    name: "CLOUDFLARE_ACCOUNT_ID",
    group: "bootstrap",
    secret: false,
    purpose: "isolated staging account",
    valid: (value) => /^[a-f0-9]{32}$/iu.test(value),
  },
  {
    name: "CLOUDFLARE_API_TOKEN",
    group: "bootstrap",
    secret: true,
    purpose: "authorized staging provisioning/deployment",
    valid: (value) => value.length >= 20 && noWhitespace(value),
  },
  {
    name: "CLERK_SECRET_KEY",
    group: "bootstrap",
    secret: true,
    purpose: "separate Clerk test/staging instance",
    valid: (value) =>
      value.startsWith("sk_test_") && value.length >= 20 && noWhitespace(value),
  },
  {
    name: "VITE_CLERK_PUBLISHABLE_KEY",
    group: "bootstrap",
    secret: false,
    purpose: "matching Clerk test browser instance",
    valid: (value) =>
      value.startsWith("pk_test_") && value.length >= 20 && noWhitespace(value),
  },
  {
    name: "REALTIME_SFU_APP_ID",
    group: "provider",
    secret: false,
    purpose: "isolated Cloudflare Realtime SFU app",
    valid: (value) => /^[A-Za-z0-9_-]{16,128}$/u.test(value),
  },
  {
    name: "REALTIME_SFU_APP_SECRET",
    group: "provider",
    secret: true,
    purpose: "backend-only SFU authorization",
    valid: (value) => value.length >= 20 && noWhitespace(value),
  },
  {
    name: "SESSION_SECRET",
    group: "runtime",
    secret: true,
    purpose: "private application/participant sessions",
    valid: (value) => value.length >= 32,
  },
  {
    name: "MEMORIES_STAGING_ORIGIN",
    group: "runtime",
    secret: false,
    purpose: "exact isolated HTTPS origin",
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
    "Bootstrap credentials must be attached privately. App/session configuration can then be provisioned for isolated staging; never use an external-room fallback.",
  );
  if (!report.shapeReady) process.exitCode = 1;
}
