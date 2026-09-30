/// <reference types="@cloudflare/workers-types" />

import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createAppSession } from "../../worker/auth-session";
import { handleMuseRoute, type MuseEnv } from "../../worker/muse";

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
      "0003_living_memory_proof.sql"
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
const userId = "user_muse_001";
const draftId = "draft_muse_001";
const sessionSecret = "muse-test-session-secret-that-is-long-enough";

function seed(d1: TestD1): void {
  const now = "2026-09-22T12:00:00.000Z";
  d1.database.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(userId, "muse@example.test", now, now);
  d1.database.prepare(
    `INSERT INTO memory_story_drafts (
      id, owner_user_id, anonymous_identity_hash, status, ui_locale, spoken_locale,
      created_at, updated_at, expires_at, version
    ) VALUES (?, ?, NULL, 'review_partial', 'en-US', 'en-US', ?, ?, '9999-12-31T23:59:59.999Z', 1)`
  ).run(draftId, userId, now, now);

  d1.database.prepare(
    `INSERT INTO memory_stories (
      id, owner_user_id, status, visibility, primary_photo_asset_id,
      primary_audio_asset_id, current_transcript_revision_id,
      current_muse_description_id, created_at, completed_at, updated_at, version
    ) VALUES (?, ?, 'draft', 'private', ?, ?, ?, NULL, ?, NULL, ?, 1)`
  ).run(draftId, userId, "asset_photo_muse", "asset_audio_muse", "transcript_muse_001", now, now);

  for (const asset of [
    {
      id: "asset_photo_muse",
      role: "original_photo",
      key: `drafts/${draftId}/photo`,
      type: "image/jpeg",
      sha: "a".repeat(64),
      etag: "etag-photo",
      duration: null
    },
    {
      id: "asset_audio_muse",
      role: "original_audio",
      key: `drafts/${draftId}/audio`,
      type: "audio/webm",
      sha: "b".repeat(64),
      etag: "etag-audio",
      duration: 1200
    }
  ] as const) {
    d1.database.prepare(
      `INSERT INTO media_assets (
        id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
        byte_size, duration_ms, sha256, r2_etag, durability_status, created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, 12, ?, ?, ?, 'durable', ?, ?)`
    ).run(
      asset.id,
      draftId,
      draftId,
      asset.role,
      asset.key,
      asset.type,
      asset.duration,
      asset.sha,
      asset.etag,
      userId,
      now
    );
  }

  d1.database.prepare(
    `INSERT INTO transcript_revisions (
      id, memory_story_id, source_audio_asset_id, parent_revision_id,
      revision_kind, text, locale, created_by_type, created_by_user_id,
      model_config_version, created_at
    ) VALUES (?, ?, ?, NULL, 'machine_transcript', ?, 'en-US', 'machine', NULL, 'test-model', ?)`
  ).run(
    "transcript_muse_001",
    draftId,
    "asset_audio_muse",
    "Every Sunday Abuela made arroz con gandules and everyone crowded into her kitchen.",
    now
  );
}

function cookieHeader(cookie: string): string {
  return cookie.split(";", 1)[0] ?? cookie;
}

function museRequest(cookie: string): Request {
  return new Request(`https://example.test/resources/drafts/${draftId}/muse`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://example.test",
      "X-Memories-Request": "muse-v1"
    }
  });
}
describe("Muse Storyteller Sovereignty", () => {
  let d1: TestD1;
  let env: MuseEnv;
  let cookie: string;
  let aiCalls: number;

  beforeEach(async () => {
    d1 = new TestD1();
    seed(d1);
    aiCalls = 0;
    env = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: sessionSecret,
      AI: {
        run: async () => {
          aiCalls += 1;
          return { response: "What do you remember about the feeling in Abuela's kitchen?" };
        }
      } as unknown as Ai
    };
    cookie = cookieHeader((await createAppSession(env, userId)).cookie);
  });

  it("asks one source-grounded remembering question and replays the same artifact", async () => {
    const first = await handleMuseRoute(museRequest(cookie), env);
    expect(first?.status).toBe(201);
    const firstBody = await first?.json() as {
      musePrompt: { artifactId: string; question: string; sourceRefs: string[] };
    };
    expect(firstBody.musePrompt.question).toBe(
      "What do you remember about the feeling in Abuela's kitchen?"
    );
    expect(firstBody.musePrompt.sourceRefs).toEqual(["transcript:transcript_muse_001"]);

    const replay = await handleMuseRoute(museRequest(cookie), env);
    const replayBody = await replay?.json() as {
      musePrompt: { artifactId: string; question: string };
    };
    expect(replayBody.musePrompt.artifactId).toBe(firstBody.musePrompt.artifactId);
    expect(aiCalls).toBe(1);
    expect(
      d1.database.prepare(
        "SELECT count(*) AS count FROM generated_artifacts WHERE kind = 'muse_prompt'"
      ).get()
    ).toEqual({ count: 1 });
  });

  it("rejects judgmental model language and keeps context entirely storyteller-owned", async () => {
    env = {
      ...env,
      AI: {
        run: async () => ({ response: "Are you sure it was really every Sunday?" })
      } as unknown as Ai
    };

    const muse = await handleMuseRoute(museRequest(cookie), env);
    const museBody = await muse?.json() as { musePrompt: { question: string } };
    expect(museBody.musePrompt.question).toBe(
      "What else comes back to you when you look at this photograph?"
    );
    expect(museBody.musePrompt.question.toLowerCase()).not.toContain("are you sure");

    const saved = await handleMuseRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/context`, {
        method: "PUT",
        headers: {
          Cookie: cookie,
          Origin: "https://example.test",
          "Content-Type": "application/json",
          "X-Memories-Request": "muse-v1",
          "X-Idempotency-Key": "context_save_muse_001"
        },
        body: JSON.stringify({
          entries: [
            { kind: "person", state: "stated", value: "Abuela" },
            { kind: "place", state: "stated", value: "Her kitchen" },
            { kind: "time", state: "approximate", value: "Sundays" },
            { kind: "event", state: "unknown", value: null }
          ]
        })
      }),
      env
    );

    expect(saved?.status).toBe(200);
    const rows = d1.database.prepare(
      `SELECT kind, value, context_state
       FROM living_memory_context_entries ORDER BY kind`
    ).all();
    expect(rows).toEqual([
      { kind: "event", value: null, context_state: "unknown" },
      { kind: "person", value: "Abuela", context_state: "stated" },
      { kind: "place", value: "Her kitchen", context_state: "stated" },
      { kind: "time", value: "Sundays", context_state: "approximate" }
    ]);
  });
});
