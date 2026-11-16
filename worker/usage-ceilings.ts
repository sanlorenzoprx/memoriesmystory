import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import { phase1Config } from "../config/phase-1";

/**
 * Per-account daily ceilings (lanes L5.4 and L7). Only operations that spend
 * model or call budget are counted; uploads, saves and reads never are. The
 * ceilings sit far above what one person does in a day. A request without a
 * session, or a counter error, is left to the per-address rate limits.
 */
export type CeilingOperation = keyof typeof phase1Config.dailyCeilings;

const operationPath =
  /^\/resources\/(?:drafts\/[^/]+\/(muse|muse-tts|muse-conversation|muse-voice-replies(?:\/[^/]+)?|process|scans)|legacy-sessions\/[^/]+\/(call))$/;

export function ceilingOperation(request: Request): CeilingOperation | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const match = operationPath.exec(new URL(request.url).pathname);
  if (!match) return null;
  const segment = match[1] ?? match[2]!;
  if (segment === "muse") return "muse";
  if (segment === "muse-tts") return "muse_speech";
  if (segment === "muse-conversation") return "muse_conversation";
  if (segment.startsWith("muse-voice-replies")) return "voice_reply";
  if (segment === "process") return "transcription";
  if (segment === "scans") return "scan";
  return "call";
}

export async function enforceDailyCeiling(request: Request, env: AuthSessionEnv): Promise<Response | null> {
  const operation = ceilingOperation(request);
  if (!operation) return null;
  const session = await authenticateAppSession(request, env).catch(() => null);
  if (!session) return null;
  const ceiling = phase1Config.dailyCeilings[operation],
    day = new Date().toISOString().slice(0, 10);
  try {
    // Raised only while under the ceiling, in one statement, so concurrent requests cannot overshoot.
    const row = await env.DB.prepare(
      `INSERT INTO account_daily_usage(user_id,day,operation,count) VALUES(?1,?2,?3,1)
       ON CONFLICT(user_id,day,operation) DO UPDATE SET count=count+1 WHERE count<?4
       RETURNING count`,
    )
      .bind(session.userId, day, operation, ceiling)
      .first<{ count: number }>();
    if (row) return null;
  } catch {
    return null;
  }
  return Response.json(
    { error: { code: "daily_limit_reached" } },
    {
      status: 429,
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Retry-After": "3600" },
    },
  );
}
