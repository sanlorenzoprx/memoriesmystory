/// <reference types="@cloudflare/workers-types" />

import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createAppSession } from "../../worker/auth-session";
import { handleCompletionRoute, type CompletionEnv } from "../../worker/completion";

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
const userId = "user_complete_001";
const draftId = "draft_complete_001";
const sessionSecret = "completion-test-session-secret-that-is-long-enough";
const now = "2026-09-22T12:00:00.000Z";

function seedBase(d1: TestD1): void {
  d1.database.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(userId, "complete@example.test", now, now);
  d1.database.prepare(
    `INSERT INTO memory_story_drafts (
      id, owner_user_id, anonymous_identity_hash, status, ui_locale, spoken_locale,
      created_at, updated_at, expires_at, version
    ) VALUES (?, ?, NULL, 'review_ready', 'en-US', 'en-US', ?, ?, '9999-12-31T23:59:59.999Z', 1)`
  ).run(draftId, userId, now, now);
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
  ).run(draftId, userId, "asset_photo_complete", "asset_audio_complete", now, now);

  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
      byte_size, duration_ms, sha256, r2_etag, durability_status, created_by_user_id, created_at
    ) VALUES (?, ?, ?, 'original_photo', NULL, ?, 'image/jpeg', 12, NULL, ?, ?, 'durable', ?, ?)`
  ).run(
    "asset_photo_complete",
    draftId,
    draftId,
    `drafts/${draftId}/photo`,
    "a".repeat(64),
    "etag-photo",
    userId,
    now
  );
  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
      byte_size, duration_ms, sha256, r2_etag, durability_status, created_by_user_id, created_at
    ) VALUES (?, ?, ?, 'original_audio', NULL, ?, 'audio/webm', 12, 1200, ?, ?, 'durable', ?, ?)`
  ).run(
    "asset_audio_complete",
    draftId,
    draftId,
    `drafts/${draftId}/audio`,
    "b".repeat(64),
    "etag-audio",
    userId,
    now
  );
}

function seedContext(
  d1: TestD1,
  kinds: readonly ("person" | "place" | "time" | "event")[] = [
    "person",
    "place",
    "time",
    "event"
  ]
): void {
  const entries = {
    person: ["Abuela", "stated"],
    place: ["Her kitchen", "stated"],
    time: ["Sundays", "approximate"],
    event: [null, "unknown"]
  } as const;

  for (const kind of kinds) {
    const [value, state] = entries[kind];
    d1.database.prepare(
      `INSERT INTO living_memory_context_entries (
        id, memory_story_id, kind, value, context_state, source_type,
        source_ref, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'storyteller', NULL, ?, ?, ?)`
    ).run(`context_${kind}`, draftId, kind, value, state, userId, now, now);
  }
}

function cookieHeader(cookie: string): string {
  return cookie.split(";", 1)[0] ?? cookie;
}

function completeRequest(cookie: string): Request {
  return new Request(`https://example.test/resources/drafts/${draftId}/living-memory`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://example.test",
      "X-Memories-Request": "completion-v1",
      "X-Idempotency-Key": "complete_living_memory_001"
    }
  });
}
describe("Living Memory durable completion", () => {
  let d1: TestD1;
  let env: CompletionEnv;
  let cookie: string;

  beforeEach(async () => {
    d1 = new TestD1();
    seedBase(d1);
    env = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: sessionSecret
    };
    cookie = cookieHeader((await createAppSession(env, userId)).cookie);
  });

  it("completes without AI artifacts, emits activation once, and reopens safely", async () => {
    seedContext(d1);

    const first = await handleCompletionRoute(completeRequest(cookie), env);
    expect(first?.status).toBe(201);
    const firstBody = await first?.json() as {
      livingMemoryId: string;
      activationRecorded: boolean;
      replayed: boolean;
    };
    expect(firstBody.livingMemoryId).toBe(draftId);
    expect(firstBody.activationRecorded).toBe(true);
    expect(firstBody.replayed).toBe(false);

    expect(
      d1.database.prepare(
        "SELECT status, visibility FROM memory_stories WHERE id = ?"
      ).get(draftId)
    ).toEqual({ status: "complete", visibility: "private" });
    expect(
      d1.database.prepare(
        "SELECT count(*) AS count FROM product_events WHERE event_name = 'first_living_memory_completed'"
      ).get()
    ).toEqual({ count: 1 });
    expect(
      d1.database.prepare(
        "SELECT free_stories_completed FROM story_entitlements WHERE user_id = ?"
      ).get(userId)
    ).toEqual({ free_stories_completed: 1 });
    expect(
      d1.database.prepare("SELECT count(*) AS count FROM transcript_revisions").get()
    ).toEqual({ count: 0 });
    expect(
      d1.database.prepare("SELECT count(*) AS count FROM generated_artifacts").get()
    ).toEqual({ count: 0 });

    const replay = await handleCompletionRoute(completeRequest(cookie), env);
    expect(replay?.status).toBe(200);
    expect((await replay?.json() as { replayed: boolean }).replayed).toBe(true);
    expect(
      d1.database.prepare(
        "SELECT count(*) AS count FROM product_events WHERE event_name = 'first_living_memory_completed'"
      ).get()
    ).toEqual({ count: 1 });
    expect(
      d1.database.prepare(
        "SELECT free_stories_completed FROM story_entitlements WHERE user_id = ?"
      ).get(userId)
    ).toEqual({ free_stories_completed: 1 });

    const reopened = await handleCompletionRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/living-memory`, {
        headers: { Cookie: cookie }
      }),
      env
    );
    const snapshot = await reopened?.json() as {
      status: string;
      originals: { photo: { mediaUrl: string }; audio: { mediaUrl: string } };
    };
    expect(snapshot.status).toBe("complete");
    expect(snapshot.originals.photo.mediaUrl).toContain("asset_photo_complete");
    expect(snapshot.originals.audio.mediaUrl).toContain("asset_audio_complete");
  });

  it("does not claim completion until all four storyteller context areas were reviewed", async () => {
    seedContext(d1, ["person", "place", "time"]);

    const blocked = await handleCompletionRoute(completeRequest(cookie), env);
    expect(blocked?.status).toBe(409);
    const body = await blocked?.json() as { error: { code: string } };
    expect(body.error.code).toBe("context_review_required");
    expect(
      d1.database.prepare("SELECT status FROM memory_stories WHERE id = ?").get(draftId)
    ).toEqual({ status: "draft" });
    expect(
      d1.database.prepare(
        "SELECT role, durability_status FROM media_assets ORDER BY role"
      ).all()
    ).toEqual([
      { role: "original_audio", durability_status: "durable" },
      { role: "original_photo", durability_status: "durable" }
    ]);
  });
});
