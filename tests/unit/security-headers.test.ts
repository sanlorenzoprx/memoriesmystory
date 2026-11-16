import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import handler from "../../worker/index";
import type { Env } from "../../worker/index";

describe("baseline security headers (review findings F2 and F9)", () => {
  it("serves the application shell with protective headers and a report-only content policy", () => {
    const rules = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");
    const block = rules.slice(rules.indexOf("/*"));
    for (const line of [
      "X-Content-Type-Options: nosniff",
      "Referrer-Policy: strict-origin-when-cross-origin",
      "X-Frame-Options: DENY",
      "Strict-Transport-Security: max-age=31536000",
      "Permissions-Policy: camera=(self), microphone=(self), geolocation=()",
      "Content-Security-Policy-Report-Only: default-src 'self'",
    ])
      expect(block).toContain(line);
    // The policy stays report-only until staging shows every origin it must allow.
    expect(block).not.toMatch(/^\s*Content-Security-Policy:/m);
    expect(block).toContain("frame-ancestors 'none'");
    expect(block).toContain("object-src 'none'");
  });

  it("answers an unexpected failure with a stable code and nothing private", async () => {
    const env = {
      ASSETS: {
        fetch: () => {
          throw new Error("private stack detail: /home/user/secret");
        },
      },
    } as unknown as Env;
    const response = await handler.fetch!(
      new Request("https://example.test/a-page-served-by-assets") as Parameters<NonNullable<typeof handler.fetch>>[0],
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "unavailable" } });
    expect(text).not.toContain("secret");
  });
});
