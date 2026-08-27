import { verifyToken } from "@clerk/backend";

import { phase1Config } from "../config/phase-1";
import {
  authenticateAppSession,
  createAppSession,
  expiredSessionCookie,
  sha256Text,
  type AppSession,
  type AuthSessionEnv
} from "./auth-session";

export type AuthRouteEnv = AuthSessionEnv & {
  readonly CLERK_SECRET_KEY?: string;
  readonly CLERK_JWT_KEY?: string;
  readonly CLERK_AUTHORIZED_PARTIES?: string;
};

export type VerifiedIdentity = {
  readonly issuer: "clerk";
  readonly subject: string;
  readonly email: string | null;
};

export type IdentityVerifier = (
  token: string,
  env: AuthRouteEnv
) => Promise<VerifiedIdentity>;

type DraftClaimBody = {
  draftId?: unknown;
  draftToken?: unknown;
  idempotencyKey?: unknown;
  agreementVersion?: unknown;
};

type DraftRow = {
  id: string;
  owner_user_id: string | null;
  anonymous_identity_hash: string | null;
  status: string;
};

type ClaimRow = {
  draft_id: string;
  user_id: string;
  idempotency_key: string;
  correlation_id: string;
  claimed_at: string;
};

type ArchiveDraftRow = {
  id: string;
  status: string;
  ui_locale: string;
  created_at: string;
  updated_at: string;
};

type ArchiveAssetRow = {
  id: string;
  draft_id: string;
  role: "original_photo" | "original_audio";
  content_type: string;
  byte_size: number;
  duration_ms: number | null;
  sha256: string;
  created_at: string;
};

class AuthRouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

const identifierPattern = /^[A-Za-z0-9_-]{8,120}$/;
const identityRequestHeader = "identity-v1";

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...Object.fromEntries(new Headers(headers))
    }
  });
}

function assertMutationRequest(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== identityRequestHeader) {
    throw new AuthRouteError(403, "The identity request could not be verified.", "csrf");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AuthRouteError(403, "The identity origin is not allowed.", "origin");
  }
}

function validIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    throw new AuthRouteError(400, `${label} is invalid.`, "invalid_identifier");
  }
  return value;
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export const verifyClerkIdentity: IdentityVerifier = async (token, env) => {
  if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) {
    throw new AuthRouteError(503, "Identity is not configured in this environment.", "identity_unconfigured");
  }
  const authorizedParties = env.CLERK_AUTHORIZED_PARTIES
    ?.split(",")
    .map((party) => party.trim())
    .filter(Boolean);
  if (!authorizedParties?.length) {
    throw new AuthRouteError(503, "Identity origins are not configured in this environment.", "identity_origin_unconfigured");
  }
  const payload = await verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY,
    jwtKey: env.CLERK_JWT_KEY,
    authorizedParties
  });
  if (!payload.sub) {
    throw new AuthRouteError(401, "The identity token is invalid.", "invalid_identity");
  }
  const emailClaim = payload.email;
  return {
    issuer: "clerk",
    subject: payload.sub,
    email: typeof emailClaim === "string" ? emailClaim : null
  };
};

async function internalUserForIdentity(
  env: AuthRouteEnv,
  identity: VerifiedIdentity
): Promise<string> {
  const existing = await env.DB.prepare(
    "SELECT user_id FROM auth_principals WHERE issuer = ? AND subject = ?"
  )
    .bind(identity.issuer, identity.subject)
    .first<{ user_id: string }>();
  if (existing) return existing.user_id;

  const now = new Date().toISOString();
  const userId = `user_${crypto.randomUUID()}`;
  const principalId = `principal_${crypto.randomUUID()}`;
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
      ).bind(userId, identity.email, now, now),
      env.DB.prepare(
        `INSERT INTO auth_principals (id, user_id, issuer, subject, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(principalId, userId, identity.issuer, identity.subject, now, now)
    ]);
    return userId;
  } catch {
    const winner = await env.DB.prepare(
      "SELECT user_id FROM auth_principals WHERE issuer = ? AND subject = ?"
    )
      .bind(identity.issuer, identity.subject)
      .first<{ user_id: string }>();
    if (!winner) throw new AuthRouteError(500, "The account could not be prepared.", "identity_binding");
    return winner.user_id;
  }
}

async function exchangeClerkSession(
  request: Request,
  env: AuthRouteEnv,
  verifier: IdentityVerifier
): Promise<Response> {
  assertMutationRequest(request);
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new AuthRouteError(401, "Sign in is required.", "missing_identity");
  }
  let identity: VerifiedIdentity;
  try {
    identity = await verifier(match[1], env);
  } catch (error) {
    if (error instanceof AuthRouteError) throw error;
    throw new AuthRouteError(401, "The identity token is invalid or expired.", "invalid_identity");
  }
  const userId = await internalUserForIdentity(env, identity);
  const currentSession = await authenticateAppSession(request, env);
  if (currentSession?.userId === userId) {
    return json({
      ok: true,
      account: { userId },
      session: { expiresAt: currentSession.expiresAt }
    });
  }
  if (currentSession) {
    await env.DB.prepare(
      "UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL"
    ).bind(new Date().toISOString(), currentSession.sessionId).run();
  }
  const created = await createAppSession(env, userId);
  return json(
    { ok: true, account: { userId }, session: { expiresAt: created.session.expiresAt } },
    201,
    { "Set-Cookie": created.cookie }
  );
}

async function requireSession(request: Request, env: AuthRouteEnv): Promise<AppSession> {
  const session = await authenticateAppSession(request, env);
  if (!session) throw new AuthRouteError(401, "Sign in is required.", "session_required");
  return session;
}

async function claimDraft(request: Request, env: AuthRouteEnv): Promise<Response> {
  assertMutationRequest(request);
  const session = await requireSession(request, env);
  const body = (await request.json().catch(() => null)) as DraftClaimBody | null;
  if (!body) throw new AuthRouteError(400, "The claim request is invalid.", "invalid_body");
  const draftId = validIdentifier(body.draftId, "Draft ID");
  const idempotencyKey = validIdentifier(body.idempotencyKey, "Idempotency key");
  if (typeof body.draftToken !== "string" || body.draftToken.length < 32 || body.draftToken.length > 256) {
    throw new AuthRouteError(403, "The local draft could not be verified.", "draft_token");
  }
  const agreementVersion = body.agreementVersion === undefined
    ? phase1Config.auth.accountOwnershipAgreementVersion
    : validIdentifier(body.agreementVersion, "Agreement version");
  if (agreementVersion !== phase1Config.auth.accountOwnershipAgreementVersion) {
    throw new AuthRouteError(409, "The account agreement changed. Review it before continuing.", "agreement_version");
  }

  const existingClaim = await env.DB.prepare(
    `SELECT draft_id, user_id, idempotency_key, correlation_id, claimed_at
     FROM draft_ownership_claims WHERE draft_id = ?`
  ).bind(draftId).first<ClaimRow>();
  if (existingClaim) {
    if (existingClaim.user_id !== session.userId) {
      throw new AuthRouteError(409, "That Memory Story belongs to another account.", "already_claimed");
    }
    return json({ ok: true, claimed: true, replayed: true, draftId, correlationId: existingClaim.correlation_id });
  }

  const tokenHash = await sha256Text(body.draftToken);
  const draft = await env.DB.prepare(
    `SELECT id, owner_user_id, anonymous_identity_hash, status
     FROM memory_story_drafts WHERE id = ?`
  ).bind(draftId).first<DraftRow>();
  if (!draft) throw new AuthRouteError(404, "That local draft was not found.", "draft_not_found");
  if (draft.owner_user_id && draft.owner_user_id !== session.userId) {
    throw new AuthRouteError(409, "That Memory Story belongs to another account.", "already_claimed");
  }
  if (!draft.anonymous_identity_hash || !safeEqual(draft.anonymous_identity_hash, tokenHash)) {
    throw new AuthRouteError(403, "The local draft could not be verified.", "draft_scope");
  }
  if (draft.status !== "originals_durable") {
    throw new AuthRouteError(409, "Finish preserving the photograph and voice before sign-in.", "originals_not_durable");
  }
  const assets = await env.DB.prepare(
    `SELECT role FROM media_assets
     WHERE draft_id = ? AND durability_status = 'durable'
       AND role IN ('original_photo', 'original_audio')`
  ).bind(draftId).all<{ role: string }>();
  if (!assets.results.some((asset) => asset.role === "original_photo") ||
      !assets.results.some((asset) => asset.role === "original_audio")) {
    throw new AuthRouteError(409, "Finish preserving the photograph and voice before sign-in.", "originals_not_durable");
  }

  const now = new Date().toISOString();
  const correlationId = `claim_${crypto.randomUUID()}`;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE memory_story_drafts
         SET owner_user_id = ?, anonymous_identity_hash = NULL, updated_at = ?, version = version + 1
         WHERE id = ? AND owner_user_id IS NULL AND anonymous_identity_hash = ? AND status = 'originals_durable'`
      ).bind(session.userId, now, draftId, tokenHash),
      env.DB.prepare(
        `INSERT INTO draft_ownership_claims (
          draft_id, user_id, anonymous_identity_hash, idempotency_key, correlation_id, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(draftId, session.userId, tokenHash, idempotencyKey, correlationId, now),
      env.DB.prepare(
        "UPDATE media_assets SET created_by_user_id = ? WHERE draft_id = ? AND created_by_user_id IS NULL"
      ).bind(session.userId, draftId),
      env.DB.prepare(
        `INSERT OR IGNORE INTO story_entitlements (
          user_id, plan, free_story_limit, free_stories_unlocked,
          free_stories_completed, paid_story_capacity, updated_at
        ) VALUES (?, 'free', ?, ?, 0, 0, ?)`
      ).bind(
        session.userId,
        phase1Config.entitlements.freeStoryLimit,
        phase1Config.entitlements.initiallyUnlockedStories,
        now
      ),
      env.DB.prepare(
        `INSERT OR IGNORE INTO agreement_acceptances (
          id, user_id, draft_id, agreement_kind, agreement_version, context, accepted_at
        ) VALUES (?, ?, ?, 'account_ownership', ?, 'anonymous_draft_promotion', ?)`
      ).bind(`agreement_${crypto.randomUUID()}`, session.userId, draftId, agreementVersion, now)
    ]);
  } catch {
    const winner = await env.DB.prepare(
      `SELECT draft_id, user_id, idempotency_key, correlation_id, claimed_at
       FROM draft_ownership_claims WHERE draft_id = ?`
    ).bind(draftId).first<ClaimRow>();
    if (winner?.user_id === session.userId) {
      return json({ ok: true, claimed: true, replayed: true, draftId, correlationId: winner.correlation_id });
    }
    if (winner) throw new AuthRouteError(409, "That Memory Story belongs to another account.", "already_claimed");
    throw new AuthRouteError(409, "The Memory Story changed while it was being protected. Retry safely.", "claim_conflict");
  }

  return json({ ok: true, claimed: true, replayed: false, draftId, correlationId }, 201);
}

async function signOut(request: Request, env: AuthRouteEnv): Promise<Response> {
  assertMutationRequest(request);
  const session = await authenticateAppSession(request, env);
  if (session) {
    await env.DB.prepare("UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
      .bind(new Date().toISOString(), session.sessionId)
      .run();
  }
  return json({ ok: true }, 200, { "Set-Cookie": expiredSessionCookie() });
}

async function archive(request: Request, env: AuthRouteEnv, draftId?: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (draftId) {
    validIdentifier(draftId, "Draft ID");
    const draft = await env.DB.prepare(
      `SELECT id, status, ui_locale, created_at, updated_at
       FROM memory_story_drafts WHERE id = ? AND owner_user_id = ?`
    ).bind(draftId, session.userId).first<ArchiveDraftRow>();
    if (!draft) throw new AuthRouteError(404, "That Memory Story was not found in this archive.", "not_found");
    const assets = await env.DB.prepare(
      `SELECT id, draft_id, role, content_type, byte_size, duration_ms, sha256, created_at
       FROM media_assets WHERE draft_id = ? AND durability_status = 'durable'
         AND role IN ('original_photo', 'original_audio') ORDER BY created_at`
    ).bind(draftId).all<ArchiveAssetRow>();
    return json({ ok: true, draft, assets: assets.results.map(archiveAsset) });
  }
  const drafts = await env.DB.prepare(
    `SELECT id, status, ui_locale, created_at, updated_at
     FROM memory_story_drafts WHERE owner_user_id = ? ORDER BY updated_at DESC`
  ).bind(session.userId).all<ArchiveDraftRow>();
  return json({ ok: true, drafts: drafts.results });
}

function archiveAsset(asset: ArchiveAssetRow) {
  return {
    assetId: asset.id,
    draftId: asset.draft_id,
    role: asset.role,
    contentType: asset.content_type,
    byteSize: asset.byte_size,
    durationMs: asset.duration_ms,
    sha256: asset.sha256,
    createdAt: asset.created_at,
    mediaUrl: `/resources/drafts/${encodeURIComponent(asset.draft_id)}/media/${encodeURIComponent(asset.id)}`
  };
}

export async function handleAuthRoute(
  request: Request,
  env: AuthRouteEnv,
  verifier: IdentityVerifier = verifyClerkIdentity
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const archiveMatch = pathname.match(/^\/resources\/archive\/drafts\/([^/]+)$/);
  const isKnown = pathname.startsWith("/resources/auth/") ||
    pathname === "/resources/archive/drafts" || Boolean(archiveMatch);
  if (!isKnown) return null;
  try {
    if (pathname === "/resources/auth/session" && request.method === "POST") {
      return await exchangeClerkSession(request, env, verifier);
    }
    if (pathname === "/resources/auth/claim-draft" && request.method === "POST") {
      return await claimDraft(request, env);
    }
    if (pathname === "/resources/auth/sign-out" && request.method === "POST") {
      return await signOut(request, env);
    }
    if (pathname === "/resources/auth/me" && request.method === "GET") {
      const session = await requireSession(request, env);
      return json({ ok: true, account: { userId: session.userId }, session: { expiresAt: session.expiresAt } });
    }
    if (pathname === "/resources/archive/drafts" && request.method === "GET") {
      return await archive(request, env);
    }
    if (archiveMatch?.[1] && request.method === "GET") {
      return await archive(request, env, decodeURIComponent(archiveMatch[1]));
    }
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    const routeError = error instanceof AuthRouteError
      ? error
      : new AuthRouteError(500, "The account request could not be completed.", "internal");
    return json({ ok: false, error: { code: routeError.code, message: routeError.message } }, routeError.status);
  }
}
