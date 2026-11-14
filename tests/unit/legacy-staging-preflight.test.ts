import { execFileSync } from "node:child_process";
import { describe, expect, it, vi, afterEach } from "vitest";
// Script is deliberately dependency-free and shared with the operator CLI.
// @ts-expect-error The operator .mjs file has no TypeScript declaration.
import { legacyStagingPreflight } from "../../scripts/preflight-legacy-staging.mjs";
const synthetic = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_API_TOKEN: "TOKEN_CANARY_DO_NOT_PRINT_".repeat(2),
  CLERK_SECRET_KEY: "sk_test_SECRET_CANARY_DO_NOT_PRINT",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_SYNTHETIC_PUBLISHABLE",
  REALTIME_SFU_APP_ID: "synthetic_sfu_app_001",
  REALTIME_SFU_APP_SECRET: "SFU_CANARY_DO_NOT_PRINT_".repeat(2),
  SESSION_SECRET: "SESSION_CANARY_DO_NOT_PRINT_".repeat(2),
  MEMORIES_STAGING_ORIGIN: "https://memoriesmystory-staging.example.test",
};
afterEach(() => vi.unstubAllGlobals());
describe("remote Legacy staging preflight", () => {
  it("blocks missing bootstrap credentials and never calls a provider", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(legacyStagingPreflight({})).toMatchObject({
      status: "blocked_credentials",
      shapeReady: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("distinguishes restorable configuration from access and rejects live identity keys or unsafe origins", () => {
    expect(
      legacyStagingPreflight({ ...synthetic, REALTIME_SFU_APP_SECRET: "" }),
    ).toMatchObject({ status: "blocked_configuration", shapeReady: false });
    for (const override of [
      { CLERK_SECRET_KEY: "sk_live_UNAPPROVED_PRODUCTION_INSTANCE" },
      { VITE_CLERK_PUBLISHABLE_KEY: "pk_live_UNAPPROVED_PRODUCTION_INSTANCE" },
      { MEMORIES_STAGING_ORIGIN: "http://staging.example.test" },
      { MEMORIES_STAGING_ORIGIN: "https://user:password@staging.example.test" },
      { MEMORIES_STAGING_ORIGIN: "https://staging.example.test/path" },
    ])
      expect(
        legacyStagingPreflight({ ...synthetic, ...override }).shapeReady,
      ).toBe(false);
  });
  it("reports only configuration shape and keeps all values out of CLI output", () => {
    expect(legacyStagingPreflight(synthetic)).toMatchObject({
      status: "shape_ready_live_proof_pending",
      shapeReady: true,
    });
    const output = execFileSync(
      process.execPath,
      ["scripts/preflight-legacy-staging.mjs"],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...synthetic },
        encoding: "utf8",
      },
    );
    expect(output).toContain("shape_ready_live_proof_pending");
    for (const value of Object.values(synthetic))
      expect(output).not.toContain(value);
    expect(output).toContain("No network request");
  });
});
