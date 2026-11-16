/// <reference types="@cloudflare/workers-types" />
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TestD1, TestR2 } from "../helpers/legacy-runtime";
import { createAppSession } from "../../worker/auth-session";
import {
  createServerExport,
  handleServerExportRoute,
  processServerExportStep,
  purgeServerExports,
  type ServerExportEnv,
} from "../../worker/server-export";
import { bytesSource, readStoredEntry, readStoredZipDirectory, verifyArchiveExport } from "../../app/domain/archive-export-verify";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const t = "2026-11-16T00:00:00.000Z";

async function setup() {
  const db = new TestD1(),
    bucket = new TestR2(),
    sent: { type: string; jobId: string }[] = [];
  const env = {
    DB: db as unknown as D1Database,
    MEDIA_BUCKET: bucket as unknown as R2Bucket,
    SESSION_SECRET: "synthetic-export-secret-".repeat(3),
    PROCESSING_QUEUE: { send: async (body: { type: string; jobId: string }) => void sent.push(body) },
  } as unknown as ServerExportEnv;
  for (const user of ["owner_server_export", "stranger_server_export"])
    db.database.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run(user, t, t);
  db.database.prepare("INSERT INTO story_entitlements(user_id,free_story_limit,free_stories_unlocked,updated_at) VALUES(?,3,3,?)").run("owner_server_export", t);
  const memories = ["memory_server_export_a", "memory_server_export_b", "memory_server_export_c"];
  for (const [index, memory] of memories.entries()) {
    db.database.prepare("INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,'complete','en-US',?,?,'2099-01-01T00:00:00Z')").run(memory, "owner_server_export", t, t);
    db.database.prepare("INSERT INTO memory_stories(id,owner_user_id,status,created_at,updated_at) VALUES(?,?,'draft',?,?)").run(memory, "owner_server_export", t, t);
    for (const role of ["original_photo", "original_audio"]) {
      const id = `${memory}_${role}`,
        bytes = new Uint8Array(1000 + index * 10 + (role === "original_audio" ? 1 : 0)).map((_, i) => (i * 7 + index) % 251);
      db.database.prepare("INSERT INTO media_assets(id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,sha256,r2_etag,durability_status,created_at) VALUES(?,?,?,?,?,?,?,?,'etag','durable',?)")
        .run(id, memory, memory, role, `originals/${id}`, role === "original_photo" ? "image/png" : "audio/webm", bytes.length, sha(bytes), t);
      await bucket.put(`originals/${id}`, bytes.slice().buffer);
    }
    db.database.prepare("UPDATE memory_stories SET status='complete',completed_at=?,primary_photo_asset_id=?,primary_audio_asset_id=? WHERE id=?")
      .run(`2026-11-1${index}T00:00:00.000Z`, `${memory}_original_photo`, `${memory}_original_audio`, memory);
  }
  const owner = (await createAppSession(env, "owner_server_export")).cookie.split(";")[0]!,
    stranger = (await createAppSession(env, "stranger_server_export")).cookie.split(";")[0]!;
  async function runAll(jobId: string) {
    let state = "continued",
      steps = 0;
    while (state === "continued") {
      state = await processServerExportStep(env, jobId, { filesPerStep: 2 });
      steps++;
    }
    return { state, steps };
  }
  const get = async (path: string, cookie = owner) =>
    (await handleServerExportRoute(new Request(`https://example.test/resources/archive-export/jobs${path}`, { headers: { Cookie: cookie } }), env))!;
  return { db, bucket, env, sent, owner, stranger, runAll, get, memories };
}

async function download(s: Awaited<ReturnType<typeof setup>>, jobId: string, part: number) {
  const response = await s.get(`/${jobId}/parts/${part}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { response, bytes };
}

describe("server-built export for large archives (L3)", () => {
  it("checks every original in steps, then streams a ZIP that the app's own checker confirms", async () => {
    const s = await setup(),
      jobId = await createServerExport(s.env, "owner_server_export", "es-PR");
    expect(s.sent).toEqual([{ type: "server_export", jobId }]);
    // Asking again while it is being prepared returns the same job.
    expect(await createServerExport(s.env, "owner_server_export", "es-PR")).toBe(jobId);
    const { state, steps } = await s.runAll(jobId);
    expect(state).toBe("ready");
    expect(steps).toBe(3); // six files, two per step
    const status = (await (await s.get("/latest")).json()) as { job: { state: string; checked: number; files: number; parts: { part: number; files: number }[] } };
    expect(status.job).toMatchObject({ state: "ready", checked: 6, files: 6, parts: [{ part: 1, files: 6 }] });

    const { response, bytes } = await download(s, jobId, 1);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(Number(response.headers.get("Content-Length"))).toBe(bytes.byteLength);
    const report = await verifyArchiveExport(bytesSource(bytes));
    expect(report).toMatchObject({ allMatch: true, listed: 6, matched: 6 });
    // Each packaged original is byte-identical to storage, and the manifest names its part and language.
    const source = bytesSource(bytes),
      entries = await readStoredZipDirectory(source);
    expect(entries.map((entry) => entry.path).slice(-2)).toEqual(["manifest.json", "index.html"]);
    for (const entry of entries.slice(0, -2)) {
      const id = entry.path.split("/").pop()!.replace(/\.[a-z0-9]+$/, "");
      expect(Buffer.from(await readStoredEntry(source, entry)).equals(Buffer.from(s.bucket.objects.get(`originals/${id}`)!.body))).toBe(true);
    }
    const manifest = JSON.parse(new TextDecoder().decode(await readStoredEntry(source, entries.at(-2)!))) as { serverExport: unknown; complete: boolean; verification: { allFilesVerified: boolean } };
    expect(manifest.serverExport).toEqual({ part: 1, parts: 1 });
    expect(manifest.verification.allFilesVerified).toBe(true);
    expect(new TextDecoder().decode(await readStoredEntry(source, entries.at(-1)!))).toContain('lang="es-PR"');
  });

  it("splits a large archive into whole-memory parts that each check on their own", async () => {
    const s = await setup(),
      jobId = await createServerExport(s.env, "owner_server_export", "en-US", { volumeBytes: 2500 });
    await s.runAll(jobId);
    const status = (await (await s.get(`/${jobId}`)).json()) as { job: { parts: { part: number; files: number }[] } };
    expect(status.job.parts.map((part) => part.files)).toEqual([2, 2, 2]);
    for (const part of [1, 2, 3]) {
      const { bytes } = await download(s, jobId, part);
      expect(await verifyArchiveExport(bytesSource(bytes))).toMatchObject({ allMatch: true, listed: 2, matched: 2 });
    }
  });

  it("leaves out an original that no longer matches its record, and names it", async () => {
    const s = await setup(),
      jobId = await createServerExport(s.env, "owner_server_export", "en-US");
    const key = `originals/${s.memories[1]}_original_audio`;
    s.bucket.objects.get(key)!.body[3] ^= 0xff;
    await s.runAll(jobId);
    const status = (await (await s.get(`/${jobId}`)).json()) as { job: { parts: { unverified: number }[] } };
    expect(status.job.parts[0]!.unverified).toBe(1);
    const report = await verifyArchiveExport(bytesSource((await download(s, jobId, 1)).bytes));
    // Five originals packaged and matching; the changed one is listed as missing, never packaged as if it were the original.
    expect(report.matched).toBe(5);
    expect(report.missing).toEqual([expect.stringContaining(`${s.memories[1]}`)]);
    expect(report.exportSaysComplete).toBe(false);
    expect(report.notIncluded).toContainEqual({ code: "files_not_verified", count: 1 });
  });

  it("refuses a download if an original changed after checking, and only the owner can see a job", async () => {
    const s = await setup(),
      jobId = await createServerExport(s.env, "owner_server_export", "en-US");
    await s.runAll(jobId);
    expect((await s.get(`/${jobId}`, s.stranger)).status).toBe(404);
    expect((await s.get(`/${jobId}/parts/1`, s.stranger)).status).toBe(404);
    expect(await (await s.get("/latest", s.stranger)).json()).toEqual({ job: null });
    s.bucket.objects.delete(`originals/${s.memories[0]}_original_photo`);
    expect((await s.get(`/${jobId}/parts/1`)).status).toBe(409);
  });

  it("removes prepared exports on deletion and after expiry", async () => {
    const s = await setup(),
      jobId = await createServerExport(s.env, "owner_server_export", "en-US");
    await s.runAll(jobId);
    expect([...s.bucket.objects.keys()].some((key) => key.startsWith(`exports/${jobId}/`))).toBe(true);
    expect(await purgeServerExports(s.env, { expiredBefore: "2000-01-01T00:00:00.000Z" })).toBe(0);
    expect(await purgeServerExports(s.env, { ownerUserId: "owner_server_export" })).toBe(1);
    expect([...s.bucket.objects.keys()].some((key) => key.startsWith("exports/"))).toBe(false);
    expect(s.db.database.prepare("SELECT count(*) AS n FROM server_export_entries").get()).toEqual({ n: 0 });
    const again = await createServerExport(s.env, "owner_server_export", "en-US");
    await s.runAll(again);
    expect(await purgeServerExports(s.env, { expiredBefore: "2099-01-01T00:00:00.000Z" })).toBe(1);
  });
});
