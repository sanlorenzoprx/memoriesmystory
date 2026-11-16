// Cost metering report (H01, lane L5.1).
//
// Reads a copy of the D1 database on the operator's machine and reports, per
// completed Living Memory, the units that cost money: stored bytes, recorded
// audio minutes, model calls, voice-reply minutes, shared-conversation
// minutes and failed (retried) operations; plus emails by purpose. A cost is
// shown only for units whose rate is set in config/cost-rates.json. Nothing
// leaves the machine, and memories appear only as short one-way ids.
//
// Usage:
//   npx wrangler d1 export memoriesmystory --remote --output=d1.sql
//   node scripts/cost-report.mjs d1.sql [--from=2026-11-01] [--to=2026-12-01] [--json]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const one = (database, sql, ...values) => database.prepare(sql).get(...values) ?? {};
const short = (id) => createHash("sha256").update(id).digest("hex").slice(0, 12);

/** Per-memory units for memories completed in [from, to). */
export function buildCostReport(database, { from = "0000", to = "9999", rates = {} } = {}) {
  const memories = database
    .prepare("SELECT id,completed_at FROM memory_stories WHERE status='complete' AND completed_at>=? AND completed_at<? ORDER BY completed_at,id")
    .all(from, to);
  const rows = memories.map(({ id, completed_at }) => {
    const media = one(database, "SELECT COALESCE(sum(byte_size),0) AS bytes, COALESCE(sum(CASE WHEN role='original_audio' THEN duration_ms END),0) AS audioMs FROM media_assets WHERE memory_story_id=?", id);
    const replies = one(database, "SELECT count(*) AS n, COALESCE(sum(byte_size),0) AS bytes, COALESCE(sum(duration_ms),0) AS ms FROM muse_voice_reply_assets WHERE memory_story_id=? AND durability_status='durable'", id);
    const family = one(database, "SELECT COALESCE((SELECT sum(v.byte_size) FROM family_contribution_voice_sources v JOIN family_contributions c ON c.id=v.contribution_id WHERE c.memory_story_id=?1),0)+COALESCE((SELECT sum(p.byte_size) FROM family_contribution_photo_sources p JOIN family_contributions c ON c.id=p.contribution_id WHERE c.memory_story_id=?1),0) AS bytes", id);
    const inPerson = one(database, "SELECT COALESCE(sum(m.byte_size),0) AS bytes, COALESCE(sum(m.duration_ms),0) AS ms FROM legacy_recording_media m JOIN legacy_recordings r ON r.id=m.recording_id JOIN legacy_sessions s ON s.id=r.session_id WHERE s.memory_story_id=? AND m.durability_status='durable'", id);
    const remote = one(database, "SELECT COALESCE(sum(x.byte_size),0) AS bytes FROM legacy_remote_sources x JOIN legacy_remote_recordings r ON r.id=x.recording_id JOIN legacy_sessions s ON s.id=r.session_id WHERE s.memory_story_id=? AND x.durability_status='durable'", id);
    const sessions = one(database, "SELECT count(*) AS n FROM legacy_sessions WHERE memory_story_id=?", id);
    const transcripts = one(database, "SELECT count(*) AS n FROM transcript_revisions WHERE memory_story_id=? AND created_by_type='machine'", id);
    const muse = one(database, "SELECT count(*) AS n FROM muse_conversation_turns WHERE memory_story_id=? AND speaker='muse' AND model_config_version IS NOT NULL", id);
    const retries = one(database, "SELECT count(*) AS n FROM operation_receipts WHERE status='failed' AND scope_id IN (?1,(SELECT draft_id FROM media_assets WHERE memory_story_id=?1 LIMIT 1))", id);
    const units = {
      storedBytes: media.bytes + replies.bytes + family.bytes + inPerson.bytes + remote.bytes,
      recordedAudioMinutes: round(media.audioMs / 60000),
      machineTranscripts: transcripts.n,
      museModelCalls: muse.n,
      voiceReplies: replies.n,
      voiceReplyMinutes: round(replies.ms / 60000),
      sharedConversations: sessions.n,
      inPersonRecordingMinutes: round(inPerson.ms / 60000),
      failedOperations: retries.n,
    };
    return { memory: short(id), completedAt: completed_at, units, estimatedUsd: estimate(units, rates) };
  });
  const emails = Object.fromEntries(
    [
      ["familyInvitations", "SELECT count(*) AS n FROM email_deliveries WHERE purpose='family_invitation' AND status='sent' AND created_at>=? AND created_at<?"],
      ["familyUpdateNotices", "SELECT count(*) AS n FROM family_update_notices WHERE status='sent' AND created_at>=? AND created_at<?"],
      ["ownerReminders", "SELECT count(*) AS n FROM owner_reminders WHERE status='sent' AND created_at>=? AND created_at<?"],
    ].map(([name, sql]) => [name, one(database, sql, from, to).n ?? 0]),
  );
  const emailTotal = emails.familyInvitations + emails.familyUpdateNotices + emails.ownerReminders;
  const totals = rows.reduce(
    (sum, row) => {
      for (const [key, value] of Object.entries(row.units)) sum[key] = round((sum[key] ?? 0) + value);
      return sum;
    },
    {},
  );
  return {
    period: { from, to },
    completedMemories: rows.length,
    totals,
    emails,
    estimatedUsd: {
      memories: rows.every((row) => row.estimatedUsd !== null) && rows.length ? round(rows.reduce((sum, row) => sum + row.estimatedUsd, 0)) : null,
      emails: typeof rates.emailMessage === "number" ? round(emailTotal * rates.emailMessage) : null,
    },
    notMeasured: [
      "Muse speech synthesis calls (not recorded per call)",
      "Exports (built on the person's device; only file reads reach the Worker)",
      "Remote shared-conversation minutes (provider usage is billed by RealtimeKit)",
      "Worker requests and D1 reads",
    ],
    memories: rows,
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/** Null unless every unit that has a rate key is priced: never a partial total that looks whole. */
function estimate(units, rates) {
  const parts = [
    [rates.storageGbMonth, units.storedBytes / 1e9],
    [rates.transcriptionAudioMinute, units.recordedAudioMinutes],
    [rates.museModelCall, units.museModelCalls],
    [rates.voiceReplyTranscriptionMinute, units.voiceReplyMinutes],
    [rates.remoteRecordingMinute, units.inPersonRecordingMinutes],
  ];
  if (parts.some(([rate]) => typeof rate !== "number")) return null;
  return round(parts.reduce((sum, [rate, quantity]) => sum + rate * quantity, 0));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) {
    console.error("Usage: node scripts/cost-report.mjs <d1-export.sql> [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--json]");
    process.exit(2);
  }
  const option = (name) => flags.find((flag) => flag.startsWith(`--${name}=`))?.split("=")[1];
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync(file, "utf8"));
  const rates = JSON.parse(readFileSync(new URL("../config/cost-rates.json", import.meta.url), "utf8"));
  const report = buildCostReport(database, { from: option("from"), to: option("to"), rates });
  if (flags.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Completed memories: ${report.completedMemories} (${report.period.from} to ${report.period.to})`);
    for (const [key, value] of Object.entries(report.totals)) console.log(`  ${key}: ${value}`);
    console.log(`Emails sent: ${JSON.stringify(report.emails)}`);
    console.log(`Estimated USD: memories ${report.estimatedUsd.memories ?? "rates not set"}, emails ${report.estimatedUsd.emails ?? "rate not set"}`);
    console.log(`Not measured: ${report.notMeasured.join("; ")}`);
  }
}
