/**
 * Request-rate limits (review finding F3, launch lane L7.3).
 *
 * Three Workers Rate Limiting bindings, keyed by class and client address:
 * - `public`: routes reachable without an account (share pages, sign-in,
 *   discovery), so a share link or sign-in cannot be hammered;
 * - `costly`: requests that spend model or call budget (Muse, transcription,
 *   speech, scans, calls);
 * - `writes`: every other state-changing `/resources/` request.
 *
 * Limits are approximate and per Cloudflare location. They protect against
 * abuse, not ordinary families: the thresholds are well above what one
 * household does in a minute. A missing binding or a limiter error lets the
 * request through, because a person preserving a memory must never be stopped
 * by a counter outage. The client address is used only as the counter key and
 * is never stored.
 */
export type RequestRateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export interface RateLimitEnv {
  REQUEST_LIMIT_PUBLIC?: RequestRateLimiter;
  REQUEST_LIMIT_COSTLY?: RequestRateLimiter;
  REQUEST_LIMIT_WRITES?: RequestRateLimiter;
}

export type RateLimitClass = "public" | "costly" | "writes";

const readOnly = new Set(["GET", "HEAD", "OPTIONS"]);
const costlyPath =
  /^\/resources\/(?:drafts\/[^/]+\/(?:muse|muse-tts|muse-conversation|muse-voice-replies(?:\/[^/]+)?|process|scans)|legacy-sessions\/[^/]+\/call)$/;
const publicPath =
  /^\/(?:shared\/[^/]+(?:\/(?:photo|voice))?|mcp|api\/v1\/[^/]+|resources\/auth\/session|resources\/email\/unsubscribe)$/;

/** Which limit applies to a request, or null when none does. */
export function rateLimitClass(request: Request): RateLimitClass | null {
  const { pathname } = new URL(request.url),
    writing = !readOnly.has(request.method);
  if (writing && costlyPath.test(pathname)) return "costly";
  if (publicPath.test(pathname)) return "public";
  if (writing && pathname.startsWith("/resources/")) return "writes";
  return null;
}

const bindingFor = {
  public: "REQUEST_LIMIT_PUBLIC",
  costly: "REQUEST_LIMIT_COSTLY",
  writes: "REQUEST_LIMIT_WRITES",
} as const satisfies Record<RateLimitClass, keyof RateLimitEnv>;

/** A 429 response when the request is over its limit; otherwise null. */
export async function enforceRateLimit(
  request: Request,
  env: RateLimitEnv,
): Promise<Response | null> {
  const kind = rateLimitClass(request);
  if (!kind) return null;
  const limiter = env[bindingFor[kind]];
  if (!limiter) return null;
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    const { success } = await limiter.limit({ key: `${kind}:${address}` });
    if (success) return null;
  } catch {
    return null;
  }
  return Response.json(
    { error: { code: "rate_limited" } },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Retry-After": "60",
      },
    },
  );
}
