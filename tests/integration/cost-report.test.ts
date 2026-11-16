import { describe, expect, it } from "vitest";
import { TestD1 } from "../helpers/legacy-runtime";
// @ts-expect-error -- plain ESM script with no type declarations
import { buildCostReport } from "../../scripts/cost-report.mjs";

type Report = {
  completedMemories: number;
  totals: Record<string, number>;
  emails: Record<string, number>;
  estimatedUsd: { memories: number | null; emails: number | null };
  memories: { memory: string; units: Record<string, number>; estimatedUsd: number | null }[];
};

function fixture() {
  const db = new TestD1().database,
    t = "2026-11-10T00:00:00.000Z",
    owner = "owner_cost";
  db.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run(owner, t, t);
  db.prepare("INSERT INTO story_entitlements(user_id,free_story_limit,free_stories_unlocked,updated_at) VALUES(?,3,3,?)").run(owner, t);
  for (const [memory, audioMs, completed] of [["memory_cost_a", 90_000, "2026-11-10T01:00:00.000Z"], ["memory_cost_b", 30_000, "2026-11-12T01:00:00.000Z"], ["memory_cost_old", 60_000, "2026-10-01T01:00:00.000Z"]] as const) {
    db.prepare("INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,'complete','en-US',?,?,'2099-01-01T00:00:00Z')").run(memory, owner, t, t);
    db.prepare("INSERT INTO memory_stories(id,owner_user_id,status,created_at,updated_at) VALUES(?,?,'draft',?,?)").run(memory, owner, t, t);
    db.prepare("INSERT INTO media_assets(id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,duration_ms,sha256,r2_etag,durability_status,created_at) VALUES(?,?,?,'original_photo',?,'image/png',1000000,NULL,?,'e','durable',?)").run(`${memory}_p`, memory, memory, `${memory}_p`, "a".repeat(64), t);
    db.prepare("INSERT INTO media_assets(id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,duration_ms,sha256,r2_etag,durability_status,created_at) VALUES(?,?,?,'original_audio',?,'audio/webm',500000,?,?,'e','durable',?)").run(`${memory}_a`, memory, memory, `${memory}_a`, audioMs, "b".repeat(64), t);
    db.prepare("UPDATE memory_stories SET status='complete',completed_at=?,primary_photo_asset_id=?,primary_audio_asset_id=? WHERE id=?").run(completed, `${memory}_p`, `${memory}_a`, memory);
    db.prepare("INSERT INTO transcript_revisions(id,memory_story_id,source_audio_asset_id,revision_kind,text,locale,created_by_type,created_at) VALUES(?,?,?,'machine_transcript','synthetic','en-US','machine',?)").run(`${memory}_t`, memory, `${memory}_a`, t);
  }
  // Two Muse model turns and one storyteller turn on memory A; one failed, retried upload.
  const turn = db.prepare("INSERT INTO muse_conversation_turns(id,memory_story_id,turn_index,speaker,content,model_config_version,created_at) VALUES(?,?,?,?,?,?,?)");
  turn.run("turn_cost_1", "memory_cost_a", 0, "muse", "Who is in the photograph?", "model-v1", t);
  turn.run("turn_cost_2", "memory_cost_a", 1, "storyteller", "My grandmother.", null, t);
  turn.run("turn_cost_3", "memory_cost_a", 2, "muse", "Where was it taken?", "model-v1", t);
  db.prepare("INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,correlation_id,created_at,updated_at) VALUES('k1','upload','draft','memory_cost_a',?,'failed','c',?,?)").run("c".repeat(64), t, t);
  db.prepare("INSERT INTO owner_reminders(id,user_id,sent_month,status,code,created_at) VALUES('r1',?,'2026-11','sent',NULL,'2026-11-11T00:00:00.000Z')").run(owner);
  return db;
}

describe("cost metering report (H01)", () => {
  it("reconciles per-memory units and totals with the fixture, for the chosen period only", () => {
    const report = buildCostReport(fixture(), { from: "2026-11-01", to: "2026-12-01", rates: {} }) as Report;
    expect(report.completedMemories).toBe(2);
    expect(report.memories.map((m) => m.units)).toEqual([
      { storedBytes: 1_500_000, recordedAudioMinutes: 1.5, machineTranscripts: 1, museModelCalls: 2, voiceReplies: 0, voiceReplyMinutes: 0, sharedConversations: 0, inPersonRecordingMinutes: 0, failedOperations: 1 },
      { storedBytes: 1_500_000, recordedAudioMinutes: 0.5, machineTranscripts: 1, museModelCalls: 0, voiceReplies: 0, voiceReplyMinutes: 0, sharedConversations: 0, inPersonRecordingMinutes: 0, failedOperations: 0 },
    ]);
    expect(report.totals).toMatchObject({ storedBytes: 3_000_000, recordedAudioMinutes: 2, museModelCalls: 2, machineTranscripts: 2, failedOperations: 1 });
    expect(report.emails).toEqual({ familyInvitations: 0, familyUpdateNotices: 0, ownerReminders: 1 });
    // Memories appear only as short one-way ids.
    expect(JSON.stringify(report)).not.toContain("memory_cost");
    expect(report.memories[0]!.memory).toMatch(/^[a-f0-9]{12}$/);
  });

  it("shows a cost only when every needed rate is set, never a partial total", () => {
    const partial = buildCostReport(fixture(), { from: "2026-11-01", to: "2026-12-01", rates: { storageGbMonth: 0.015 } }) as Report;
    expect(partial.estimatedUsd).toEqual({ memories: null, emails: null });
    const priced = buildCostReport(fixture(), {
      from: "2026-11-01",
      to: "2026-12-01",
      rates: { storageGbMonth: 1, transcriptionAudioMinute: 0.01, museModelCall: 0.002, voiceReplyTranscriptionMinute: 0.01, remoteRecordingMinute: 0.004, emailMessage: 0.001 },
    }) as Report;
    // A: 0.0015 + 0.015 + 0.004 = 0.0205 → 0.021 (rounded); B: 0.0015 + 0.005 = 0.0065 → 0.007
    expect(priced.memories.map((m) => m.estimatedUsd)).toEqual([0.021, 0.007]);
    expect(priced.estimatedUsd).toEqual({ memories: 0.028, emails: 0.001 });
  });
});
