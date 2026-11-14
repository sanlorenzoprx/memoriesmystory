import { Buffer } from "node:buffer";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, dirname, relative, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import ts from "typescript";
import { Miniflare } from "miniflare";

// Trusted operator-only fixture compiler. Never added to the deployed Worker.
async function graph(root, entry, extension, output = []) {
  const file = resolve(root, entry),
    path = relative(root, file).replace(/\.ts$/, extension);
  if (output.some((item) => item.path === path)) return output;
  const item = { type: "ESModule", path, contents: "" };
  output.push(item);
  let contents = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const dependencies = [...contents.matchAll(/from\s+["'](\.[^"']+)["']/g)];
  for (const match of dependencies) {
    await graph(
      root,
      relative(root, resolve(dirname(file), `${match[1]}.ts`)),
      extension,
      output,
    );
  }
  contents = contents.replace(
    /from\s+["'](\.[^"']+)["']/g,
    (_full, name) => `from "${name}${extension}"`,
  );
  item.contents = contents;
  return output;
}
export async function createNativeArchiveProof({
  candidate,
  directory,
  context,
  credentials,
  fetchMock,
}) {
  const compiled = await mkdtemp(join(directory, "fixture-"));
  let fixture, runtime;
  try {
    const fixtureModules = await graph(
      candidate,
      "tests/helpers/legacy-fixture.ts",
      ".mjs",
    );
    for (const module of fixtureModules) {
      const file = join(compiled, module.path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, module.contents, { mode: 0o600 });
    }
    // The fixture's SQL migration URLs resolve relative to its compiled helper.
    const { readdir } = await import("node:fs/promises");
    await mkdir(join(compiled, "migrations"));
    for (const name of await readdir(join(candidate, "migrations")))
      if (name.endsWith(".sql"))
        await writeFile(
          join(compiled, "migrations", name),
          await readFile(join(candidate, "migrations", name)),
          { mode: 0o600 },
        );
    const { setupLegacyFixture } = await import(
      pathToFileURL(join(compiled, "tests/helpers/legacy-fixture.mjs")).href
    );
    fixture = await setupLegacyFixture("remote");
    const created = await fixture.create(),
      joined = await fixture.join(created.sessionId, created.joinPath),
      guest = joined.headers.get("Set-Cookie").split(";")[0],
      sessionId = created.sessionId;
    const sql = fixture.db.database,
      now = new Date().toISOString();
    sql
      .prepare(
        "INSERT INTO legacy_remote_calls(session_id,state,meeting_id,created_at,updated_at) VALUES(?,'ready',?,?,?)",
      )
      .run(sessionId, context.meetingId, now, now);
    const people = sql
      .prepare("SELECT id,role FROM legacy_participants WHERE session_id=?")
      .all(sessionId);
    for (const person of people) {
      const grant = context.grants.find((value) => value.role === person.role);
      if (!grant) throw new Error("archive_fixture_invalid");
      sql
        .prepare(
          "INSERT INTO legacy_remote_participants(participant_id,session_id,provider_participant_id) VALUES(?,?,?)",
        )
        .run(person.id, sessionId, grant.participantId);
    }
    const modules = await graph(candidate, "worker/legacy-recorder.ts", ".js");
    await graph(
      candidate,
      "worker/legacy-remote-recording-route.ts",
      ".js",
      modules,
    );
    modules.unshift({
      type: "ESModule",
      path: "native-archive-proof.js",
      contents: `
    export { LegacyRecorder } from './worker/legacy-recorder.js';
    import { phase1Config } from './config/phase-1.js';
    phase1Config.legacy.maxRecordingSeconds=60;
    phase1Config.legacy.remoteSourceMaximumBytes=64*1024*1024;
    import { handleRemoteRecordingRoute } from './worker/legacy-remote-recording-route.js';
    import { handleLegacySessionRoute } from './worker/legacy-sessions.js';
    export default {async fetch(request,env){return await handleRemoteRecordingRoute(request,env)??await handleLegacySessionRoute(request,env)??new Response(null,{status:404});}};
  `,
    });
    runtime = new Miniflare({
      fetchMock,
      modules,
      modulesRoot: candidate,
      compatibilityDate: "2026-07-15",
      d1Databases: ["DB"],
      r2Buckets: ["MEDIA_BUCKET"],
      durableObjects: {
        LEGACY_RECORDERS: { className: "LegacyRecorder", useSQLite: true },
      },
      bindings: {
        SESSION_SECRET: fixture.env.SESSION_SECRET,
        LEGACY_REMOTE_RECORDING_ENABLED: "true",
        REALTIMEKIT_ACCOUNT_ID: credentials.REALTIMEKIT_ACCOUNT_ID,
        REALTIMEKIT_API_TOKEN: credentials.REALTIMEKIT_API_TOKEN,
        REALTIMEKIT_APP_ID: context.appId,
        REALTIMEKIT_CALL_PRESET: "memoriesmystory-unrecorded",
        REALTIMEKIT_CALL_PRESET_ID: context.presetId,
      },
    });
    await runtime.ready;
    const db = await runtime.getD1Database("DB"),
      bucket = await runtime.getR2Bucket("MEDIA_BUCKET");
    const schema = sql
      .prepare(
        "SELECT type,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid",
      )
      .all();
    for (const item of schema.filter((item) => item.type !== "trigger"))
      await db.prepare(item.sql).run();
    for (const { name } of sql
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
      )
      .all()) {
      for (const row of sql.prepare(`SELECT * FROM ${name}`).all()) {
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
    const endpoint = `https://example.test/resources/legacy-sessions/${sessionId}`;
    async function request(
      suffix,
      method = "GET",
      cookie = fixture.owner,
      body,
      key,
      headers = {},
    ) {
      return runtime.dispatchFetch(endpoint + suffix, {
        method,
        headers: {
          ...headers,
          Cookie: cookie,
          ...(method !== "GET" ? { "X-Memories-Request": "legacy-v1" } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(key ? { "X-Idempotency-Key": key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    async function requireStatus(response, status) {
      if (response.status !== status)
        throw new Error("archive_route_check_failed");
      return response;
    }
    const key = `synthetic_archive_${randomUUID()}`;
    await requireStatus(
      await request("/remote-recordings", "POST", fixture.owner, {}, key),
      409,
    );
    for (const cookie of [fixture.owner, guest])
      await requireStatus(
        await request("/consent", "POST", cookie, {
          agree: true,
          version: "legacy-recording-v1",
        }),
        200,
      );
    context.recording.requireSyntheticMeetingCleanup(true);
    const result = await (
        await requireStatus(
          await request("/remote-recordings", "POST", fixture.owner, {}, key),
          202,
        )
      ).json(),
      recordingId = result.recordingId;
    const replay = await (
      await requireStatus(
        await request("/remote-recordings", "POST", fixture.owner, {}, key),
        200,
      )
    ).json();
    if (replay.recordingId !== recordingId || !replay.replayed)
      throw new Error("archive_idempotence_failed");
    // The fixture config sets its limit before the unchanged route allocates.
    // No stored authority or original is modified after recording starts.
    return {
      runtime,
      db,
      bucket,
      request,
      recordingId,
      guest,
      host: fixture.owner,
      sessionId,
      async state() {
        return db
          .prepare(
            "SELECT phase,capture_stopped,failure_code FROM legacy_remote_recordings WHERE id=?",
          )
          .bind(recordingId)
          .first();
      },
      async verifyOriginals() {
        const response = await requireStatus(
            await request("/remote-recordings"),
            200,
          ),
          view = await response.json();
        const recording = view.recordings.find(
          (item) => item.id === recordingId,
        );
        if (recording?.phase !== "preserved" || recording.sources.length < 3)
          throw new Error("archive_sources_missing");
        const sources = (
            await db
              .prepare(
                "SELECT * FROM legacy_remote_sources WHERE recording_id=?",
              )
              .bind(recordingId)
              .all()
          ).results,
          verified = [];
        for (const source of sources) {
          const media = recording.sources.find((item) => item.id === source.id);
          if (!media || source.durability_status !== "durable")
            throw new Error("archive_sources_missing");
          const suffix = media.mediaUrl.replace(
            `/resources/legacy-sessions/${sessionId}`,
            "",
          );
          await requireStatus(await request(suffix, "GET", ""), 403);
          const privateResponse = await requireStatus(
            await request(suffix, "GET", guest),
            200,
          );
          if (
            !privateResponse.headers.get("Cache-Control")?.includes("no-store")
          )
            throw new Error("archive_private_playback_failed");
          const bytes = Buffer.from(await privateResponse.arrayBuffer()),
            hash = createHash("sha256").update(bytes).digest("hex");
          const stored = await bucket.get(source.r2_key);
          if (!stored) throw new Error("archive_sources_missing");
          const storedHash = createHash("sha256")
            .update(Buffer.from(await stored.arrayBuffer()))
            .digest("hex");
          if (
            hash !== source.sha256 ||
            storedHash !== hash ||
            bytes.length !== source.byte_size ||
            stored.httpMetadata?.cacheControl !== "private, no-store"
          )
            throw new Error("archive_integrity_failed");
          const end = Math.min(15, bytes.length - 1);
          const ranged = await requireStatus(
            await request(suffix, "GET", guest, undefined, undefined, {
              Range: `bytes=0-${end}`,
            }),
            206,
          );
          if (
            ranged.headers.get("Content-Range") !==
              `bytes 0-${end}/${bytes.length}` ||
            !Buffer.from(await ranged.arrayBuffer()).equals(
              bytes.subarray(0, end + 1),
            )
          )
            throw new Error("archive_private_playback_failed");
          verified.push({
            kind: source.kind,
            participantId: source.participant_id,
            bytes,
          });
        }
        const audio = verified.filter(
          (item) => item.kind === "participant_audio",
        );
        if (new Set(audio.map((item) => item.participantId)).size !== 2)
          throw new Error("archive_attribution_failed");
        return verified;
      },
      async dispose() {
        await runtime.dispose();
        fixture.db.close();
        await rm(compiled, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await runtime?.dispose().catch(() => {});
    fixture?.db.close();
    await rm(compiled, { recursive: true, force: true });
    throw error;
  }
}
