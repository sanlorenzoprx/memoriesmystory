/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { createHash } from "node:crypto";
import { Miniflare, createFetchMock } from "miniflare";
import ts from "typescript";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { legacyConsentVersion } from "../../app/domain/our-living-legacy";
const runtimes: Miniflare[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});
function modules() {
  const root = resolve("."),
    seen = new Set<string>(),
    result: { type: "ESModule"; path: string; contents: string }[] = [];
  function add(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    let contents = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    contents = contents.replace(
      /from\s+["'](\.[^"']+)["']/g,
      (_full, name: string) => {
        add(resolve(dirname(file), `${name}.ts`));
        return `from "${name}.js"`;
      },
    );
    result.push({
      type: "ESModule",
      path: relative(root, file).replace(/\.ts$/, ".js"),
      contents,
    });
  }
  add(resolve("worker/legacy-recorder.ts"));
  result.unshift({
    type: "ESModule",
    path: "runtime-test.js",
    contents: `import { LegacyRecorder } from './worker/legacy-recorder.js';
 export class TestRecorder extends LegacyRecorder { async fetch(request){if(new URL(request.url).pathname==='/tick'){await this.alarm();return new Response('ok');}return super.fetch(request);} }
 export default {fetch(){return new Response('test');}};`,
  });
  return result;
}
async function setup(uncertainStart = false, partialTrack = false) {
  const fixture = await setupLegacyFixture("remote");
  try {
    const created = await fixture.create(),
      sessionId = created.sessionId;
    const joined = await fixture.join(sessionId, created.joinPath),
      guest = joined.headers.get("Set-Cookie")!.split(";")[0]!;
    for (const actor of [fixture.owner, guest])
      await fixture.call(
        `/${sessionId}/consent`,
        "POST",
        { agree: true, version: legacyConsentVersion },
        actor,
      );
    const sql = fixture.db.database,
      now = new Date().toISOString();
    sql
      .prepare(
        "INSERT INTO legacy_remote_calls(session_id,state,meeting_id,created_at,updated_at) VALUES(?,'ready','meeting-runtime-test',?,?)",
      )
      .run(sessionId, now, now);
    const people = sql
      .prepare(
        "SELECT id,role FROM legacy_participants WHERE session_id=? ORDER BY role",
      )
      .all(sessionId) as { id: string; role: string }[];
    for (const person of people)
      sql
        .prepare(
          "INSERT INTO legacy_remote_participants(participant_id,session_id,provider_participant_id) VALUES(?,?,?)",
        )
        .run(person.id, sessionId, `provider_${person.role}_runtime`);
    const snapshot = people.map((person) => ({
      id: person.id,
      providerId: `provider_${person.role}_runtime`,
    }));
    const recordingId = "remote_recording_runtime_test";
    sql
      .prepare(
        "INSERT INTO legacy_remote_recordings(id,session_id,created_by_participant_id,source_photo_asset_id,consent_epoch,consent_snapshot_json,provider_meeting_id,phase,max_duration_seconds,created_at,updated_at) SELECT ?,id,?,photo_asset_id,consent_epoch,?,'meeting-runtime-test','queued',600,?,? FROM legacy_sessions WHERE id=?",
      )
      .run(
        recordingId,
        people.find((p) => p.role === "host")!.id,
        JSON.stringify(snapshot),
        now,
        now,
        sessionId,
      );
    const mock = createFetchMock();
    mock.disableNetConnect();
    const files = new Map<string, Uint8Array>();
    const webm = new Uint8Array(1000).fill(37);
    webm.set([0x1a, 0x45, 0xdf, 0xa3]);
    const mp4 = new Uint8Array(1000).fill(42);
    mp4.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);
    files.set("/composite.mp4", mp4);
    const urls: Record<string, { download_url: string }> = {};
    for (const person of snapshot) {
      const filename = `capture_${person.providerId}_segment.webm`;
      urls[filename] = {
        download_url: `https://archive.cloudflarestorage.com/${filename}`,
      };
      files.set(`/${filename}`, webm);
    }
    const records = new Map<
      string,
      {
        id: string;
        status: string;
        meeting_id: string;
        output_file_name: string;
        download_url: unknown;
      }
    >();
    let allocations = 0,
      stops = 0;
    const prefix = `/client/v4/accounts/account_test/realtime/kit/app_test`;
    mock
      .get("https://api.cloudflare.com")
      .intercept({ path: /.*/, method: "POST" })
      .reply((options) => {
        allocations++;
        const track = String(options.path).endsWith("/track"),
          id = track ? "track-runtime-test" : "composite-runtime-test";
        records.set(id, {
          id,
          status: "RECORDING",
          meeting_id: "meeting-runtime-test",
          output_file_name: `memoriesmystory_${recordingId.slice(-24)}`,
          download_url: track
            ? { opaque: [{ download_urls: urls }] }
            : "https://archive.cloudflarestorage.com/composite.mp4",
        });
        return {
          statusCode: uncertainStart && allocations === 1 ? 503 : 200,
          data: JSON.stringify({
            success: true,
            data: track ? { recording: { id } } : { id },
          }),
        };
      })
      .persist();
    mock
      .get("https://api.cloudflare.com")
      .intercept({ path: /.*/, method: "GET" })
      .reply((options) => {
        const path = String(options.path),
          id = path.split("/").pop()!;
        return {
          statusCode: 200,
          data: JSON.stringify({
            success: true,
            data: path.includes("/recordings?")
              ? [...records.values()]
              : records.get(id),
          }),
        };
      })
      .persist();
    mock
      .get("https://api.cloudflare.com")
      .intercept({ path: new RegExp(`^${prefix}/recordings/`), method: "PUT" })
      .reply((options) => {
        stops++;
        const id = String(options.path).split("/").pop()!;
        records.get(id)!.status = partialTrack && id === "track-runtime-test" ? "ERRORED" : "UPLOADED";
        return {
          statusCode: 200,
          data: JSON.stringify({ success: true, data: {} }),
        };
      })
      .persist();
    for (const [path, bytes] of files)
      mock
        .get("https://archive.cloudflarestorage.com")
        .intercept({ path, method: "GET" })
        .reply(200, Buffer.from(bytes))
        .persist();
    const runtime = new Miniflare({
      modules: modules(),
      modulesRoot: resolve("."),
      compatibilityDate: "2026-07-15",
      d1Databases: ["DB"],
      r2Buckets: ["MEDIA_BUCKET"],
      durableObjects: {
        LEGACY_RECORDERS: { className: "TestRecorder", useSQLite: true },
      },
      fetchMock: mock,
      bindings: {
        REALTIMEKIT_ACCOUNT_ID: "account_test",
        REALTIMEKIT_APP_ID: "app_test",
        REALTIMEKIT_API_TOKEN: "synthetic",
        REALTIMEKIT_CALL_PRESET: "family-call",
        REALTIMEKIT_CALL_PRESET_ID: "preset-test",
      },
    });
    runtimes.push(runtime);
    await runtime.ready;
    const db = await runtime.getD1Database("DB");
    const schema = sql
      .prepare(
        "SELECT type,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid",
      )
      .all() as { type: string; sql: string }[];
    // Import an already constraint-validated SQLite fixture snapshot, then install the identical triggers.
    for (const item of schema.filter((item) => item.type !== "trigger"))
      await db.prepare(item.sql).run();
    const tables = sql
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
      )
      .all() as { name: string }[];
    for (const { name } of tables) {
      const rows = sql.prepare(`SELECT * FROM ${name}`).all();
      for (const row of rows) {
        const keys = Object.keys(row);
        await db
          .prepare(
            `INSERT INTO ${name}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
          )
          .bind(...Object.values(row))
          .run();
      }
    }
    for (const item of schema.filter((item) => item.type === "trigger"))
      await db.prepare(item.sql).run();
    const namespace =
        await runtime.getDurableObjectNamespace("LEGACY_RECORDERS"),
      recorder = namespace.get(namespace.idFromName(sessionId));
    await recorder.fetch("https://test/arm", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    async function tick() {
      expect(
        (await recorder.fetch("https://test/tick", { method: "POST" })).status,
      ).toBe(200);
    }
    const group = () =>
      db
        .prepare("SELECT * FROM legacy_remote_recordings WHERE id=?")
        .bind(recordingId)
        .first();
    return {
      runtime,
      db,
      sessionId,
      recordingId,
      tick,
      group,
      counts: () => ({ allocations, stops }),
      files,
    };
  } finally {
    fixture.db.close();
  }
}
describe("alarm-backed recording with native workerd D1 and private R2", () => {
  it("stores and independently verifies all three originals before confirming the archive", async () => {
    const s = await setup();
    for (let i = 0; i < 3; i++) await s.tick();
    expect(await s.group()).toMatchObject({
      phase: "recording",
      capture_stopped: 0,
    });
    expect(s.counts().allocations).toBe(2);
    await s.db
      .prepare(
        "UPDATE legacy_remote_recordings SET stop_requested_at=? WHERE id=?",
      )
      .bind(new Date().toISOString(), s.recordingId)
      .run();
    for (let i = 0; i < 8; i++) await s.tick();
    expect(await s.group()).toMatchObject({
      phase: "preserved",
      capture_stopped: 1,
    });
    const sources = (
      await s.db
        .prepare("SELECT * FROM legacy_remote_sources WHERE recording_id=?")
        .bind(s.recordingId)
        .all()
    ).results;
    expect(sources).toHaveLength(3);
    const bucket = await s.runtime.getR2Bucket("MEDIA_BUCKET");
    for (const source of sources) {
      const object = await bucket.get(String(source.r2_key));
      expect(object).not.toBeNull();
      const bytes = new Uint8Array(await object!.arrayBuffer());
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        source.sha256,
      );
      expect(source.durability_status).toBe("durable");
      expect(object!.httpMetadata?.cacheControl).toBe("private, no-store");
    }
    await s.tick();
    expect(s.counts()).toEqual({ allocations: 2, stops: 2 });
  }, 30000);
  it("withdrawn consent stops both recorders without publishing any archive sources", async () => {
    const s = await setup();
    for (let i = 0; i < 3; i++) await s.tick();
    await s.db
      .prepare(
        "UPDATE legacy_sessions SET consent_epoch=consent_epoch+1 WHERE id=?",
      )
      .bind(s.sessionId)
      .run();
    for (let i = 0; i < 4; i++) await s.tick();
    expect(await s.group()).toMatchObject({
      phase: "needs_review",
      capture_stopped: 1,
    });
    expect(s.counts()).toEqual({ allocations: 2, stops: 2 });
    expect(
      (await (await s.runtime.getR2Bucket("MEDIA_BUCKET")).list()).objects,
    ).toHaveLength(0);
  }, 30000);
  it("reconciles an uncertain provider start without allocating a duplicate recorder", async () => {
    const s = await setup(true);
    await s.tick();
    expect(await s.group()).toMatchObject({ phase: "allocating_track" });
    for (let i = 0; i < 3; i++) await s.tick();
    expect(await s.group()).toMatchObject({
      phase: "recording",
      provider_track_id: "track-runtime-test",
      provider_composite_id: "composite-runtime-test",
    });
    expect(s.counts().allocations).toBe(2);
    await s.db
      .prepare(
        "UPDATE legacy_remote_recordings SET stop_requested_at=? WHERE id=?",
      )
      .bind(new Date().toISOString(), s.recordingId)
      .run();
    for (let i = 0; i < 8; i++) await s.tick();
    expect(await s.group()).toMatchObject({
      phase: "preserved",
      capture_stopped: 1,
    });
  }, 30000);
  it("preserves available originals with an explicit partial state when participant audio fails",async()=>{
    const s=await setup(false,true);for(let i=0;i<3;i++)await s.tick();
    await s.db.prepare("UPDATE legacy_remote_recordings SET stop_requested_at=? WHERE id=?").bind(new Date().toISOString(),s.recordingId).run();
    for(let i=0;i<6;i++)await s.tick();
    expect(await s.group()).toMatchObject({phase:"partial_preserved",capture_stopped:1});
    const sources=(await s.db.prepare("SELECT kind,durability_status FROM legacy_remote_sources WHERE recording_id=?").bind(s.recordingId).all()).results;
    expect(sources).toEqual([{kind:"composite_video",durability_status:"durable"}]);
  },30000);

});
