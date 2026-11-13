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
import { handleStoryReviewRoute } from "../../worker/story-review";
import { handleSharingRoute } from "../../worker/sharing";
import { handleDeletionRoute } from "../../worker/deletion";

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
      "0004_configurable_story_entitlements.sql",
      "0005_memory_deletion.sql",
      "0006_muse_conversation.sql",
      "0007_muse_voice_replies.sql",
      "0008_storyteller_review.sql"
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

function completeRequest(cookie: string, expectedVersion = 1, confirmOriginals = true): Request {
  return new Request(`https://example.test/resources/drafts/${draftId}/living-memory`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://example.test",
      "X-Memories-Request": "completion-v1",
      "X-Idempotency-Key": "complete_living_memory_001",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expectedVersion, confirmOriginals })
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

    const first = await handleCompletionRoute(completeRequest(cookie, (d1.database.prepare("SELECT version FROM memory_stories WHERE id = ?").get(draftId) as { version: number }).version), env);
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

    const replay = await handleCompletionRoute(completeRequest(cookie, (d1.database.prepare("SELECT version FROM memory_stories WHERE id = ?").get(draftId) as { version: number }).version), env);
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

  it("preserves confirmed originals with no transcript, context or Muse turns", async () => {
    const first = await handleCompletionRoute(completeRequest(cookie), env);
    expect(first?.status).toBe(201);
    expect(d1.database.prepare("SELECT count(*) AS count FROM living_memory_context_entries").get()).toEqual({ count: 0 });
    expect(d1.database.prepare("SELECT count(*) AS count FROM muse_conversation_turns").get()).toEqual({ count: 0 });
    expect(d1.database.prepare("SELECT kind, base_story_version, source_audio_asset_id FROM living_memory_reviews").get()).toEqual({ kind: "completion", base_story_version: 1, source_audio_asset_id: "asset_audio_complete" });
    expect((await handleCompletionRoute(completeRequest(cookie), env))?.status).toBe(200);
    expect(d1.database.prepare("SELECT free_stories_completed FROM story_entitlements WHERE user_id = ?").get(userId)).toEqual({ free_stories_completed: 1 });
  });

  it("rejects completion from a stale reviewed version without consuming capacity", async () => {
    seedContext(d1, ["person"]);
    const blocked = await handleCompletionRoute(completeRequest(cookie, 1), env);
    expect(blocked?.status).toBe(409);
    expect(d1.database.prepare("SELECT free_stories_completed FROM story_entitlements WHERE user_id = ?").get(userId)).toEqual({ free_stories_completed: 0 });
    expect(d1.database.prepare("SELECT count(*) AS count FROM living_memory_reviews").get()).toEqual({ count: 0 });
  });

  it("does not claim completion without explicit source confirmation", async () => {
    seedContext(d1, ["person", "place", "time"]);

    const blocked = await handleCompletionRoute(completeRequest(cookie, 4, false), env);
    expect(blocked?.status).toBe(409);
    const body = await blocked?.json() as { error: { code: string } };
    expect(body.error.code).toBe("source_confirmation_required");
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
  describe("storyteller review and revision lineage", () => {
    const machineId = "transcript_review_machine_001";
    const machineText = "We met in the old kitchen.";
    function version() { return (d1.database.prepare("SELECT version FROM memory_stories WHERE id = ?").get(draftId) as { version: number }).version; }
    function request(body: Record<string, unknown>, key = "review_test_001", session = cookie, origin = "https://example.test") {
      return new Request(`https://example.test/resources/drafts/${draftId}/review`, {
        method: "PUT", headers: { Cookie: session, Origin: origin, "Content-Type": "application/json", "X-Memories-Request": "story-review-v1", "X-Idempotency-Key": key }, body: JSON.stringify(body)
      });
    }
    function edit(expectedVersion = version()) { return { expectedVersion, transcriptText: "We met in Abuela's kitchen.", context: [
      { kind: "person", state: "stated", value: "Abuela" }, { kind: "time", state: "approximate", value: "Around 1990" }
    ] }; }
    async function history() {
      return handleStoryReviewRoute(new Request(`https://example.test/resources/drafts/${draftId}/review`, { headers: { Cookie: cookie } }), env);
    }
    beforeEach(() => {
      d1.database.prepare(`INSERT INTO transcript_revisions
        (id, memory_story_id, source_audio_asset_id, revision_kind, text, locale, created_by_type, model_config_version, created_at)
        VALUES (?, ?, 'asset_audio_complete', 'machine_transcript', ?, 'es-PR', 'machine', 'synthetic-test', ?)`)
        .run(machineId, draftId, machineText, now);
      d1.database.prepare("UPDATE memory_stories SET current_transcript_revision_id = ? WHERE id = ?").run(machineId, draftId);
    });

    it("appends an attributable correction before completion and retains original sources and history", async () => {
      const originals = d1.database.prepare("SELECT * FROM media_assets ORDER BY id").all();
      const body = edit();
      const saved = await handleStoryReviewRoute(request(body), env);
      expect(saved?.status).toBe(201);
      expect(d1.database.prepare("SELECT text FROM transcript_revisions WHERE id = ?").get(machineId)).toEqual({ text: machineText });
      expect(d1.database.prepare("SELECT * FROM media_assets ORDER BY id").all()).toEqual(originals);
      const revised = d1.database.prepare("SELECT parent_revision_id, revision_kind, created_by_type, created_by_user_id, locale FROM transcript_revisions WHERE id <> ?").get(machineId);
      expect(revised).toEqual({ parent_revision_id: machineId, revision_kind: "corrected_transcript", created_by_type: "user", created_by_user_id: userId, locale: "es-PR" });
      expect((await handleStoryReviewRoute(request(body), env))?.status).toBe(200);
      expect(d1.database.prepare("SELECT count(*) AS count FROM living_memory_reviews").get()).toEqual({ count: 1 });
      const conflict = await handleStoryReviewRoute(request({ ...body, transcriptText: "Different edit." }), env);
      expect(conflict?.status).toBe(409);
      const response = await history();
      expect(response?.headers.get("Cache-Control")).toContain("no-store");
      const data = await response!.json() as { originalTranscript: { text: string }; revisions: { transcriptText: string; authorId: string }[] };
      expect(data.originalTranscript.text).toBe(machineText);
      expect(data.revisions[0]).toMatchObject({ transcriptText: body.transcriptText, authorId: userId });
      const reopened = await handleCompletionRoute(new Request(`https://example.test/resources/drafts/${draftId}/living-memory`, { headers: { Cookie: cookie } }), env);
      const view = await reopened!.json() as { version: number; transcript: { revisionId: string; revisionKind: string }; context: { state: string }[] };
      expect(view.version).toBe(version());
      expect(view.transcript.revisionKind).toBe("corrected_transcript");
      expect(view.transcript.revisionId).toBeTruthy();
      expect(view.context.map((entry) => entry.state)).toContain("approximate");
    });

    it("rejects stale and concurrent edits atomically, including changes written by Muse", async () => {
      const body = edit();
      const results = await Promise.all([
        handleStoryReviewRoute(request(body, "review_concurrent_a"), env),
        handleStoryReviewRoute(request({ ...body, transcriptText: "Another device's words." }, "review_concurrent_b"), env)
      ]);
      expect(results.map((result) => result!.status).sort()).toEqual([201, 409]);
      expect(d1.database.prepare("SELECT count(*) AS count FROM living_memory_reviews").get()).toEqual({ count: 1 });
      expect(d1.database.prepare("SELECT count(*) AS count FROM transcript_revisions").get()).toEqual({ count: 2 });
      const latest = edit();
      seedContext(d1, ["place"]);
      expect((await handleStoryReviewRoute(request(latest, "review_after_muse_001"), env))?.status).toBe(409);
      expect(d1.database.prepare("SELECT count(*) AS count FROM transcript_revisions").get()).toEqual({ count: 2 });
    });

    it("bounds chunked review bodies without trusting Content-Length", async () => {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(new Uint8Array(60_000)); },
        cancel() { cancelled = true; }
      });
      const oversized = new Request(`https://example.test/resources/drafts/${draftId}/review`, {
        method: "PUT", headers: { Cookie: cookie, "X-Memories-Request": "story-review-v1", "X-Idempotency-Key": "review_size_001" },
        body: stream, duplex: "half"
      } as RequestInit);
      expect((await handleStoryReviewRoute(oversized, env))?.status).toBe(413);
      expect(cancelled).toBe(true);
      expect(d1.database.prepare("SELECT count(*) AS count FROM living_memory_reviews").get()).toEqual({ count: 0 });
    });

    it("can pause new review writes while retaining authorized revision reads", async () => {
      const paused = { ...env, STORY_REVIEW_WRITES_PAUSED: "true" };
      expect((await handleStoryReviewRoute(request(edit()), paused))?.status).toBe(503);
      const read = await handleStoryReviewRoute(new Request(`https://example.test/resources/drafts/${draftId}/review`, { headers: { Cookie: cookie } }), paused);
      expect(read?.status).toBe(200);
      expect(d1.database.prepare("SELECT count(*) AS count FROM living_memory_reviews").get()).toEqual({ count: 0 });
    });

    it("protects review and history with ownership, origin and input validation", async () => {
      d1.database.prepare("INSERT INTO users (id, created_at, updated_at) VALUES ('other_review_user', ?, ?)").run(now, now);
      const other = cookieHeader((await createAppSession(env, "other_review_user")).cookie);
      expect((await handleStoryReviewRoute(request(edit(), "review_other_001", other), env))?.status).toBe(404);
      expect((await handleStoryReviewRoute(new Request(`https://example.test/resources/drafts/${draftId}/review`, { headers: { Cookie: other } }), env))?.status).toBe(404);
      expect((await handleStoryReviewRoute(new Request(`https://example.test/resources/drafts/${draftId}/review`), env))?.status).toBe(401);
      expect((await handleStoryReviewRoute(request(edit(), "review_origin_001", cookie, "https://attacker.test"), env))?.status).toBe(403);
      const bad = edit();
      bad.context[0]!.state = "unknown";
      expect((await handleStoryReviewRoute(request(bad), env))?.status).toBe(400);
      expect((await handleStoryReviewRoute(request({ ...edit(), transcriptText: "" }), env))?.status).toBe(400);
      expect(d1.database.prepare("SELECT count(*) AS count FROM living_memory_reviews").get()).toEqual({ count: 0 });
    });

    it("edits a completed memory without reopening, spending capacity again, or changing existing shared captions", async () => {
      expect((await handleCompletionRoute(completeRequest(cookie), env))?.status).toBe(201);
      const shareEnv = { ...env, SHARE_TOKEN_PEPPER: "test-pepper-".repeat(4), MEDIA_BUCKET: {} as R2Bucket };
      const makeShare = (key: string, revision = machineId) => new Request(`https://example.test/resources/living-memories/${draftId}/shares`, {
        method: "POST", headers: { Cookie: cookie, Origin: "https://example.test", "Content-Type": "application/json", "X-Memories-Request": "share-v1", "X-Idempotency-Key": key },
        body: JSON.stringify({ includeCaptions: true, includeVoice: false, expectedTranscriptRevisionId: revision })
      });
      const shared = await handleSharingRoute(makeShare("review_share_old_001"), shareEnv);
      expect(shared?.status).toBe(201);
      const old = await shared!.json() as { sharePath: string };
      expect((await handleStoryReviewRoute(request({ ...edit(), transcriptText: "PRIVATE revised recollection." }), env))?.status).toBe(201);
      const page = await handleSharingRoute(new Request(`https://example.test${old.sharePath}`), shareEnv);
      const html = await page!.text();
      expect(html).toContain(machineText);
      expect(html).not.toContain("PRIVATE revised");
      expect((await handleSharingRoute(makeShare("review_share_old_001"), shareEnv))?.status).toBe(200);
      expect(d1.database.prepare("SELECT status FROM memory_stories WHERE id = ?").get(draftId)).toEqual({ status: "complete" });
      expect(d1.database.prepare("SELECT status FROM memory_story_drafts WHERE id = ?").get(draftId)).toEqual({ status: "complete" });
      expect(d1.database.prepare("SELECT free_stories_completed FROM story_entitlements WHERE user_id = ?").get(userId)).toEqual({ free_stories_completed: 1 });
      expect(d1.database.prepare("SELECT count(*) AS count FROM product_events WHERE event_name = 'first_living_memory_completed'").get()).toEqual({ count: 1 });
    });

    it("paginates history and never mutates prior context or transcript rows", async () => {
      for (let i = 0; i < 12; i += 1) {
        const response = await handleStoryReviewRoute(request({ ...edit(), transcriptText: `My words, revision ${i}.` }, `review_history_${String(i).padStart(4, "0")}`), env);
        expect(response?.status).toBe(201);
      }
      const first = await history();
      const page = await first!.json() as { revisions: { reviewId: string }[]; nextCursor: string };
      expect(page.revisions).toHaveLength(10);
      const next = await handleStoryReviewRoute(new Request(`https://example.test/resources/drafts/${draftId}/review?before=${page.nextCursor}`, { headers: { Cookie: cookie } }), env);
      const last = await next!.json() as { revisions: { reviewId: string }[]; nextCursor: string | null };
      expect(last.revisions).toHaveLength(2);
      expect(new Set([...page.revisions, ...last.revisions].map((entry) => entry.reviewId)).size).toBe(12);
      expect(last.nextCursor).toBeNull();
      expect(() => d1.database.prepare("UPDATE living_memory_reviews SET context_json = '[]'").run()).toThrow(/append only/);
      expect(() => d1.database.prepare("UPDATE living_memory_context_entries SET value = 'rewritten'").run()).toThrow(/append only/);
      expect(() => d1.database.prepare("UPDATE transcript_revisions SET text = 'rewritten'").run()).toThrow(/append only/);
    });

    it("deletes the complete corrected history with the memory and retains no review content", async () => {
      expect((await handleCompletionRoute(completeRequest(cookie), env))?.status).toBe(201);
      expect((await handleStoryReviewRoute(request(edit()), env))?.status).toBe(201);
      expect((await handleStoryReviewRoute(request({ ...edit(), transcriptText: "My next recollection, still my words." }, "review_second_revision"), env))?.status).toBe(201);
      expect(d1.database.prepare("SELECT count(*) AS count FROM transcript_revisions").get()).toEqual({ count: 3 });
      const response = await handleDeletionRoute(new Request(`https://example.test/resources/drafts/${draftId}`, {
        method: "DELETE", headers: { Cookie: cookie, Origin: "https://example.test", "X-Memories-Request": "deletion-v1" }
      }), { ...env, MEDIA_BUCKET: { delete: async () => undefined } as unknown as R2Bucket });
      expect(response?.status).toBe(200);
      for (const table of ["living_memory_reviews", "living_memory_context_entries", "transcript_revisions", "media_assets"]) {
        expect(d1.database.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
      }
    });
  });

});
