/// <reference types="@cloudflare/workers-types" />

import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createAppSession } from "../../worker/auth-session";
import {
  handleMuseConversationRoute,
  type MuseConversationEnv
} from "../../worker/muse-conversation";

class TestD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    readonly query: string,
    readonly values: readonly SQLInputValue[] = []
  ) {}

  bind(...values: SQLInputValue[]) {
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
      "0006_muse_conversation.sql"
    ]) {
      this.database.exec(
        readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8")
      );
    }
  }

  prepare(query: string) {
    return new TestD1Statement(this.database, query);
  }
}

const userId = "user_muse_conversation_001";
const draftId = "draft_muse_conversation_001";
const sessionSecret = "muse-conversation-session-secret-that-is-long-enough";

function seed(d1: TestD1): void {
  const now = "2026-09-23T12:00:00.000Z";
  d1.database.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(userId, "conversation@example.test", now, now);

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
  ).run(
    draftId,
    userId,
    "asset_photo_muse_conversation",
    "asset_audio_muse_conversation",
    "transcript_muse_conversation_001",
    now,
    now
  );

  for (const asset of [
    {
      id: "asset_photo_muse_conversation",
      role: "original_photo",
      key: `drafts/${draftId}/photo`,
      type: "image/jpeg",
      sha: "a".repeat(64),
      etag: "etag-photo",
      duration: null
    },
    {
      id: "asset_audio_muse_conversation",
      role: "original_audio",
      key: `drafts/${draftId}/audio`,
      type: "audio/webm",
      sha: "b".repeat(64),
      etag: "etag-audio",
      duration: 1400
    }
  ] as const) {
    d1.database.prepare(
      `INSERT INTO media_assets (
        id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
        byte_size, duration_ms, sha256, r2_etag, durability_status,
        created_by_user_id, created_at
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
    "transcript_muse_conversation_001",
    draftId,
    "asset_audio_muse_conversation",
    "Every Sunday Abuela made arroz con gandules and everyone crowded into her kitchen.",
    now
  );
}

function cookieHeader(cookie: string): string {
  return cookie.split(";", 1)[0] ?? cookie;
}

function conversationRequest(
  cookie: string,
  body: Record<string, unknown> = {}
): Request {
  return new Request(
    `https://example.test/resources/drafts/${draftId}/muse-conversation`,
    {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://example.test",
        "Content-Type": "application/json",
        "X-Memories-Request": "muse-conversation-v1"
      },
      body: JSON.stringify(body)
    }
  );
}

describe("Muse conversational story elicitation", () => {
  let d1: TestD1;
  let env: MuseConversationEnv;
  let cookie: string;
  let aiCall = 0;

  beforeEach(async () => {
    d1 = new TestD1();
    seed(d1);
    aiCall = 0;
    const replies = [
      { question: "What detail from those Sundays comes back most vividly?", focus: "detail" },
      { question: "Who do you most remember being there with you?", focus: "person" },
      { question: "Where in the house do you picture everyone gathering?", focus: "place" },
      { question: "About when in your life were these Sundays?", focus: "time" },
      { question: "What was happening around the moment you remember?", focus: "event" }
    ];
    env = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: sessionSecret,
      AI: {
        run: async () => {
          const next = replies[Math.min(aiCall, replies.length - 1)]!;
          aiCall += 1;
          return { response: JSON.stringify(next) };
        }
      } as unknown as Ai
    };
    cookie = cookieHeader((await createAppSession(env, userId)).cookie);
  });

  it("elicits dynamically but only storyteller replies resolve preservation context", async () => {
    const started = await handleMuseConversationRoute(
      conversationRequest(cookie),
      env
    );
    expect(started?.status).toBe(200);
    let body = await started?.json() as {
      currentQuestion: { turnId: string; content: string; focus: string } | null;
      context: unknown[];
      unresolved: string[];
      done: boolean;
    };

    expect(body.currentQuestion?.focus).toBe("detail");
    expect(body.context).toEqual([]);
    expect(body.unresolved).toEqual(["person", "place", "time", "event"]);
    expect(body.done).toBe(false);

    const afterDetail = await handleMuseConversationRoute(
      conversationRequest(cookie, {
        replyToTurnId: body.currentQuestion!.turnId,
        answer: "The smell of sofrito and everyone talking at once.",
        state: "stated"
      }),
      env
    );
    body = await afterDetail?.json() as typeof body;
    expect(body.context).toEqual([]);
    expect(body.currentQuestion?.focus).toBe("person");

    const afterPerson = await handleMuseConversationRoute(
      conversationRequest(cookie, {
        replyToTurnId: body.currentQuestion!.turnId,
        answer: "Abuela and my two sisters.",
        state: "stated"
      }),
      env
    );
    body = await afterPerson?.json() as typeof body;

    expect(
      d1.database.prepare(
        "SELECT kind, value, context_state FROM living_memory_context_entries ORDER BY rowid"
      ).all()
    ).toEqual([
      {
        kind: "person",
        value: "Abuela and my two sisters.",
        context_state: "stated"
      }
    ]);
    expect(body.done).toBe(false);
    expect(body.currentQuestion?.focus).toBe("place");

    for (const response of [
      { answer: "Her kitchen in Santurce.", state: "stated" },
      { answer: "I don't remember.", state: "unknown" },
      { answer: "I'd rather leave that out.", state: "omitted" }
    ]) {
      const next = await handleMuseConversationRoute(
        conversationRequest(cookie, {
          replyToTurnId: body.currentQuestion!.turnId,
          answer: response.state === "stated" ? response.answer : undefined,
          state: response.state
        }),
        env
      );
      body = await next?.json() as typeof body;
    }

    expect(body.done).toBe(true);
    expect(body.unresolved).toEqual([]);
    expect(body.currentQuestion).toBeNull();

    expect(
      d1.database.prepare(
        "SELECT kind, value, context_state FROM living_memory_context_entries ORDER BY kind"
      ).all()
    ).toEqual([
      { kind: "event", value: null, context_state: "omitted" },
      { kind: "person", value: "Abuela and my two sisters.", context_state: "stated" },
      { kind: "place", value: "Her kitchen in Santurce.", context_state: "stated" },
      { kind: "time", value: null, context_state: "unknown" }
    ]);
  });
});
