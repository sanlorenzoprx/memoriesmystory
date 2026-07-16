import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = new URL("../../scripts/preflight-identity-staging.mjs", import.meta.url);

const validEnvironment = {
  SESSION_SECRET: "session-sentinel-that-is-longer-than-thirty-two-characters",
  CLERK_SECRET_KEY: "clerk-secret-sentinel-value",
  VITE_CLERK_PUBLISHABLE_KEY: "clerk-publishable-sentinel-value",
  CLERK_AUTHORIZED_PARTIES: "https://staging.memories.example",
  MEMORIES_STAGING_ORIGIN: "https://staging.memories.example",
  CLOUDFLARE_ACCOUNT_ID: "cloudflare-account-sentinel",
  CLOUDFLARE_API_TOKEN: "cloudflare-token-sentinel-value",
  MEMORIES_STAGING_D1_DATABASE_ID: "11111111-2222-4333-8444-555555555555",
  MEMORIES_STAGING_R2_BUCKET_NAME: "memoriesmystory-staging-media",
  MEMORIES_STAGING_WORKER_NAME: "memoriesmystory-staging",
  CLERK_EMAIL_ENABLED: "true",
  CLERK_GOOGLE_ENABLED: "true",
  CLERK_FACEBOOK_ENABLED: "true"
};

function run(environment: Record<string, string>) {
  return spawnSync(process.execPath, [script.pathname], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...environment }
  });
}

describe("identity staging preflight", () => {
  it("fails closed and reports only missing status with no configuration", () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("SESSION_SECRET: missing");
    expect(result.stdout).toContain("No network request was made.");
  });

  it("accepts a complete configuration shape without printing any value", () => {
    const result = run(validEnvironment);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Preflight ready");
    for (const value of Object.values(validEnvironment)) {
      expect(result.stdout).not.toContain(value);
      expect(result.stderr).not.toContain(value);
    }
  });

  it("rejects an insecure origin and the non-deployable D1 placeholder", () => {
    const result = run({
      ...validEnvironment,
      MEMORIES_STAGING_ORIGIN: "http://staging.memories.example",
      MEMORIES_STAGING_D1_DATABASE_ID: "00000000-0000-0000-0000-000000000000"
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("MEMORIES_STAGING_ORIGIN: invalid");
    expect(result.stdout).toContain("MEMORIES_STAGING_D1_DATABASE_ID: invalid");
  });
});
