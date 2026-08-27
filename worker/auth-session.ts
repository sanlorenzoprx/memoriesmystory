import { phase1Config } from "../config/phase-1";

export type AuthSessionEnv = {
  readonly DB: D1Database;
  readonly SESSION_SECRET?: string;
};

export type AppSession = {
  readonly sessionId: string;
  readonly userId: string;
  readonly expiresAt: string;
};

export const sessionCookieName = "memories_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * phase1Config.auth.sessionLifetimeDays;

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Text(value: string): Promise<string> {
  return bytesToHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
}

function cookies(request: Request): Map<string, string> {
  return new Map(
    (request.headers.get("Cookie") ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator < 0
          ? [part, ""]
          : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      })
  );
}

export async function authenticateAppSession(
  request: Request,
  env: AuthSessionEnv
): Promise<AppSession | null> {
  const token = cookies(request).get(sessionCookieName);
  if (!token || token.length < 32 || token.length > 256 || !env.SESSION_SECRET) return null;

  const tokenHash = await sha256Text(`${env.SESSION_SECRET}:${token}`);
  const now = new Date().toISOString();
  return env.DB.prepare(
    `SELECT id AS sessionId, user_id AS userId, expires_at AS expiresAt
     FROM user_sessions
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`
  )
    .bind(tokenHash, now)
    .first<AppSession>();
}

export async function createAppSession(
  env: AuthSessionEnv,
  userId: string
): Promise<{ readonly session: AppSession; readonly cookie: string }> {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  const now = new Date();
  const expires = new Date(now.getTime() + sessionLifetimeSeconds * 1000);
  const sessionId = `session_${crypto.randomUUID()}`;
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  await env.DB.prepare(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at, revoked_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  )
    .bind(sessionId, userId, await sha256Text(`${env.SESSION_SECRET}:${token}`), expires.toISOString(), now.toISOString())
    .run();

  return {
    session: { sessionId, userId, expiresAt: expires.toISOString() },
    cookie: `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionLifetimeSeconds}`
  };
}

export function expiredSessionCookie(): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
