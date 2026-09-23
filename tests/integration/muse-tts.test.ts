/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleMuseTtsRoute, type MuseTtsEnv } from "../../worker/muse-tts";

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    readonly query: string,
    readonly values: readonly SQLInputValue[] = []
  ) {}
  bind(...values: SQLInputValue[]) { return new Statement(this.db, this.query, values); }
  private prepared(): StatementSync { return this.db.prepare(this.query); }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.prepared().get(...this.values) as T | undefined) ?? null;
  }
}

class TestD1 {
  readonly database = new DatabaseSync(":memory:");
  constructor() {
    this.database.exec(
      readFileSync(new URL("../../migrations/0001_phase_1_foundation.sql", import.meta.url), "utf8")
    );
  }
  prepare(query: string) { return new Statement(this.database, query); }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("Muse TTS boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires the anonymous draft token before calling ElevenLabs", async () => {
    const d1 = new TestD1();
    const draftId = "draft_muse_tts_001";
    const draftToken = "d".repeat(48);
    d1.database.prepare(
      "INSERT INTO memory_story_drafts (id,anonymous_identity_hash,status,ui_locale,created_at,updated_at,expires_at,version) VALUES (?,?,'local_draft','en-US','2026-09-23T00:00:00Z','2026-09-23T00:00:00Z','2099-01-01T00:00:00Z',1)"
    ).run(draftId, digest(draftToken));

    const providerFetch = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" }
      })
    );
    vi.stubGlobal("fetch", providerFetch);

    const env: MuseTtsEnv = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: "s".repeat(40),
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_MUSE_VOICE_ID: "voice-test"
    };

    const denied = await handleMuseTtsRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/muse-tts`, {
        method: "POST",
        headers: {
          Origin: "https://example.test",
          "Content-Type": "application/json",
          "X-Memories-Request": "muse-tts-v1"
        },
        body: JSON.stringify({ text: "Would you like help remembering?" })
      }),
      env
    );
    expect(denied?.status).toBe(403);
    expect(providerFetch).not.toHaveBeenCalled();

    const allowed = await handleMuseTtsRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/muse-tts`, {
        method: "POST",
        headers: {
          Origin: "https://example.test",
          "Content-Type": "application/json",
          "X-Memories-Request": "muse-tts-v1",
          "X-Draft-Token": draftToken
        },
        body: JSON.stringify({ text: "Would you like help remembering?" })
      }),
      env
    );
    expect(allowed?.status).toBe(200);
    expect(allowed?.headers.get("Content-Type")).toContain("audio/mpeg");
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a Muse voice is not configured", async () => {
    const d1 = new TestD1();
    const draftId = "draft_muse_tts_002";
    const draftToken = "e".repeat(48);
    d1.database.prepare(
      "INSERT INTO memory_story_drafts (id,anonymous_identity_hash,status,ui_locale,created_at,updated_at,expires_at,version) VALUES (?,?,'local_draft','en-US','2026-09-23T00:00:00Z','2026-09-23T00:00:00Z','2099-01-01T00:00:00Z',1)"
    ).run(draftId, digest(draftToken));

    const response = await handleMuseTtsRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/muse-tts`, {
        method: "POST",
        headers: {
          Origin: "https://example.test",
          "Content-Type": "application/json",
          "X-Memories-Request": "muse-tts-v1",
          "X-Draft-Token": draftToken
        },
        body: JSON.stringify({ text: "Muse remembers with you." })
      }),
      {
        DB: d1 as unknown as D1Database,
        SESSION_SECRET: "s".repeat(40),
        ELEVENLABS_API_KEY: "test-key"
      }
    );

    expect(response?.status).toBe(503);
    expect(await response?.json()).toMatchObject({
      error: { code: "muse_tts_not_configured" }
    });
  });
});
