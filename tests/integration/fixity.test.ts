/// <reference types="@cloudflare/workers-types" />
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TestD1, TestR2 } from "../helpers/legacy-runtime";
import { runFixityPass } from "../../worker/fixity";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function setup() {
  const db = new TestD1(),
    bucket = new TestR2(),
    now = "2026-11-16T00:00:00.000Z",
    owner = "owner_fixity_test",
    draft = "draft_fixity_test";
  db.database.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run(owner, now, now);
  db.database
    .prepare("INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,'complete','en-US',?,?,'2099-01-01T00:00:00Z')")
    .run(draft, owner, now, now);
  const insert = db.database.prepare(
    "INSERT INTO media_assets(id,draft_id,role,r2_key,content_type,byte_size,sha256,r2_etag,durability_status,created_at) VALUES(?,?,?,?,?,?,?,'etag',?,?)",
  );
  async function asset(id: string, role: string, bytes: Uint8Array, stored: Uint8Array | null, durability = "durable") {
    insert.run(id, draft, role, `originals/${id}`, "application/octet-stream", bytes.length, sha(bytes), durability, now);
    if (stored) await bucket.put(`originals/${id}`, stored.slice().buffer);
  }
  const photo = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]),
    voice = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 7]);
  await asset("asset_fixity_match", "original_photo", photo, photo);
  await asset("asset_fixity_changed", "original_audio", voice, Uint8Array.from(voice, (b, i) => (i === 4 ? 8 : b)));
  await asset("asset_fixity_gone", "original_photo", photo, null);
  // A file that never became durable is not part of the preserved record.
  await asset("asset_fixity_pending", "original_audio", voice, null, "pending");
  const env = { DB: db as unknown as D1Database, MEDIA_BUCKET: bucket as unknown as R2Bucket };
  const rows = () =>
    db.database.prepare("SELECT source_kind,source_id,outcome,observed_byte_size,checked_at FROM fixity_checks ORDER BY source_id,checked_at").all() as {
      source_kind: string; source_id: string; outcome: string; observed_byte_size: number | null; checked_at: string;
    }[];
  return { db, bucket, env, rows, asset, photo };
}

describe("scheduled integrity checks (A5)", () => {
  it("records a match, a changed object and a missing object, and never touches the objects", async () => {
    const s = await setup(),
      before = new Map([...s.bucket.objects].map(([key, value]) => [key, Buffer.from(value.body)]));
    const result = await runFixityPass(s.env, { now: () => "2026-11-16T07:37:00.000Z" });
    expect(result).toEqual({ checked: 3, matched: 1, mismatched: 1, missing: 1 });
    expect(s.rows().map((row) => [row.source_id, row.outcome, row.observed_byte_size])).toEqual([
      ["asset_fixity_changed", "mismatch", 5],
      ["asset_fixity_gone", "missing", null],
      ["asset_fixity_match", "match", 6],
    ]);
    // Never repaired, rewritten or deleted.
    expect([...s.bucket.objects.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [key, bytes] of before) expect(Buffer.from(s.bucket.objects.get(key)!.body).equals(bytes)).toBe(true);
  });

  it("checks never-checked files first, then the longest-unchecked", async () => {
    const s = await setup();
    await runFixityPass(s.env, { now: () => "2026-11-16T07:37:00.000Z" });
    await s.asset("asset_fixity_new", "original_photo", s.photo, s.photo);
    await runFixityPass(s.env, { filesPerPass: 1, now: () => "2026-11-17T07:37:00.000Z" });
    expect(s.rows().filter((row) => row.checked_at.startsWith("2026-11-17")).map((row) => row.source_id)).toEqual(["asset_fixity_new"]);
    await runFixityPass(s.env, { filesPerPass: 1, now: () => "2026-11-18T07:37:00.000Z" });
    expect(s.rows().filter((row) => row.checked_at.startsWith("2026-11-18")).map((row) => row.source_id)).toEqual(["asset_fixity_changed"]);
  });

  it("keeps results append-only and stops at the byte budget", async () => {
    const s = await setup();
    const result = await runFixityPass(s.env, { bytesPerPass: 1 });
    expect(result.checked).toBe(1);
    expect(() => s.db.database.prepare("UPDATE fixity_checks SET outcome='match'").run()).toThrow(/append-only/);
    expect(() =>
      s.db.database
        .prepare("INSERT INTO fixity_checks(id,source_kind,source_id,outcome,expected_sha256,observed_sha256,checked_at) VALUES('x','asset','y','match',?,?,'t')")
        .run("a".repeat(64), "b".repeat(64)),
    ).toThrow();
  });
});
