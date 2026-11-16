import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";

/**
 * One-time sharing agreement (owner decision 2026-11-16,
 * docs/DECISIONS/2026-11-16-one-time-share-agreement.md). Adults agree once to
 * share with friends and family and, if they choose, in public. The choice is
 * saved with its wording version and is not asked again while that wording
 * stands. Agreeing never makes a memory public by itself: every share is still
 * a deliberate act.
 */
export const shareAgreementVersion = "share-agreement-2026-11-16";
export type ShareAgreement = { familyAndFriends: boolean; public: boolean; version: string };

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });

export async function readShareAgreement(env: { DB: D1Database }, userId: string): Promise<ShareAgreement> {
  const { results } = await env.DB.prepare(
    "SELECT scope FROM share_agreements WHERE user_id=? AND agreement_version=?",
  )
    .bind(userId, shareAgreementVersion)
    .all<{ scope: string }>();
  const scopes = new Set(results.map((row) => row.scope));
  return { familyAndFriends: scopes.has("family_friends"), public: scopes.has("public"), version: shareAgreementVersion };
}

export async function handleShareAgreementRoute(request: Request, env: AuthSessionEnv): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/resources/share-agreement") return null;
  const session = await authenticateAppSession(request, env);
  if (!session) return json({ error: { code: "session_required" } }, 401);
  if (request.method === "GET") return json(await readShareAgreement(env, session.userId));
  if (request.method !== "POST") return json({ error: { code: "method" } }, 405);
  if (request.headers.get("X-Memories-Request") !== "share-v1")
    return json({ error: { code: "share_agreement_invalid" } }, 400);
  const body = (await request.json().catch(() => null)) as Partial<ShareAgreement> | null;
  // Public sharing builds on sharing with friends and family; both are explicit choices.
  if (!body || body.familyAndFriends !== true || typeof body.public !== "boolean" || body.version !== shareAgreementVersion)
    return json({ error: { code: "share_agreement_invalid" } }, 400);
  const now = new Date().toISOString(),
    scopes = body.public ? ["family_friends", "public"] : ["family_friends"];
  await env.DB.batch(
    scopes.map((scope) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO share_agreements(user_id,scope,agreement_version,agreed_at) VALUES(?,?,?,?)",
      ).bind(session.userId, scope, shareAgreementVersion, now),
    ),
  );
  return json(await readShareAgreement(env, session.userId));
}
