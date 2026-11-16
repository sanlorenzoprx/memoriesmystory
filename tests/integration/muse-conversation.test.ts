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
      "0006_muse_conversation.sql",
      "0007_muse_voice_replies.sql"
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

function seed(d1: TestD1, story = "Every Sunday Abuela made arroz con gandules and everyone crowded into her kitchen."): void {
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
    story,
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

  it("uses the chosen UI language for a fallback question while keeping the English source unchanged", async () => {
    const source = d1.database.prepare("SELECT text, locale FROM transcript_revisions").get();
    let system = "";
    const fallbackEnv = { ...env, AI: { run: async (_model: string, input: { messages: { content: string }[] }) => {
      system = input.messages[0]!.content;
      throw new Error("Synthetic provider outage");
    } } as unknown as Ai };
    const request = conversationRequest(cookie);
    request.headers.set("X-UI-Locale", "es-PR");
    const result = await handleMuseConversationRoute(request, fallbackEnv);
    expect(result?.status).toBe(200);
    const data = await result!.json() as { currentQuestion: { content: string } };
    expect(data.currentQuestion.content).toMatch(/^¿/);
    expect(system).toContain("Use Spanish (es-PR)");
    expect(d1.database.prepare("SELECT text, locale FROM transcript_revisions").get()).toEqual(source);
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

  // Decision 2026-11-16 (Talk with Muse): a person who may be in danger is
  // answered before any question; their words stay as testimony; the
  // conversation stays open.
  type Snapshot = {
    currentQuestion: { turnId: string; content: string; focus: string; support: { lines: { phone: string | null }[]; emergencyNumber: string | null } | null } | null;
    turns: { speaker: string; content: string }[];
    done: boolean;
  };

  it("answers words of danger with real people to reach, keeps the words, and lets the person continue", async () => {
    let body = (await (await handleMuseConversationRoute(conversationRequest(cookie), env))!.json()) as Snapshot;
    const firstQuestion = body.currentQuestion!;
    expect(firstQuestion.support).toBeNull();
    const callsBefore = aiCall;

    const reply = conversationRequest(cookie, { replyToTurnId: firstQuestion.turnId, answer: "Since she died I don't want to live anymore.", state: "stated" });
    reply.headers.set("X-UI-Locale", "es-PR");
    body = (await (await handleMuseConversationRoute(reply, env))!.json()) as Snapshot;

    // No model call: the support message is fixed, reviewed wording.
    expect(aiCall).toBe(callsBefore);
    expect(body.currentQuestion!.content).toContain("inteligencia artificial");
    expect(body.currentQuestion!.content).toContain("988");
    expect(body.currentQuestion!.support).toEqual({ lines: [expect.objectContaining({ phone: "988", sms: "988" })], emergencyNumber: "911" });
    expect(body.done).toBe(false);
    // The words are kept as said, but never attached to the memory as context.
    expect(body.turns.some((turn) => turn.speaker === "storyteller" && turn.content === "Since she died I don't want to live anymore.")).toBe(true);
    expect(d1.database.prepare("SELECT COUNT(*) AS n FROM living_memory_context_entries").get()).toEqual({ n: 0 });

    // A retry of the same reply does not add a second support message.
    const retry = conversationRequest(cookie, { replyToTurnId: firstQuestion.turnId, answer: "Since she died I don't want to live anymore.", state: "stated" });
    retry.headers.set("X-UI-Locale", "es-PR");
    body = (await (await handleMuseConversationRoute(retry, env))!.json()) as Snapshot;
    expect(body.turns.filter((turn) => turn.content.includes("988"))).toHaveLength(1);

    // The person can keep telling the story; Muse asks its next question.
    body = (await (await handleMuseConversationRoute(conversationRequest(cookie, { replyToTurnId: body.currentQuestion!.turnId, answer: "Her kitchen always smelled of sofrito.", state: "stated" }), env))!.json()) as Snapshot;
    expect(body.currentQuestion!.support).toBeNull();
    expect(aiCall).toBe(callsBefore + 1);
  });

  it("answers danger even on the answer that would finish the conversation", async () => {
    let body = (await (await handleMuseConversationRoute(conversationRequest(cookie), env))!.json()) as Snapshot;
    for (const answer of ["Abuela and my sisters.", "Her kitchen in Santurce.", "About 1962.", "Sunday dinner."]) {
      body = (await (await handleMuseConversationRoute(conversationRequest(cookie, { replyToTurnId: body.currentQuestion!.turnId, answer, state: "stated" }), env))!.json()) as Snapshot;
    }
    body = (await (await handleMuseConversationRoute(conversationRequest(cookie, { replyToTurnId: body.currentQuestion!.turnId, answer: "Honestly I want to die some days.", state: "stated" }), env))!.json()) as Snapshot;
    expect(body.done).toBe(false);
    expect(body.currentQuestion!.content).toContain("call or text 988");
  });

  it("opens with the support message when the recording itself signals danger", async () => {
    // Transcript revisions are append-only, so the test seeds a second
    // memory whose recording carries the words.
    d1 = new TestD1();
    seed(d1, "This was our wedding day. Lately I think about ending my life.");
    env = { ...env, DB: d1 as unknown as D1Database };
    cookie = cookieHeader((await createAppSession(env, userId)).cookie);
    const body = (await (await handleMuseConversationRoute(conversationRequest(cookie), env))!.json()) as Snapshot;
    expect(aiCall).toBe(0);
    expect(body.currentQuestion!.content).toContain("I'm an AI");
    expect(body.currentQuestion!.support!.emergencyNumber).toBe("911");
  });
});
