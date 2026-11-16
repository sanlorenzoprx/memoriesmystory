/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { handleDeletionRoute, type DeletionEnv } from "../../worker/deletion";
import { phase1Config } from "../../config/phase-1";
import { summarizeLedger, type LedgerEntry } from "../../app/domain/entitlement";

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
      "0005_memory_deletion.sql",
      "0006_muse_conversation.sql",
      "0007_muse_voice_replies.sql",
      "0008_storyteller_review.sql"
    ,
      "0010_legacy_sessions.sql",
      "0011_legacy_recordings.sql",
      "0012_legacy_remote_calls.sql",
      "0013_remote_recording_sources.sql",
      "0014_private_family_chapters.sql",
      "0015_human_people.sql",
      "0016_scoped_family_access.sql",
      "0017_attributed_family_contributions.sql",
      "0018_family_voice_contributions.sql",
      "0019_family_photo_contributions.sql",
      "0020_family_voice_written_words.sql",
      "0021_family_album_permissions.sql",
      "0025_fixity_checks.sql",
      "0030_entitlement_ledger.sql",
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

afterEach(() => {
  (phase1Config.entitlements as { deletionReturnsCapacity: boolean }).deletionReturnsCapacity = true;
});

describe("Living Memory deletion", () => {
  for (const returnsCapacity of [true, false])
  it(`removes media and connected records while keeping a minimal receipt (deletion ${returnsCapacity ? "returns" : "keeps"} capacity)`, async () => {
    // The stated deletion policy decides; the ledger records what it did.
    (phase1Config.entitlements as { deletionReturnsCapacity: boolean }).deletionReturnsCapacity = returnsCapacity;
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
      `INSERT INTO muse_conversation_turns (
        id,memory_story_id,turn_index,speaker,content,focus_kind,response_state,
        source_ref,model_config_version,prompt_version,created_by_user_id,created_at
      ) VALUES ('muse_turn_delete_001',?,0,'muse','What do you remember?','detail',NULL,
        'transcript:test','test-model','story-elicitor-v1',NULL,?)`
    ).run(draftId, now);
    d1.database.prepare(
      `INSERT INTO muse_voice_reply_assets (
        id,memory_story_id,reply_to_turn_id,r2_key,content_type,byte_size,duration_ms,
        sha256,r2_etag,durability_status,transcript_text,transcript_locale,
        transcription_model_config_version,created_by_user_id,created_at,transcribed_at
      ) VALUES (
        'muse_voice_delete_001',?,'muse_turn_delete_001',?,'audio/webm',12,1200,?,
        'etag-muse-voice','durable','A preserved spoken reply.','eng',
        'test-model',?,?,?
      )`
    ).run(
      draftId,
      `stories/${draftId}/muse-voice/muse_voice_delete_001/original.webm`,
      "c".repeat(64),
      userId,
      now,
      now
    );

    d1.database.prepare(
      `INSERT INTO operation_receipts (
        idempotency_key,operation_kind,scope_type,scope_id,request_hash,
        status,result_ref,correlation_id,created_at,updated_at
      ) VALUES (
        'delete-test-voice-op','upload_muse_voice_reply','asset','muse_voice_delete_001',?,
        'succeeded','muse_voice_delete_001','cor-delete-voice',?,?
      )`
    ).run("d".repeat(64), now, now);

    d1.database.prepare(
      "UPDATE memory_stories SET status='complete', completed_at=?, updated_at=? WHERE id=?"
    ).run(now, now, draftId);
    expect(
      d1.database.prepare("SELECT free_stories_completed AS n FROM story_entitlements WHERE user_id = ?").get(userId)
    ).toEqual({ n: 1 });

    // Integrity history for this memory's media, plus another account's row that must stay.
    for (const [id, source] of [["fixity_delete_photo", "asset_delete_photo"], ["fixity_delete_reply", "muse_voice_delete_001"], ["fixity_keep_other", "asset_someone_else"]])
      d1.database.prepare(
        "INSERT INTO fixity_checks(id,source_kind,source_id,outcome,expected_sha256,observed_sha256,observed_byte_size,checked_at) VALUES(?,'asset',?,'match',?,?,10,?)"
      ).run(id, source, "a".repeat(64), "a".repeat(64), now);

    const env: DeletionEnv = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: secret,
      MEDIA_BUCKET: { delete: async (key: string) => { removed.push(key); }, list: async () => ({ objects: [], truncated: false }) } as unknown as R2Bucket
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
    expect(removed.sort()).toEqual([
      `drafts/${draftId}/audio`,
      `drafts/${draftId}/photo`,
      `stories/${draftId}/muse-voice/muse_voice_delete_001/original.webm`
    ].sort());
    expect(d1.database.prepare("SELECT count(*) AS n FROM memory_story_drafts WHERE id = ?").get(draftId)).toEqual({ n: 0 });
    expect(d1.database.prepare("SELECT count(*) AS n FROM memory_stories WHERE id = ?").get(draftId)).toEqual({ n: 0 });
    expect(d1.database.prepare("SELECT count(*) AS n FROM media_assets WHERE draft_id = ?").get(draftId)).toEqual({ n: 0 });
    const ledger = d1.database.prepare("SELECT entry_kind,granted,used_delta,policy_version FROM entitlement_ledger WHERE user_id=? ORDER BY rowid").all(userId) as LedgerEntry[];
    expect(ledger.map((entry) => entry.entry_kind)).toEqual([
      "grant",
      "memory_completed",
      returnsCapacity ? "memory_deleted_capacity_returned" : "memory_deleted_capacity_kept",
    ]);
    // The ledger and the enforcement counter agree.
    const counter = d1.database.prepare("SELECT free_stories_unlocked AS unlocked, free_stories_completed AS completed FROM story_entitlements WHERE user_id=?").get(userId) as { unlocked: number; completed: number };
    expect(summarizeLedger(ledger)).toEqual({ granted: counter.unlocked, used: counter.completed, remaining: counter.unlocked - counter.completed });
    expect(counter.completed).toBe(returnsCapacity ? 0 : 1);
    // No hash of the deleted media is kept in integrity history.
    expect(d1.database.prepare("SELECT id FROM fixity_checks").all()).toEqual([{ id: "fixity_keep_other" }]);
    expect(d1.database.prepare("SELECT count(*) AS n FROM muse_voice_reply_assets WHERE memory_story_id = ?").get(draftId)).toEqual({ n: 0 });
    expect(d1.database.prepare("SELECT count(*) AS n FROM operation_receipts WHERE scope_id = 'muse_voice_delete_001'").get()).toEqual({ n: 0 });
    expect(d1.database.prepare("SELECT actor_type, deleted_asset_count FROM deletion_receipts WHERE draft_id = ?").get(draftId))
      .toEqual({ actor_type: "owner", deleted_asset_count: 3 });
    expect(
      d1.database.prepare("SELECT free_stories_completed AS n FROM story_entitlements WHERE user_id = ?").get(userId)
    ).toEqual({ n: returnsCapacity ? 0 : 1 });
  });
});
