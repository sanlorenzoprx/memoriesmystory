import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import handler from "../../worker/index";
import type { Env } from "../../worker/index";
import { enforceRateLimit, rateLimitClass, type RequestRateLimiter } from "../../worker/rate-limit";

const request = (path: string, method = "GET", ip = "203.0.113.9") =>
  new Request(`https://example.test${path}`, { method, headers: { "CF-Connecting-IP": ip } });

function limiter(allowed: number) {
  const keys: string[] = [];
  const binding: RequestRateLimiter = {
    limit: async ({ key }) => {
      keys.push(key);
      return { success: keys.filter((entry) => entry === key).length <= allowed };
    },
  };
  return { binding, keys };
}

describe("request-rate limits (review finding F3)", () => {
  it("classifies routes by what they cost and who can reach them", () => {
    expect(rateLimitClass(request("/resources/drafts/draft_12345678/muse", "POST"))).toBe("costly");
    expect(rateLimitClass(request("/resources/drafts/draft_12345678/muse-conversation", "POST"))).toBe("costly");
    expect(rateLimitClass(request("/resources/drafts/draft_12345678/process", "POST"))).toBe("costly");
    expect(rateLimitClass(request("/resources/legacy-sessions/session_1234/call", "POST"))).toBe("costly");
    expect(rateLimitClass(request("/shared/a-share-token"))).toBe("public");
    expect(rateLimitClass(request("/shared/a-share-token/voice"))).toBe("public");
    expect(rateLimitClass(request("/resources/auth/session", "POST"))).toBe("public");
    expect(rateLimitClass(request("/mcp", "POST"))).toBe("public");
    expect(rateLimitClass(request("/resources/family-people", "POST"))).toBe("writes");
    // Reading one's own archive, the health check and the app shell are never counted.
    expect(rateLimitClass(request("/resources/archive/drafts"))).toBeNull();
    expect(rateLimitClass(request("/resources/drafts/draft_12345678/muse"))).toBeNull();
    expect(rateLimitClass(request("/health"))).toBeNull();
    expect(rateLimitClass(request("/archive"))).toBeNull();
  });

  it("answers over-limit requests with a stable code and a retry hint, keyed per class and address", async () => {
    const writes = limiter(1),
      env = { REQUEST_LIMIT_WRITES: writes.binding };
    expect(await enforceRateLimit(request("/resources/family-people", "POST"), env)).toBeNull();
    const refused = (await enforceRateLimit(request("/resources/family-people", "PATCH"), env))!;
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("60");
    expect(refused.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await refused.json()).toEqual({ error: { code: "rate_limited" } });
    // Another household's address has its own counter.
    expect(await enforceRateLimit(request("/resources/family-people", "POST", "198.51.100.4"), env)).toBeNull();
    expect(writes.keys).toEqual(["writes:203.0.113.9", "writes:203.0.113.9", "writes:198.51.100.4"]);
  });

  it("lets requests through when the limiter is missing or fails, so a memory is never blocked by a counter outage", async () => {
    expect(await enforceRateLimit(request("/resources/family-people", "POST"), {})).toBeNull();
    const broken: RequestRateLimiter = { limit: async () => { throw new Error("limiter down"); } };
    expect(await enforceRateLimit(request("/resources/family-people", "POST"), { REQUEST_LIMIT_WRITES: broken })).toBeNull();
  });

  it("is applied by the Worker before any route runs", async () => {
    const env = {
      REQUEST_LIMIT_PUBLIC: limiter(0).binding,
      ASSETS: { fetch: () => { throw new Error("must not be reached"); } },
    } as unknown as Env;
    const response = await handler.fetch!(
      request("/shared/a-share-token") as Parameters<NonNullable<typeof handler.fetch>>[0],
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(429);
  });

  it("declares all three limiter bindings with periods Cloudflare accepts", () => {
    const config = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
    for (const name of ["REQUEST_LIMIT_PUBLIC", "REQUEST_LIMIT_COSTLY", "REQUEST_LIMIT_WRITES"])
      expect(config).toMatch(new RegExp(`"name": "${name}", "namespace_id": "\\d+", "simple": \\{ "limit": \\d+, "period": (10|60) \\}`));
  });
});
