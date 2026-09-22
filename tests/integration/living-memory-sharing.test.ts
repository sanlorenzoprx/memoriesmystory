/// <reference types="@cloudflare/workers-types" />

import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createAppSession } from "../../worker/auth-session";
import { handleSharingRoute, type SharingEnv } from "../../worker/sharing";

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
    for (const migration of [
      "0001_phase_1_foundation.sql",
      "0002_account_binding_recovery.sql",
      "0003_living_memory_proof.sql",
      "0004_configurable_story_entitlements.sql"
    ]) {
      this.database.exec(
        readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8")
      );
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
}

class TestR2 {
  async get(key: string): Promise<R2ObjectBody | null> {
    const isPhoto = key.endsWith("/photo");
    const isAudio = key.endsWith("/audio");
    if (!isPhoto && !isAudio) return null;

    const bytes = isPhoto
      ? Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])
      : Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]);

    return {
      body: new Blob([bytes]).stream(),
      size: bytes.byteLength,
      httpEtag: isPhoto ? '"photo-etag"' : '"audio-etag"',
      range: undefined,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    } as unknown as R2ObjectBody;
  }
}

const userId = "user_share_001";
const storyId = "draft_share_001";
const photoId = "asset_photo_share";
const audioId = "asset_audio_share";
const transcriptId = "transcript_share_001";
const now = "2026-09-22T12:00:00.000Z";
const sessionSecret = "sharing-test-session-secret-that-is-long-enough";
const sharePepper = "sharing-test-pepper-that-is-at-least-thirty-two-characters";

function seedCompletedLivingMemory(d1: TestD1): void {
  d1.database.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(userId, "private-owner@example.test", now, now);

  d1.database.prepare(
    `INSERT INTO memory_story_drafts (
      id, owner_user_id, anonymous_identity_hash, status, ui_locale, spoken_locale,
      created_at, updated_at, expires_at, version
    ) VALUES (?, ?, NULL, 'review_ready', 'en-US', 'en-US', ?, ?, '9999-12-31T23:59:59.999Z', 1)`
  ).run(storyId, userId, now, now);

  d1.database.prepare(
    `INSERT INTO story_entitlements (
      user_id, plan, free_story_limit, free_stories_unlocked,
      free_stories_completed, paid_story_capacity, updated_at
    ) VALUES (?, 'free', 1, 1, 0, 0, ?)`
  ).run(userId, now);

  d1.database.prepare(
    `INSERT INTO memory_stories (
      id, owner_user_id, status, visibility, primary_photo_asset_id,
      primary_audio_asset_id, current_transcript_revision_id,
      current_muse_description_id, created_at, completed_at, updated_at, version
    ) VALUES (?, ?, 'draft', 'private', ?, ?, NULL, NULL, ?, NULL, ?, 1)`
  ).run(storyId, userId, photoId, audioId, now, now);

  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
      byte_size, duration_ms, sha256, r2_etag, durability_status, created_by_user_id, created_at
    ) VALUES (?, ?, ?, 'original_photo', NULL, ?, 'image/jpeg', 4, NULL, ?, 'photo-etag', 'durable', ?, ?)`
  ).run(photoId, storyId, storyId, `drafts/${storyId}/photo`, "a".repeat(64), userId, now);

  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
      byte_size, duration_ms, sha256, r2_etag, durability_status, created_by_user_id, created_at
    ) VALUES (?, ?, ?, 'original_audio', NULL, ?, 'audio/webm', 4, 1200, ?, 'audio-etag', 'durable', ?, ?)`
  ).run(audioId, storyId, storyId, `drafts/${storyId}/audio`, "b".repeat(64), userId, now);

  d1.database.prepare(
    `INSERT INTO transcript_revisions (
      id, memory_story_id, source_audio_asset_id, parent_revision_id,
      revision_kind, text, locale, created_by_type, created_by_user_id,
      model_config_version, created_at
    ) VALUES (?, ?, ?, NULL, 'machine_transcript', ?, 'en', 'machine', NULL, 'test-model', ?)`
  ).run(
    transcriptId,
    storyId,
    audioId,
    "PRIVATE TRANSCRIPT: Uncle Luis owed money and nobody outside the archive should see this.",
    now
  );

  d1.database.prepare(
    "UPDATE memory_stories SET current_transcript_revision_id = ? WHERE id = ?"
  ).run(transcriptId, storyId);

  d1.database.prepare(
    `INSERT INTO living_memory_context_entries (
      id, memory_story_id, kind, value, context_state, source_type,
      source_ref, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, 'person', ?, 'stated', 'storyteller', NULL, ?, ?, ?)`
  ).run("context_private_person", storyId, "PRIVATE CONTEXT: Cousin Elena", userId, now, now);

  d1.database.prepare(
    `UPDATE memory_stories
     SET status = 'complete', completed_at = ?, updated_at = ?, version = version + 1
     WHERE id = ?`
  ).run(now, now, storyId);

  d1.database.prepare(
    "UPDATE memory_story_drafts SET status = 'complete', updated_at = ? WHERE id = ?"
  ).run(now, storyId);
}
function cookieHeader(cookie: string): string {
  return cookie.split(";", 1)[0] ?? cookie;
}

function ownerRequest(
  path: string,
  cookie: string,
  method: "POST" | "DELETE",
  body?: Record<string, unknown>,
  idempotencyKey?: string
): Request {
  const headers = new Headers({
    Cookie: cookie,
    Origin: "https://example.test",
    "X-Memories-Request": "share-v1"
  });
  if (idempotencyKey) headers.set("X-Idempotency-Key", idempotencyKey);
  if (body) headers.set("Content-Type", "application/json");

  return new Request(`https://example.test${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("bounded Living Memory family sharing", () => {
  let d1: TestD1;
  let env: SharingEnv;
  let cookie: string;

  beforeEach(async () => {
    d1 = new TestD1();
    seedCompletedLivingMemory(d1);
    env = {
      DB: d1 as unknown as D1Database,
      MEDIA_BUCKET: new TestR2() as unknown as R2Bucket,
      SESSION_SECRET: sessionSecret,
      SHARE_TOKEN_PEPPER: sharePepper
    };
    cookie = cookieHeader((await createAppSession(env, userId)).cookie);
  });

  it("previews only the allowlisted projection and keeps private archive data out by default", async () => {
    const preview = await handleSharingRoute(
      ownerRequest(
        `/resources/living-memories/${storyId}/share-preview`,
        cookie,
        "POST",
        { caption: "For our family." }
      ),
      env
    );

    expect(preview?.status).toBe(200);
    const text = await preview?.text();
    expect(text).toContain("For our family.");
    expect(text).toContain('"photo":true');
    expect(text).toContain('"voice":true');
    expect(text).toContain('"captions":null');
    expect(text).not.toContain("PRIVATE TRANSCRIPT");
    expect(text).not.toContain("PRIVATE CONTEXT");
    expect(text).not.toContain(userId);
    expect(text).not.toContain("private-owner@example.test");
  });

  it("creates one retry-safe share without changing entitlement and serves only selected public fields", async () => {
    const path = `/resources/living-memories/${storyId}/shares`;
    const first = await handleSharingRoute(
      ownerRequest(
        path,
        cookie,
        "POST",
        { caption: "<For family & friends>", includeVoice: true },
        "share_living_memory_001"
      ),
      env
    );
    expect(first?.status).toBe(201);
    const firstBody = await first?.json() as {
      shareId: string;
      sharePath: string;
      replayed: boolean;
    };

    const replay = await handleSharingRoute(
      ownerRequest(
        path,
        cookie,
        "POST",
        { caption: "<For family & friends>", includeVoice: true },
        "share_living_memory_001"
      ),
      env
    );
    expect(replay?.status).toBe(200);
    const replayBody = await replay?.json() as {
      shareId: string;
      sharePath: string;
      replayed: boolean;
    };

    expect(replayBody.shareId).toBe(firstBody.shareId);
    expect(replayBody.sharePath).toBe(firstBody.sharePath);
    expect(replayBody.replayed).toBe(true);
    expect(
      d1.database.prepare("SELECT count(*) AS count FROM memory_story_shares").get()
    ).toEqual({ count: 1 });
    expect(
      d1.database.prepare("SELECT count(*) AS count FROM living_memory_share_artifacts").get()
    ).toEqual({ count: 1 });
    expect(
      d1.database.prepare(
        "SELECT free_stories_completed FROM story_entitlements WHERE user_id = ?"
      ).get(userId)
    ).toEqual({ free_stories_completed: 1 });

    const publicPage = await handleSharingRoute(
      new Request(`https://example.test${firstBody.sharePath}`),
      env
    );
    expect(publicPage?.status).toBe(200);
    const html = await publicPage?.text();
    expect(html).toContain("&lt;For family &amp; friends&gt;");
    expect(html).toContain("<audio");
    expect(html).not.toContain("PRIVATE TRANSCRIPT");
    expect(html).not.toContain("PRIVATE CONTEXT");
    expect(html).not.toContain(userId);
    expect(html).not.toContain(storyId);
    expect(html).not.toContain(photoId);
    expect(html).not.toContain(audioId);

    const token = firstBody.sharePath.split("/").pop()!;
    const voice = await handleSharingRoute(
      new Request(`https://example.test/shared/${token}/voice`),
      env
    );
    expect(voice?.status).toBe(200);
    expect(voice?.headers.get("Content-Type")).toBe("audio/webm");
  });
  it("can include transcript only after preview selection and revocation closes the link", async () => {
    const preview = await handleSharingRoute(
      ownerRequest(
        `/resources/living-memories/${storyId}/share-preview`,
        cookie,
        "POST",
        { includeCaptions: true, includeVoice: false }
      ),
      env
    );
    expect(preview?.status).toBe(200);
    expect(await preview?.text()).toContain("PRIVATE TRANSCRIPT");
    expect(await handleSharingRoute(
      ownerRequest(
        `/resources/living-memories/${storyId}/shares`,
        cookie,
        "POST",
        { includeCaptions: true, includeVoice: false },
        "share_living_memory_002"
      ),
      env
    )).toBeTruthy();

    const operation = d1.database.prepare(
      "SELECT result_ref FROM operation_receipts WHERE idempotency_key = 'share_living_memory_002'"
    ).get() as { result_ref: string };
    const sharePathResponse = await handleSharingRoute(
      ownerRequest(
        `/resources/living-memories/${storyId}/shares`,
        cookie,
        "POST",
        { includeCaptions: true, includeVoice: false },
        "share_living_memory_002"
      ),
      env
    );
    const shareBody = await sharePathResponse?.json() as { sharePath: string };

    const page = await handleSharingRoute(
      new Request(`https://example.test${shareBody.sharePath}`),
      env
    );
    const html = await page?.text();
    expect(html).toContain("PRIVATE TRANSCRIPT");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("PRIVATE CONTEXT");

    const revoked = await handleSharingRoute(
      ownerRequest(
        `/resources/living-memories/${storyId}/shares/${operation.result_ref}`,
        cookie,
        "DELETE"
      ),
      env
    );
    expect(revoked?.status).toBe(200);

    const closed = await handleSharingRoute(
      new Request(`https://example.test${shareBody.sharePath}`),
      env
    );
    expect(closed?.status).toBe(404);
  });
});
