/// <reference types="@cloudflare/workers-types" />

import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TranscriptionQueueMessage } from "../../app/domain";
import { createAppSession } from "../../worker/auth-session";
import {
  handleTranscriptionRoute,
  processTranscriptionBatch,
  processTranscriptionMessage,
  type TranscriptionEnv
} from "../../worker/transcription";

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

class TestQueue {
  readonly bodies: TranscriptionQueueMessage[] = [];

  async send(body: TranscriptionQueueMessage): Promise<void> {
    this.bodies.push(body);
  }
}

class TestR2 {
  constructor(private readonly audio: Uint8Array) {}

  async get(key: string): Promise<R2ObjectBody | null> {
    if (key !== "drafts/draft_transcription_001/audio") return null;
    const bytes = this.audio;
    return {
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    } as R2ObjectBody;
  }
}

const userId = "user_transcription_001";
const draftId = "draft_transcription_001";
const sessionSecret = "transcription-test-session-secret-that-is-long-enough";
const audioSha = "b".repeat(64);

function seed(d1: TestD1): void {
  const now = "2026-09-22T12:00:00.000Z";
  d1.database.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(userId, "story@example.test", now, now);
  d1.database.prepare(
    `INSERT INTO memory_story_drafts (
      id, owner_user_id, anonymous_identity_hash, status, ui_locale, spoken_locale,
      created_at, updated_at, expires_at, version
    ) VALUES (?, ?, NULL, 'originals_durable', 'en-US', 'en-US', ?, ?, '9999-12-31T23:59:59.999Z', 1)`
  ).run(draftId, userId, now, now);
  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
      byte_size, duration_ms, sha256, r2_etag, durability_status, created_by_user_id, created_at
    ) VALUES (?, ?, NULL, 'original_photo', NULL, ?, 'image/jpeg', 10, NULL, ?, ?, 'durable', ?, ?)`
  ).run("asset_photo_transcription", draftId, `drafts/${draftId}/photo`, "a".repeat(64), "etag-photo", userId, now);
  d1.database.prepare(
    `INSERT INTO media_assets (
      id, draft_id, memory_story_id, role, source_asset_id, r2_key, content_type,
      byte_size, duration_ms, sha256, r2_etag, durability_status, created_by_user_id, created_at
    ) VALUES (?, ?, NULL, 'original_audio', NULL, ?, 'audio/webm', 12, 1200, ?, ?, 'durable', ?, ?)`
  ).run("asset_audio_transcription", draftId, `drafts/${draftId}/audio`, audioSha, "etag-audio", userId, now);
}

function cookieHeader(cookie: string): string {
  return cookie.split(";", 1)[0] ?? cookie;
}

function processRequest(cookie: string): Request {
  return new Request(`https://example.test/resources/drafts/${draftId}/process`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://example.test",
      "X-Memories-Request": "processing-v1",
      "X-Idempotency-Key": "process_transcription_001",
      "X-Spoken-Locale": "en-US"
    }
  });
}

describe("Living Memory transcription processing", () => {
  let d1: TestD1;
  let queue: TestQueue;
  let aiCalls: number;
  let env: TranscriptionEnv;
  let cookie: string;

  beforeEach(async () => {
    d1 = new TestD1();
    seed(d1);
    queue = new TestQueue();
    aiCalls = 0;
    env = {
      DB: d1 as unknown as D1Database,
      MEDIA_BUCKET: new TestR2(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3])) as unknown as R2Bucket,
      PROCESSING_QUEUE: queue as unknown as Queue<TranscriptionQueueMessage>,
      AI: {
        run: async () => {
          aiCalls += 1;
          return {
            text: "Abuela made arroz con gandules every Sunday.",
            transcription_info: { language: "en" }
          };
        }
      } as unknown as Ai,
      SESSION_SECRET: sessionSecret
    };
    cookie = cookieHeader((await createAppSession(env, userId)).cookie);
  });
  it("enqueues once and duplicate delivery converges to one transcript", async () => {
    const first = await handleTranscriptionRoute(processRequest(cookie), env);
    expect(first?.status).toBe(202);
    expect(queue.bodies).toHaveLength(1);

    const replay = await handleTranscriptionRoute(processRequest(cookie), env);
    expect(replay?.status).toBe(202);
    expect((await replay?.json() as { replayed: boolean }).replayed).toBe(true);
    expect(queue.bodies).toHaveLength(1);

    const message = queue.bodies[0]!;
    const firstTranscriptId = await processTranscriptionMessage(env, message);
    const replayTranscriptId = await processTranscriptionMessage(env, message);

    expect(replayTranscriptId).toBe(firstTranscriptId);
    expect(aiCalls).toBe(1);
    expect(
      d1.database.prepare("SELECT count(*) AS count FROM transcript_revisions").get()
    ).toEqual({ count: 1 });

    const status = await handleTranscriptionRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/process`, {
        headers: { Cookie: cookie }
      }),
      env
    );
    expect(status?.status).toBe(200);
    const body = await status?.json() as {
      state: string;
      transcript: { text: string; sourceAudioAssetId: string };
    };
    expect(body.state).toBe("ready");
    expect(body.transcript.text).toContain("Abuela");
    expect(body.transcript.sourceAudioAssetId).toBe("asset_audio_transcription");
  });

  it("keeps durable originals intact when Workers AI fails and marks the job retryable", async () => {
    await handleTranscriptionRoute(processRequest(cookie), env);
    const body = queue.bodies[0]!;
    env = {
      ...env,
      AI: { run: async () => { throw new Error("synthetic Workers AI outage"); } } as unknown as Ai
    };

    const retry = vi.fn();
    const ack = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const batch = {
      queue: "memoriesmystory-processing",
      messages: [{
        id: "message-1",
        timestamp: new Date(),
        body,
        attempts: 1,
        ack,
        retry
      }]
    } as unknown as MessageBatch<TranscriptionQueueMessage>;

    await processTranscriptionBatch(batch, env);

    expect(retry).toHaveBeenCalledOnce();
    expect(ack).not.toHaveBeenCalled();
    expect(
      d1.database.prepare(
        "SELECT status FROM operation_receipts WHERE idempotency_key = 'process_transcription_001'"
      ).get()
    ).toEqual({ status: "failed" });
    expect(
      d1.database.prepare(
        "SELECT role, durability_status, sha256 FROM media_assets ORDER BY role"
      ).all()
    ).toEqual([
      { role: "original_audio", durability_status: "durable", sha256: audioSha },
      { role: "original_photo", durability_status: "durable", sha256: "a".repeat(64) }
    ]);
  });
});
