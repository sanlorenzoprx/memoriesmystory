/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { handleDeletionRoute, type DeletionEnv } from "../../worker/deletion";

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
      "0005_memory_deletion.sql"
    ]) {
      this.database.exec(readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
    }
  }
  prepare(query: string) { return new Statement(this.database, query); }
  async batch<T>(statements: readonly Statement[]): Promise<D1Result<T>[]> {
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

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("Living Memory deletion", () => {
  it("removes media and connected records while keeping a minimal receipt", async () => {
    const d1 = new TestD1();
    const removed: string[] = [];
    const secret = "s".repeat(40);
    const token = "t".repeat(40);
    const draftId = "draft_delete_001";
    const userId = "user_delete_001";
    const now = "2026-09-23T12:00:00.000Z";

    d1.database.prepare(
      "INSERT INTO users (id,email,created_at,updated_at) VALUES (?,?,?,?)"
    ).run(userId, "delete@example.test", now, now);
    d1.database.prepare(
      "INSERT INTO user_sessions (id,user_id,token_hash,expires_at,revoked_at,created_at) VALUES (?,?,?,?,NULL,?)"
    ).run("session_delete_001", userId, digest(`${secret}:${token}`), "2099-01-01T00:00:00.000Z", now);
    d1.database.prepare(
      "INSERT INTO story_entitlements (user_id,plan,free_story_limit,free_stories_unlocked,free_stories_completed,paid_story_capacity,updated_at) VALUES (?,'free',1,1,0,0,?)"
    ).run(userId, now);
    d1.database.prepare(
      "INSERT INTO memory_story_drafts (id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at,version) VALUES (?,?,'originals_durable','en-US',?,?,'2099-01-01T00:00:00.000Z',3)"
    ).run(draftId, userId, now, now);
    d1.database.prepare(
      "INSERT INTO memory_stories (id,owner_user_id,status,visibility,primary_photo_asset_id,primary_audio_asset_id,created_at,updated_at,version) VALUES (?,?,'draft','private','asset_delete_photo','asset_delete_audio',?,?,1)"
    ).run(draftId, userId, now, now);

    for (const [id, role, key, hash] of [
      ["asset_delete_photo", "original_photo", `drafts/${draftId}/photo`, "a".repeat(64)],
      ["asset_delete_audio", "original_audio", `drafts/${draftId}/audio`, "b".repeat(64)]
    ]) {
      d1.database.prepare(
        "INSERT INTO media_assets (id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,duration_ms,sha256,r2_etag,durability_status,created_by_user_id,created_at) VALUES (?,?,?,?,?,'application/octet-stream',10,NULL,?,'etag','durable',?,?)"
      ).run(id, draftId, draftId, role, key, hash, userId, now);
    }

    d1.database.prepare(
      "UPDATE memory_stories SET status='complete', completed_at=?, updated_at=? WHERE id=?"
    ).run(now, now, draftId);
    expect(
      d1.database.prepare("SELECT free_stories_completed AS n FROM story_entitlements WHERE user_id = ?").get(userId)
    ).toEqual({ n: 1 });

    const env: DeletionEnv = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: secret,
      MEDIA_BUCKET: { delete: async (key: string) => { removed.push(key); } } as unknown as R2Bucket
    };

    const response = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${draftId}`, {
        method: "DELETE",
        headers: {
          Cookie: `memories_session=${token}`,
          Origin: "https://example.test",
          "X-Memories-Request": "deletion-v1"
        }
      }),
      env
    );

    expect(response?.status).toBe(200);
    expect(removed).toHaveLength(2);
    expect(d1.database.prepare("SELECT count(*) AS n FROM memory_story_drafts WHERE id = ?").get(draftId)).toEqual({ n: 0 });
    expect(d1.database.prepare("SELECT count(*) AS n FROM memory_stories WHERE id = ?").get(draftId)).toEqual({ n: 0 });
    expect(d1.database.prepare("SELECT count(*) AS n FROM media_assets WHERE draft_id = ?").get(draftId)).toEqual({ n: 0 });
    expect(d1.database.prepare("SELECT actor_type, deleted_asset_count FROM deletion_receipts WHERE draft_id = ?").get(draftId))
      .toEqual({ actor_type: "owner", deleted_asset_count: 2 });
    expect(
      d1.database.prepare("SELECT free_stories_completed AS n FROM story_entitlements WHERE user_id = ?").get(userId)
    ).toEqual({ n: 0 });
  });
});
