/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppSession } from "../../worker/auth-session";
import {
  handleMuseConversationRoute,
  type MuseConversationEnv
} from "../../worker/muse-conversation";
import {
  handleMuseVoiceReplyRoute,
  type MuseVoiceReplyEnv
} from "../../worker/muse-voice-replies";

type StoredObject = {
  body: Uint8Array;
  etag: string;
  contentType: string;
  customMetadata: Record<string, string>;
};

class TestStatement {
  constructor(
    private readonly db: DatabaseSync,
    readonly query: string,
    readonly values: readonly SQLInputValue[] = []
  ) {}

  bind(...values: SQLInputValue[]) {
    return new TestStatement(this.db, this.query, values);
  }

  private prepared(): StatementSync {
    return this.db.prepare(this.query);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.prepared().get(...this.values) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.prepared().run(...this.values);
    return { success: true, results: [], meta: {} as D1Result<T>["meta"] };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return {
      success: true,
      results: this.prepared().all(...this.values) as T[],
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
      "0006_muse_conversation.sql",
      "0007_muse_voice_replies.sql"
    ]) {
      this.database.exec(
        readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8")
      );
    }
  }

  prepare(query: string) {
    return new TestStatement(this.database, query);
  }

  async batch<T>(statements: readonly TestStatement[]): Promise<D1Result<T>[]> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results: D1Result<T>[] = [];
      for (const statement of statements) {
        results.push((await statement.run()) as D1Result<T>);
      }
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function r2Object(key: string, value: StoredObject, range?: R2Range): R2ObjectBody {
  let body = value.body;
  let normalizedRange: R2Range | undefined;
  if (range && "offset" in range && typeof range.offset === "number") {
    const length = range.length ?? body.length - range.offset;
    body = body.slice(range.offset, range.offset + length);
    normalizedRange = { offset: range.offset, length };
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    }
  });
  return {
    key,
    version: "1",
    size: value.body.length,
    etag: value.etag,
    httpEtag: `"${value.etag}"`,
    checksums: { toJSON: () => ({}) },
    uploaded: new Date("2026-09-23T12:00:00Z"),
    httpMetadata: { contentType: value.contentType },
    customMetadata: value.customMetadata,
    range: normalizedRange,
    storageClass: "Standard",
    writeHttpMetadata(headers) {
      headers.set("Content-Type", value.contentType);
    },
    body: stream,
    bodyUsed: false,
    arrayBuffer: () =>
      Promise.resolve(
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
      ),
    bytes: () => Promise.resolve(body),
    text: () => Promise.resolve(new TextDecoder().decode(body)),
    json: <T>() =>
      Promise.resolve(JSON.parse(new TextDecoder().decode(body)) as T),
    blob: () =>
      Promise.resolve(
        new Blob(
          [
            body.buffer.slice(
              body.byteOffset,
              body.byteOffset + body.byteLength
            ) as ArrayBuffer
          ],
          { type: value.contentType }
        )
      )
  } as R2ObjectBody;
}

class TestR2 {
  readonly objects = new Map<string, StoredObject>();

  async head(key: string): Promise<R2Object | null> {
    const value = this.objects.get(key);
    return value ? r2Object(key, value) : null;
  }

  async put(
    key: string,
    body: ArrayBuffer,
    options?: R2PutOptions
  ): Promise<R2Object | null> {
    if (options?.onlyIf && this.objects.has(key)) return null;
    const bytes = new Uint8Array(body);
    const value: StoredObject = {
      body: bytes,
      etag: createHash("sha256").update(bytes).digest("hex").slice(0, 24),
      contentType:
        (options?.httpMetadata as R2HTTPMetadata | undefined)?.contentType ??
        "application/octet-stream",
      customMetadata: options?.customMetadata ?? {}
    };
    this.objects.set(key, value);
    return r2Object(key, value);
  }

  async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
    const value = this.objects.get(key);
    if (!value) return null;
    let range: R2Range | undefined;
    if (options?.range instanceof Headers) {
      const header = options.range.get("Range");
      const match = header?.match(/^bytes=(\d+)-(\d*)$/);
      if (match) {
        const offset = Number(match[1]);
        range = {
          offset,
          length: match[2] ? Number(match[2]) - offset + 1 : undefined
        };
      }
    }
    return r2Object(key, value, range);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

const userId = "user_voice_reply_001";
const draftId = "draft_voice_reply_001";
const museTurnId = "muse_turn_voice_reply_001";
const voiceAssetId = "muse_voice_reply_001";
const sessionSecret = "voice-reply-session-secret-that-is-long-enough";
const audio = Uint8Array.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01,
  0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04
]);

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function seed(d1: TestD1): void {
  const now = "2026-09-23T12:00:00.000Z";
  d1.database.prepare(
    "INSERT INTO users (id,email,created_at,updated_at) VALUES (?,?,?,?)"
  ).run(userId, "voice-reply@example.test", now, now);
  d1.database.prepare(
    "INSERT INTO story_entitlements (user_id,plan,free_story_limit,free_stories_unlocked,free_stories_completed,paid_story_capacity,updated_at) VALUES (?,'free',1,1,0,0,?)"
  ).run(userId, now);
  d1.database.prepare(
    `INSERT INTO memory_story_drafts (
      id, owner_user_id, status, ui_locale, spoken_locale,
      created_at, updated_at, expires_at, version
    ) VALUES (?,?,'review_partial','en-US','en-US',?,?,'9999-12-31T23:59:59.999Z',3)`
  ).run(draftId, userId, now, now);
  d1.database.prepare(
    `INSERT INTO memory_stories (
      id, owner_user_id, status, visibility, primary_photo_asset_id,
      primary_audio_asset_id, current_transcript_revision_id,
      created_at, updated_at, version
    ) VALUES (?,?,'draft','private',?,?,?, ?,?,1)`
  ).run(
    draftId,
    userId,
    "asset_photo_voice_reply",
    "asset_audio_voice_reply",
    "transcript_voice_reply_001",
    now,
    now
  );

  for (const asset of [
    {
      id: "asset_photo_voice_reply",
      role: "original_photo",
      key: `drafts/${draftId}/photo`,
      type: "image/png",
      sha: "a".repeat(64),
      duration: null
    },
    {
      id: "asset_audio_voice_reply",
      role: "original_audio",
      key: `drafts/${draftId}/audio`,
      type: "audio/webm",
      sha: "b".repeat(64),
      duration: 1200
    }
  ] as const) {
    d1.database.prepare(
      `INSERT INTO media_assets (
        id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,
        duration_ms,sha256,r2_etag,durability_status,created_by_user_id,created_at
      ) VALUES (?,?,?,?,?,?,12,?,?,?,'durable',?,?)`
    ).run(
      asset.id,
      draftId,
      draftId,
      asset.role,
      asset.key,
      asset.type,
      asset.duration,
      asset.sha,
      `etag-${asset.id}`,
      userId,
      now
    );
  }

  d1.database.prepare(
    `INSERT INTO transcript_revisions (
      id,memory_story_id,source_audio_asset_id,parent_revision_id,
      revision_kind,text,locale,created_by_type,created_by_user_id,
      model_config_version,created_at
    ) VALUES (?,?,?,NULL,'machine_transcript',?,'en-US','machine',NULL,'test-model',?)`
  ).run(
    "transcript_voice_reply_001",
    draftId,
    "asset_audio_voice_reply",
    "I remember everyone gathering around Abuela's table.",
    now
  );

  d1.database.prepare(
    `INSERT INTO muse_conversation_turns (
      id,memory_story_id,turn_index,speaker,content,focus_kind,response_state,
      source_ref,model_config_version,prompt_version,created_by_user_id,created_at
    ) VALUES (?, ?, 0, 'muse', ?, 'detail', NULL, ?, 'test-model', 'story-elicitor-v1', NULL, ?)`
  ).run(
    museTurnId,
    draftId,
    "What detail from that gathering comes back most clearly?",
    "transcript:transcript_voice_reply_001",
    now
  );
}

function cookieHeader(cookie: string): string {
  return cookie.split(";", 1)[0] ?? cookie;
}

function uploadRequest(cookie: string): Request {
  return new Request(
    `https://example.test/resources/drafts/${draftId}/muse-voice-replies/${voiceAssetId}`,
    {
      method: "PUT",
      body: audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength
      ) as ArrayBuffer,
      headers: {
        Cookie: cookie,
        Origin: "https://example.test",
        "Content-Type": "audio/webm",
        "X-Audio-Duration-MS": "1800",
        "X-Content-Length": String(audio.byteLength),
        "X-Content-SHA256": digest(audio),
        "X-Idempotency-Key": "upload_muse_voice_reply_001",
        "X-Memories-Request": "muse-voice-reply-v1",
        "X-Reply-To-Turn-ID": museTurnId
      }
    }
  );
}

describe("Muse spoken reply durability and recovery", () => {
  let d1: TestD1;
  let r2: TestR2;
  let cookie: string;
  let env: MuseVoiceReplyEnv & MuseConversationEnv;

  beforeEach(async () => {
    d1 = new TestD1();
    r2 = new TestR2();
    seed(d1);
    env = {
      DB: d1 as unknown as D1Database,
      MEDIA_BUCKET: r2 as unknown as R2Bucket,
      SESSION_SECRET: sessionSecret,
      ELEVENLABS_API_KEY: "test-elevenlabs-key",
      AI: {
        run: async () => ({
          response: JSON.stringify({
            question: "Who do you remember being there with you?",
            focus: "person"
          })
        })
      } as unknown as Ai
    };
    cookie = cookieHeader((await createAppSession(env, userId)).cookie);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the preserved voice through transcription failure, retries it, and attaches it to the conversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("provider unavailable", { status: 503 })
      )
    );

    const first = await handleMuseVoiceReplyRoute(
      uploadRequest(cookie),
      env
    );
    expect(first?.status).toBe(202);
    const firstBody = await first?.json() as {
      state: string;
      voiceReply: { durabilityStatus: string; transcript: string | null };
    };
    expect(firstBody.state).toBe("transcription_pending");
    expect(firstBody.voiceReply.durabilityStatus).toBe("durable");
    expect(firstBody.voiceReply.transcript).toBeNull();
    expect(r2.objects.size).toBe(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          text: "I remember the red pot on the stove.",
          language_code: "eng",
          language_probability: 0.99
        })
      )
    );

    const retried = await handleMuseVoiceReplyRoute(
      new Request(
        `https://example.test/resources/drafts/${draftId}/muse-voice-replies/${voiceAssetId}`,
        {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "https://example.test",
            "X-Memories-Request": "muse-voice-reply-v1"
          }
        }
      ),
      env
    );
    expect(retried?.status).toBe(200);
    const retriedBody = await retried?.json() as {
      state: string;
      voiceReply: { transcript: string; assetId: string };
    };
    expect(retriedBody.state).toBe("ready");
    expect(retriedBody.voiceReply.transcript).toBe(
      "I remember the red pot on the stove."
    );
    expect(r2.objects.size).toBe(1);

    const conversation = await handleMuseConversationRoute(
      new Request(
        `https://example.test/resources/drafts/${draftId}/muse-conversation`,
        {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "https://example.test",
            "Content-Type": "application/json",
            "X-Memories-Request": "muse-conversation-v1"
          },
          body: JSON.stringify({
            replyToTurnId: museTurnId,
            answer: "I remember the bright red pot on the stove.",
            state: "stated",
            voiceReplyAssetId: voiceAssetId
          })
        }
      ),
      env
    );
    expect(conversation?.status).toBe(200);
    const conversationBody = await conversation?.json() as {
      turns: Array<{
        speaker: string;
        content: string;
        voiceReplyAssetId: string | null;
        voiceReplyMediaUrl: string | null;
      }>;
    };
    const storytellerTurn = conversationBody.turns.find(
      (turn) => turn.speaker === "storyteller"
    );
    expect(storytellerTurn).toMatchObject({
      content: "I remember the bright red pot on the stove.",
      voiceReplyAssetId: voiceAssetId
    });
    expect(
      d1.database.prepare(
        `SELECT transcript_text, storyteller_text, storyteller_confirmed_at
         FROM muse_voice_reply_assets WHERE id = ?`
      ).get(voiceAssetId)
    ).toMatchObject({
      transcript_text: "I remember the red pot on the stove.",
      storyteller_text: "I remember the bright red pot on the stove."
    });
    expect(
      d1.database.prepare(
        "SELECT storyteller_confirmed_at FROM muse_voice_reply_assets WHERE id = ?"
      ).get(voiceAssetId)
    ).not.toEqual({ storyteller_confirmed_at: null });
    expect(storytellerTurn?.voiceReplyMediaUrl).toContain(
      `/muse-voice-replies/${voiceAssetId}/media`
    );

    const playback = await handleMuseVoiceReplyRoute(
      new Request(
        `https://example.test/resources/drafts/${draftId}/muse-voice-replies/${voiceAssetId}/media`,
        {
          headers: { Cookie: cookie }
        }
      ),
      env
    );
    expect(playback?.status).toBe(200);
    expect(
      Buffer.from(await playback!.arrayBuffer()).equals(Buffer.from(audio))
    ).toBe(true);
  });
});
