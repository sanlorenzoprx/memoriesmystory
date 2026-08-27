/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  handleAuthRoute,
  type AuthRouteEnv,
  type IdentityVerifier
} from "../../worker/auth-routes";
import { handleMediaRoute } from "../../worker/media-routes";

class TestD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    readonly query: string,
    readonly values: readonly SQLInputValue[] = []
  ) {}

  bind(...values: SQLInputValue[]): TestD1Statement {
    return new TestD1Statement(this.database, this.query, values);
  }

  private statement(): StatementSync {
    return this.database.prepare(this.query);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.statement().get(...this.values) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.statement().run(...this.values);
    return { success: true, results: [], meta: {} as D1Result<T>["meta"] };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return {
      success: true,
      results: this.statement().all(...this.values) as T[],
      meta: {} as D1Result<T>["meta"]
    };
  }
}

class TestD1 {
  readonly database = new DatabaseSync(":memory:");

  constructor() {
    for (const migration of ["0001_phase_1_foundation.sql", "0002_account_binding_recovery.sql"]) {
      this.database.exec(readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
    }
  }

  prepare(query: string): TestD1Statement {
    return new TestD1Statement(this.database, query);
  }

  async batch<T>(statements: readonly TestD1Statement[]): Promise<D1Result<T>[]> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results: D1Result<T>[] = [];
      for (const statement of statements) results.push((await statement.run()) as D1Result<T>);
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}

const sessionSecret = "test-session-secret-that-is-longer-than-32-characters";
const draftId = "draft_claim_001";
const draftToken = "draft-secret-token-" + "a".repeat(48);
const identityRequestHeaders = {
  Origin: "https://example.test",
  "X-Memories-Request": "identity-v1"
};

const verifier: IdentityVerifier = async (token) => ({
  issuer: "clerk",
  subject: token,
  email: `${token}@example.test`
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("Set-Cookie");
  if (!setCookie) throw new Error("Session cookie missing");
  return setCookie.split(";", 1)[0] ?? "";
}

async function signIn(env: AuthRouteEnv, identity: string): Promise<{ cookie: string; userId: string }> {
  const response = await handleAuthRoute(
    new Request("https://example.test/resources/auth/session", {
      method: "POST",
      headers: { ...identityRequestHeaders, Authorization: `Bearer ${identity}` }
    }),
    env,
    verifier
  );
  expect(response?.status).toBe(201);
  const body = (await response?.json()) as { account: { userId: string } };
  return { cookie: cookieFrom(response!), userId: body.account.userId };
}

function seedDurableAnonymousDraft(d1: TestD1): void {
  const now = "2026-07-16T00:00:00.000Z";
  d1.database.prepare(
    `INSERT INTO memory_story_drafts (
      id, owner_user_id, anonymous_identity_hash, status, ui_locale,
      created_at, updated_at, expires_at, version
    ) VALUES (?, NULL, ?, 'originals_durable', 'en-US', ?, ?, '9999-12-31T23:59:59.999Z', 3)`
  ).run(draftId, sha256(draftToken), now, now);
  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, role, r2_key, content_type, byte_size, duration_ms,
      sha256, r2_etag, durability_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'durable', ?)`
  ).run("asset_photo_claim", draftId, "original_photo", `drafts/${draftId}/photo`, "image/png", 12, null, "a".repeat(64), "etag-photo", now);
  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, role, r2_key, content_type, byte_size, duration_ms,
      sha256, r2_etag, durability_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'durable', ?)`
  ).run("asset_audio_claim", draftId, "original_audio", `drafts/${draftId}/audio`, "audio/webm", 12, 1200, "b".repeat(64), "etag-audio", now);
}

function claimRequest(cookie: string, token = draftToken): Request {
  return new Request("https://example.test/resources/auth/claim-draft", {
    method: "POST",
    headers: { ...identityRequestHeaders, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      draftId,
      draftToken: token,
      idempotencyKey: `claim_${draftId}`,
      agreementVersion: "account-ownership-v1"
    })
  });
}

describe("Clerk account binding and cross-device recovery", () => {
  let d1: TestD1;
  let env: AuthRouteEnv & { MEDIA_BUCKET: R2Bucket };

  beforeEach(() => {
    d1 = new TestD1();
    env = {
      DB: d1 as unknown as D1Database,
      MEDIA_BUCKET: {} as R2Bucket,
      SESSION_SECRET: sessionSecret
    };
    seedDurableAnonymousDraft(d1);
  });

  it("promotes once, replays safely, and restores the archive in a second session", async () => {
    const firstDevice = await signIn(env, "clerk_alice");
    const firstClaim = await handleAuthRoute(claimRequest(firstDevice.cookie), env, verifier);
    expect(firstClaim?.status).toBe(201);
    const replay = await handleAuthRoute(claimRequest(firstDevice.cookie), env, verifier);
    expect(replay?.status).toBe(200);
    expect((await replay?.json() as { replayed: boolean }).replayed).toBe(true);

    const owner = d1.database.prepare(
      "SELECT owner_user_id, anonymous_identity_hash FROM memory_story_drafts WHERE id = ?"
    ).get(draftId) as { owner_user_id: string; anonymous_identity_hash: string | null };
    expect(owner.owner_user_id).toBe(firstDevice.userId);
    expect(owner.anonymous_identity_hash).toBeNull();
    expect(d1.database.prepare("SELECT count(*) AS count FROM draft_ownership_claims").get()).toEqual({ count: 1 });

    const secondDevice = await signIn(env, "clerk_alice");
    const recovered = await handleAuthRoute(
      new Request(`https://example.test/resources/archive/drafts/${draftId}`, {
        headers: { Cookie: secondDevice.cookie }
      }),
      env,
      verifier
    );
    expect(recovered?.status).toBe(200);
    const recoveredBody = (await recovered?.json()) as { assets: Array<{ role: string }> };
    expect(recoveredBody.assets.map((asset) => asset.role).sort()).toEqual(["original_audio", "original_photo"]);

    const mediaStatus = await handleMediaRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/media-status`, {
        headers: { Cookie: secondDevice.cookie }
      }),
      env
    );
    expect(mediaStatus?.status).toBe(200);
    expect((await mediaStatus?.json() as { originalsDurable: boolean }).originalsDurable).toBe(true);
  });

  it("rejects a wrong local key, cross-account claim, and cross-account archive read", async () => {
    const alice = await signIn(env, "clerk_alice");
    expect((await handleAuthRoute(claimRequest(alice.cookie, "wrong-" + "x".repeat(48)), env, verifier))?.status).toBe(403);
    expect((await handleAuthRoute(claimRequest(alice.cookie), env, verifier))?.status).toBe(201);

    const bob = await signIn(env, "clerk_bob");
    expect((await handleAuthRoute(claimRequest(bob.cookie), env, verifier))?.status).toBe(409);
    expect((await handleAuthRoute(
      new Request(`https://example.test/resources/archive/drafts/${draftId}`, { headers: { Cookie: bob.cookie } }),
      env,
      verifier
    ))?.status).toBe(404);
  });

  it("fails closed on missing CSRF evidence and pre-durable claims", async () => {
    const alice = await signIn(env, "clerk_alice");
    const missingCsrf = new Request("https://example.test/resources/auth/claim-draft", {
      method: "POST",
      headers: { Cookie: alice.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, draftToken, idempotencyKey: `claim_${draftId}` })
    });
    expect((await handleAuthRoute(missingCsrf, env, verifier))?.status).toBe(403);
    d1.database.prepare("UPDATE memory_story_drafts SET status = 'needs_connection' WHERE id = ?").run(draftId);
    const notDurable = await handleAuthRoute(claimRequest(alice.cookie), env, verifier);
    expect(notDurable?.status).toBe(409);
    expect((await notDurable?.json() as { error: { code: string } }).error.code).toBe("originals_not_durable");
  });

  it("revokes the application session on sign-out", async () => {
    const alice = await signIn(env, "clerk_alice");
    const signedOut = await handleAuthRoute(
      new Request("https://example.test/resources/auth/sign-out", {
        method: "POST",
        headers: { ...identityRequestHeaders, Cookie: alice.cookie }
      }),
      env,
      verifier
    );
    expect(signedOut?.status).toBe(200);
    expect(signedOut?.headers.get("Set-Cookie")).toContain("Max-Age=0");
    const after = await handleAuthRoute(
      new Request("https://example.test/resources/archive/drafts", {
        headers: { Cookie: alice.cookie }
      }),
      env,
      verifier
    );
    expect(after?.status).toBe(401);
  });
});
