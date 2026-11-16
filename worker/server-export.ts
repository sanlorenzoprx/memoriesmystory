import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import { buildArchiveManifest, fileSources } from "./archive-export";
import {
  crc32,
  crc32Update,
  renderExportIndex,
  zipCentralDirectory,
  zipLocalHeader,
  type ArchiveExportManifest,
  type ArchiveExportVerification,
} from "../app/domain/archive-export";
import { indexWording } from "../app/domain/archive-export-wording";
import { translate } from "../app/localization/messages";

/**
 * Server-built export for archives too large for one device (lane L3).
 *
 * Nothing large is ever copied or held in memory. A background pass reads
 * each original once to record the CRC-32 a ZIP needs and to confirm its
 * SHA-256 against the preserved record; a file that does not match is left
 * out and named, exactly as on the device. A download then streams, for each
 * file, a 30-byte header followed by the stored original itself, and ends
 * with a small prepared tail (manifest.json, index.html and the ZIP
 * directory). Archives are split by memory into parts that are each complete,
 * checkable ZIPs. Prepared exports expire after seven days and are removed
 * when the owner deletes a memory.
 */
export type ServerExportEnv = AuthSessionEnv & {
  MEDIA_BUCKET: R2Bucket;
  PROCESSING_QUEUE: { send(body: unknown): Promise<unknown> };
};

export type ServerExportMessage = { type: "server_export"; jobId: string };

export const serverExportLimits = {
  /** Each part stays well inside the classic 4 GiB ZIP limit. */
  volumeBytes: 1500 * 1024 * 1024,
  /** Work per background step, so each step stays inside Worker limits. */
  bytesPerStep: 256 * 1024 * 1024,
  filesPerStep: 40,
  expiryDays: 7,
};

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
  });
const locales = new Set(["en-US", "es-US", "es-PR"]);
const prefix = (jobId: string) => `exports/${jobId}/`;

type JobRow = {
  id: string;
  owner_user_id: string;
  state: "building" | "ready" | "failed";
  locale: string;
  file_count: number;
  total_bytes: number;
  volume_count: number;
  next_position: number;
  created_at: string;
  expires_at: string;
};
type EntryRow = {
  position: number;
  volume: number;
  memory_story_id: string;
  path: string;
  r2_key: string;
  byte_size: number;
  expected_sha256: string;
  crc32: number | null;
  verified: number | null;
};

async function hashObject(object: R2ObjectBody): Promise<{ crc: number; sha256: string; size: number }> {
  const hex = (buffer: ArrayBuffer) =>
    [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const Digest = (crypto as unknown as { DigestStream?: new (algorithm: string) => WritableStream<Uint8Array> & { digest: Promise<ArrayBuffer> } }).DigestStream;
  let crc = 0,
    size = 0;
  if (Digest && object.body) {
    const digest = new Digest("SHA-256");
    await object.body
      .pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            crc = crc32Update(crc, chunk);
            size += chunk.byteLength;
            controller.enqueue(chunk);
          },
        }),
      )
      .pipeTo(digest);
    return { crc, sha256: hex(await digest.digest), size };
  }
  const bytes = new Uint8Array(await object.arrayBuffer());
  return { crc: crc32(bytes), sha256: hex(await crypto.subtle.digest("SHA-256", bytes)), size: bytes.byteLength };
}

/** Starts a job, or returns the one already being prepared. */
export async function createServerExport(
  env: ServerExportEnv,
  ownerUserId: string,
  locale: string,
  options: { volumeBytes?: number } = {},
): Promise<string> {
  const building = await env.DB.prepare("SELECT id FROM server_export_jobs WHERE owner_user_id=? AND state='building'")
    .bind(ownerUserId)
    .first<{ id: string }>();
  if (building) return building.id;
  const manifest = await buildArchiveManifest(env, ownerUserId),
    volumeBytes = options.volumeBytes ?? serverExportLimits.volumeBytes,
    entries: Omit<EntryRow, "crc32" | "verified">[] = [];
  let volume = 1,
    volumeSize = 0;
  // Parts are split between memories, so every part holds whole memories.
  for (const memory of manifest.memories) {
    const resolved: Omit<EntryRow, "crc32" | "verified" | "position" | "volume">[] = [];
    for (const file of memory.files) {
      const source = await env.DB.prepare(fileSources[file.kind])
        .bind(file.id, ownerUserId)
        .first<{ r2_key: string; byte_size: number; sha256: string }>();
      if (source)
        resolved.push({ memory_story_id: memory.id, path: file.path, r2_key: source.r2_key, byte_size: source.byte_size, expected_sha256: source.sha256 });
    }
    const memoryBytes = resolved.reduce((sum, file) => sum + file.byte_size, 0);
    if (volumeSize > 0 && volumeSize + memoryBytes > volumeBytes) {
      volume++;
      volumeSize = 0;
    }
    volumeSize += memoryBytes;
    for (const file of resolved) entries.push({ ...file, position: entries.length, volume });
  }
  const now = new Date(),
    id = `export_${crypto.randomUUID().replace(/-/g, "")}`;
  await env.MEDIA_BUCKET.put(`${prefix(id)}manifest.json`, new TextEncoder().encode(JSON.stringify(manifest)), {
    httpMetadata: { contentType: "application/json" },
  });
  const statements = [
    env.DB.prepare(
      "INSERT INTO server_export_jobs(id,owner_user_id,state,locale,file_count,total_bytes,volume_count,created_at,updated_at,expires_at) VALUES(?,?,'building',?,?,?,?,?,?,?)",
    ).bind(
      id,
      ownerUserId,
      locales.has(locale) ? locale : "en-US",
      entries.length,
      entries.reduce((sum, entry) => sum + entry.byte_size, 0),
      volume,
      now.toISOString(),
      now.toISOString(),
      new Date(now.getTime() + serverExportLimits.expiryDays * 86_400_000).toISOString(),
    ),
    ...entries.map((entry) =>
      env.DB.prepare(
        "INSERT INTO server_export_entries(job_id,position,volume,memory_story_id,path,r2_key,byte_size,expected_sha256) VALUES(?,?,?,?,?,?,?,?)",
      ).bind(id, entry.position, entry.volume, entry.memory_story_id, entry.path, entry.r2_key, entry.byte_size, entry.expected_sha256),
    ),
  ];
  for (let index = 0; index < statements.length; index += 50) await env.DB.batch(statements.slice(index, index + 50));
  await env.PROCESSING_QUEUE.send({ type: "server_export", jobId: id } satisfies ServerExportMessage);
  return id;
}

/** One background step: check the next files, then queue the next step or finish. */
export async function processServerExportStep(
  env: ServerExportEnv,
  jobId: string,
  options: { bytesPerStep?: number; filesPerStep?: number } = {},
): Promise<"continued" | "ready" | "gone"> {
  const job = await env.DB.prepare("SELECT * FROM server_export_jobs WHERE id=? AND state='building'").bind(jobId).first<JobRow>();
  if (!job) return "gone";
  const { results } = await env.DB.prepare(
    "SELECT * FROM server_export_entries WHERE job_id=? AND position>=? ORDER BY position LIMIT ?",
  )
    .bind(jobId, job.next_position, options.filesPerStep ?? serverExportLimits.filesPerStep)
    .all<EntryRow>();
  let next = job.next_position,
    bytes = 0;
  for (const entry of results) {
    if (bytes > 0 && bytes + entry.byte_size > (options.bytesPerStep ?? serverExportLimits.bytesPerStep)) break;
    const object = await env.MEDIA_BUCKET.get(entry.r2_key);
    const checked = object ? await hashObject(object) : null;
    const verified = Boolean(checked && checked.size === entry.byte_size && checked.sha256 === entry.expected_sha256);
    await env.DB.prepare("UPDATE server_export_entries SET crc32=?,verified=? WHERE job_id=? AND position=?")
      .bind(verified ? checked!.crc : null, verified ? 1 : 0, jobId, entry.position)
      .run();
    bytes += entry.byte_size;
    next = entry.position + 1;
  }
  await env.DB.prepare("UPDATE server_export_jobs SET next_position=?,updated_at=? WHERE id=? AND state='building'")
    .bind(next, new Date().toISOString(), jobId)
    .run();
  if (next < job.file_count) {
    await env.PROCESSING_QUEUE.send({ type: "server_export", jobId } satisfies ServerExportMessage);
    return "continued";
  }
  await finalizeServerExport(env, { ...job, next_position: next });
  return "ready";
}

/** Writes each part's tail: manifest.json, index.html and the ZIP directory. */
async function finalizeServerExport(env: ServerExportEnv, job: JobRow) {
  const stored = await env.MEDIA_BUCKET.get(`${prefix(job.id)}manifest.json`);
  if (!stored) throw new Error("server_export_manifest_missing");
  const manifest = JSON.parse(await stored.text()) as ArchiveExportManifest,
    { results: entries } = await env.DB.prepare("SELECT * FROM server_export_entries WHERE job_id=? ORDER BY position")
      .bind(job.id)
      .all<EntryRow>();
  const memoryVolume = new Map(entries.map((entry) => [entry.memory_story_id, entry.volume])),
    encoder = new TextEncoder(),
    label = (key: string, values?: Record<string, string | number>) => translate(indexWording[key] ?? key, job.locale as Parameters<typeof translate>[1], values);
  for (let volume = 1; volume <= job.volume_count; volume++) {
    const own = entries.filter((entry) => entry.volume === volume),
      included = own.filter((entry) => entry.verified === 1),
      unverified = own.length - included.length,
      memories = manifest.memories.filter((memory) => (memoryVolume.get(memory.id) ?? 1) === volume),
      ids = new Set(memories.map((memory) => memory.id));
    const notIncluded = unverified
      ? [...manifest.notIncluded, { code: "files_not_verified", count: unverified }]
      : manifest.notIncluded;
    const part: ArchiveExportManifest & { serverExport: { part: number; parts: number } } = {
      ...manifest,
      complete: manifest.complete && unverified === 0 && job.volume_count === 1,
      notIncluded,
      memories,
      chapters: manifest.chapters.map((chapter) => ({ ...chapter, memoryIds: chapter.memoryIds.filter((id) => ids.has(id)) })),
      people: volume === 1 ? manifest.people : [],
      serverExport: { part: volume, parts: job.volume_count },
    };
    const verification: ArchiveExportVerification = {
      verifiedAt: new Date().toISOString(),
      allFilesVerified: unverified === 0,
      files: own.map((entry) => ({ path: entry.path, sha256: entry.expected_sha256, verified: entry.verified === 1 })),
    };
    const manifestBytes = encoder.encode(JSON.stringify({ ...part, verification }, null, 2)),
      indexBytes = encoder.encode(renderExportIndex(part, verification, label, job.locale));
    const placed: { path: string; crc: number; size: number; offset: number }[] = [];
    let offset = 0;
    for (const entry of included) {
      placed.push({ path: entry.path, crc: entry.crc32!, size: entry.byte_size, offset });
      offset += zipLocalHeader(entry.path, 0, 0).byteLength + entry.byte_size;
    }
    const tail: Uint8Array[] = [];
    for (const [path, bytes] of [["manifest.json", manifestBytes], ["index.html", indexBytes]] as const) {
      const crc = crc32(bytes),
        header = zipLocalHeader(path, crc, bytes.byteLength);
      placed.push({ path, crc, size: bytes.byteLength, offset });
      tail.push(header, bytes);
      offset += header.byteLength + bytes.byteLength;
    }
    tail.push(...zipCentralDirectory(placed, offset));
    const length = tail.reduce((sum, chunk) => sum + chunk.byteLength, 0),
      joined = new Uint8Array(length);
    let at = 0;
    for (const chunk of tail) {
      joined.set(chunk, at);
      at += chunk.byteLength;
    }
    await env.MEDIA_BUCKET.put(`${prefix(job.id)}part-${volume}.tail`, joined);
  }
  const now = new Date();
  await env.DB.prepare("UPDATE server_export_jobs SET state='ready',updated_at=?,expires_at=? WHERE id=?")
    .bind(now.toISOString(), new Date(now.getTime() + serverExportLimits.expiryDays * 86_400_000).toISOString(), job.id)
    .run();
}

/** Removes prepared exports and their stored parts: an owner's, or every expired one. */
export async function purgeServerExports(env: { DB: D1Database; MEDIA_BUCKET: R2Bucket }, scope: { ownerUserId: string } | { expiredBefore: string }) {
  const { results } = await ("ownerUserId" in scope
    ? env.DB.prepare("SELECT id FROM server_export_jobs WHERE owner_user_id=?").bind(scope.ownerUserId)
    : env.DB.prepare("SELECT id FROM server_export_jobs WHERE expires_at<?").bind(scope.expiredBefore)
  ).all<{ id: string }>();
  for (const { id } of results) {
    let cursor: string | undefined;
    do {
      const page = await env.MEDIA_BUCKET.list({ prefix: prefix(id), ...(cursor ? { cursor } : {}) });
      if (page.objects.length) await env.MEDIA_BUCKET.delete(page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    await env.DB.prepare("DELETE FROM server_export_jobs WHERE id=?").bind(id).run();
  }
  return results.length;
}

function partName(job: JobRow, volume: number) {
  return `family-archive-export-${job.created_at.slice(0, 10)}-part-${volume}-of-${job.volume_count}.zip`;
}

async function streamPart(env: ServerExportEnv, job: JobRow, volume: number): Promise<Response> {
  const { results: entries } = await env.DB.prepare(
    "SELECT * FROM server_export_entries WHERE job_id=? AND volume=? AND verified=1 ORDER BY position",
  )
    .bind(job.id, volume)
    .all<EntryRow>();
  const tail = await env.MEDIA_BUCKET.head(`${prefix(job.id)}part-${volume}.tail`);
  if (!tail) return json({ error: { code: "server_export_unavailable" } }, 503);
  // Every original must still be exactly what was checked, before a single byte is sent.
  for (const entry of entries) {
    const head = await env.MEDIA_BUCKET.head(entry.r2_key);
    if (!head || head.size !== entry.byte_size) return json({ error: { code: "server_export_changed" } }, 409);
  }
  const length =
    entries.reduce((sum, entry) => sum + zipLocalHeader(entry.path, 0, 0).byteLength + entry.byte_size, 0) + tail.size;
  async function* chunks() {
    for (const entry of entries) {
      yield zipLocalHeader(entry.path, entry.crc32!, entry.byte_size);
      const object = await env.MEDIA_BUCKET.get(entry.r2_key);
      if (!object) throw new Error("server_export_changed");
      const reader = object.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    }
    const end = await env.MEDIA_BUCKET.get(`${prefix(job.id)}part-${volume}.tail`);
    if (!end) throw new Error("server_export_unavailable");
    yield new Uint8Array(await end.arrayBuffer());
  }
  const iterator = chunks();
  let body: ReadableStream<Uint8Array> = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
  });
  const Fixed = (globalThis as unknown as { FixedLengthStream?: new (length: number) => TransformStream<Uint8Array, Uint8Array> }).FixedLengthStream;
  if (Fixed) body = body.pipeThrough(new Fixed(length));
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(length),
      "Content-Disposition": `attachment; filename="${partName(job, volume)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/** Routes under /resources/archive-export/jobs. */
export async function handleServerExportRoute(request: Request, env: ServerExportEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/resources\/archive-export\/jobs(?:\/(latest|[A-Za-z0-9_]{8,80})(?:\/parts\/(\d{1,3}))?)?$/);
  if (!match) return null;
  try {
    const session = await authenticateAppSession(request, env);
    if (!session) return json({ error: { code: "session_required" } }, 401);
    if (!match[1]) {
      if (request.method !== "POST") return json({ error: { code: "method" } }, 405);
      if (request.headers.get("X-Memories-Request") !== "export-v1") return json({ error: { code: "server_export_invalid" } }, 400);
      const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
      const id = await createServerExport(env, session.userId, typeof body?.locale === "string" ? body.locale : "en-US");
      return json({ id }, 202);
    }
    if (request.method !== "GET") return json({ error: { code: "method" } }, 405);
    const job = await (match[1] === "latest"
      ? env.DB.prepare("SELECT * FROM server_export_jobs WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 1").bind(session.userId)
      : env.DB.prepare("SELECT * FROM server_export_jobs WHERE id=? AND owner_user_id=?").bind(match[1], session.userId)
    ).first<JobRow>();
    if (!job || job.expires_at <= new Date().toISOString())
      return match[1] === "latest" ? json({ job: null }) : json({ error: { code: "server_export_not_found" } }, 404);
    if (match[2]) {
      const volume = Number(match[2]);
      if (job.state !== "ready" || volume < 1 || volume > job.volume_count)
        return json({ error: { code: "server_export_not_found" } }, 404);
      return await streamPart(env, job, volume);
    }
    const { results } = await env.DB.prepare(
      "SELECT volume, count(*) AS files, sum(byte_size) AS bytes, sum(CASE WHEN verified=0 THEN 1 ELSE 0 END) AS unverified FROM server_export_entries WHERE job_id=? GROUP BY volume ORDER BY volume",
    )
      .bind(job.id)
      .all<{ volume: number; files: number; bytes: number; unverified: number }>();
    return json({
      job: {
        id: job.id,
        state: job.state,
        checked: job.next_position,
        files: job.file_count,
        expiresAt: job.expires_at,
        parts: Array.from({ length: job.volume_count }, (_, index) => {
          const row = results.find((part) => part.volume === index + 1);
          return { part: index + 1, files: row?.files ?? 0, bytes: row?.bytes ?? 0, unverified: row?.unverified ?? 0, name: partName(job, index + 1) };
        }),
      },
    });
  } catch {
    return json({ error: { code: "server_export_unavailable" } }, 503);
  }
}

