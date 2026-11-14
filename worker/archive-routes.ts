import { phase1Config } from "../config/phase-1";
import {
  authenticateAppSession,
  sha256Text,
  type AuthSessionEnv,
} from "./auth-session";
import { readBoundedText, RequestBodyTooLarge } from "./request-body";
import type {
  FamilyArchive,
  FamilyChapter,
  FamilyMemory,
} from "../app/domain/family-archive";
type Env = AuthSessionEnv & { MEDIA_BUCKET: R2Bucket };
type ArchiveRow = {
  id: string;
  owner_user_id: string;
  title: string;
  description: string;
  version: number;
};
type ChapterRow = {
  id: string;
  archive_id: string;
  title: string;
  description: string;
  cover_memory_id: string | null;
  version: number;
  position: number;
};
class ArchiveError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
const limits = phase1Config.familyArchive,
  idPattern = /^[A-Za-z0-9_-]{8,120}$/;
function fail(status: number, code: string): never {
  throw new ArchiveError(status, code);
}
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function text(value: unknown, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    fail(400, "family_archive_invalid");
  return value.trim();
}
function identifier(value: unknown) {
  if (typeof value !== "string" || !idPattern.test(value))
    fail(400, "family_archive_invalid");
  return value;
}
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    fail(400, "family_archive_invalid");
  return value as number;
}
async function archive(env: Env, user: string, id: string) {
  const row = await env.DB.prepare(
    "SELECT * FROM family_archives WHERE id=? AND owner_user_id=?",
  )
    .bind(id, user)
    .first<ArchiveRow>();
  if (!row) fail(404, "family_archive_not_found");
  return row;
}
async function chapter(env: Env, user: string, id: string) {
  const row = await env.DB.prepare(
    "SELECT c.* FROM family_chapters c JOIN family_archives a ON a.id=c.archive_id WHERE c.id=? AND a.owner_user_id=?",
  )
    .bind(id, user)
    .first<ChapterRow>();
  if (!row) fail(404, "family_archive_not_found");
  return row;
}
async function chapterView(env: Env, row: ChapterRow): Promise<FamilyChapter> {
  const memories = (
    await env.DB.prepare(
      "SELECT memory_story_id FROM family_chapter_memories WHERE chapter_id=? ORDER BY position,created_at,memory_story_id",
    )
      .bind(row.id)
      .all<{ memory_story_id: string }>()
  ).results;
  return {
    id: row.id,
    archiveId: row.archive_id,
    title: row.title,
    description: row.description,
    version: row.version,
    position: row.position,
    visibility: "private",
    coverMemoryId: row.cover_memory_id,
    memoryIds: memories.map((item) => item.memory_story_id),
  };
}
async function memories(
  env: Env,
  user: string,
  cursor: string | null,
  oneId?: string,
) {
  const rows = (
    await env.DB.prepare(
      "SELECT m.id,l.title,COALESCE(l.version,0) AS title_version,p.id AS photo_id,p.draft_id AS photo_draft,p.r2_key AS photo_key,v.r2_key AS voice_key FROM memory_stories m LEFT JOIN family_memory_labels l ON l.memory_story_id=m.id LEFT JOIN media_assets p ON p.id=m.primary_photo_asset_id AND p.memory_story_id=m.id AND p.role='original_photo' AND p.durability_status='durable' LEFT JOIN media_assets v ON v.id=m.primary_audio_asset_id AND v.memory_story_id=m.id AND v.role='original_audio' AND v.durability_status='durable' WHERE m.owner_user_id=? AND m.status='complete' AND m.id" +
        (oneId ? "=" : " >") +
        "? ORDER BY m.id LIMIT ?",
    )
      .bind(user, oneId ?? cursor ?? "", oneId ? 1 : limits.listingPageSize + 1)
      .all<{
        id: string;
        title: string | null;
        title_version: number;
        photo_id: string | null;
        photo_draft: string | null;
        photo_key: string | null;
        voice_key: string | null;
      }>()
  ).results;
  const page = rows.slice(0, limits.listingPageSize);
  const result: FamilyMemory[] = await Promise.all(
    page.map(async (row) => {
      async function available(key: string | null) {
        if (!key) return false;
        try {
          return Boolean(await env.MEDIA_BUCKET.head(key));
        } catch {
          return false;
        }
      }
      const [photo, voice] = await Promise.all([
        available(row.photo_key),
        available(row.voice_key),
      ]);
      return {
        id: row.id,
        title: row.title,
        titleVersion: row.title_version,
        photoUrl: photo
          ? `/resources/drafts/${encodeURIComponent(row.photo_draft!)}/media/${encodeURIComponent(row.photo_id!)}`
          : null,
        voiceAvailable: voice,
      };
    }),
  );
  return {
    memories: result,
    nextMemoryCursor:
      rows.length > page.length ? page[page.length - 1]!.id : null,
  };
}
export async function handleArchiveRoute(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url),
    match = url.pathname.match(
      /^\/resources\/family-archives(?:\/(archives|chapters|memories)(?:\/([^/]+))?)?$/,
    );
  if (!match) return null;
  try {
    const session = await authenticateAppSession(request, env);
    if (!session) fail(401, "session_required");
    const user = session.userId;
    const kind = match[1],
      id = match[2] ? identifier(decodeURIComponent(match[2])) : null;
    if (request.method === "GET") {
      if (!kind) {
        const archives = (
          await env.DB.prepare(
            "SELECT id,title,description,version FROM family_archives WHERE owner_user_id=? ORDER BY created_at,id LIMIT ?",
          )
            .bind(user, limits.maximumArchives)
            .all<FamilyArchive>()
        ).results;
        const archiveId =
          url.searchParams.get("archiveId") ?? archives[0]?.id ?? null;
        if (archiveId) await archive(env, user, identifier(archiveId));
        const after = url.searchParams.get("afterChapter"),
          parts = after?.split(":");
        if (
          parts &&
          (parts.length !== 2 ||
            !/^\d{1,9}$/.test(parts[0]!) ||
            !idPattern.test(parts[1]!))
        )
          fail(400, "family_archive_invalid");
        const chapters = archiveId
          ? (
              await env.DB.prepare(
                "SELECT * FROM family_chapters WHERE archive_id=? AND (position>? OR (position=? AND id>?)) ORDER BY position,id LIMIT ?",
              )
                .bind(
                  archiveId,
                  parts ? Number(parts[0]) : -1,
                  parts ? Number(parts[0]) : -1,
                  parts?.[1] ?? "",
                  limits.listingPageSize + 1,
                )
                .all<ChapterRow>()
            ).results
          : [];
        const page = chapters.slice(0, limits.listingPageSize),
          last = page[page.length - 1];
        const cursor = url.searchParams.get("after");
        if (cursor) identifier(cursor);
        return json({
          archives,
          archiveId,
          chapters: await Promise.all(page.map((row) => chapterView(env, row))),
          nextChapterCursor:
            chapters.length > page.length
              ? `${last!.position}:${last!.id}`
              : null,
          ...(await memories(env, user, cursor)),
        });
      }
      if (kind === "chapters" && id)
        return json({
          chapter: await chapterView(env, await chapter(env, user, id)),
        });
      if (kind === "memories" && id) {
        const page = await memories(env, user, null, id);
        if (!page.memories[0]) fail(404, "family_archive_not_found");
        return json({ memory: page.memories[0] });
      }
      fail(404, "family_archive_not_found");
    }
    if (
      request.headers.get("X-Memories-Request") !== "family-v1" ||
      (request.headers.has("Origin") &&
        request.headers.get("Origin") !== url.origin)
    )
      fail(403, "csrf");
    if (!["POST", "PATCH", "DELETE"].includes(request.method))
      fail(405, "method");
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(
        (await readBoundedText(request, limits.maximumRequestBytes)) || "{}",
      );
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        fail(400, "family_archive_invalid");
      body = parsed;
    } catch (error) {
      if (error instanceof RequestBodyTooLarge)
        fail(413, "family_archive_invalid");
      throw new ArchiveError(400, "family_archive_invalid");
    }
    const key = identifier(request.headers.get("X-Idempotency-Key")),
      operation = `family_${kind}_${request.method}`,
      receiptKey = `family_${await sha256Text(`${user}:${operation}:${key}`)}`,
      requestHash = await sha256Text(JSON.stringify({ id, body }));
    async function prior() {
      const old = await env.DB.prepare(
        "SELECT request_hash,result_ref FROM operation_receipts WHERE idempotency_key=? AND scope_type='user' AND scope_id=? AND operation_kind=?",
      )
        .bind(receiptKey, user, operation)
        .first<{ request_hash: string; result_ref: string }>();
      if (old && old.request_hash !== requestHash)
        fail(409, "idempotency_conflict");
      return old ? JSON.parse(old.result_ref) : null;
    }
    const replay = await prior();
    if (replay) return json({ ...replay, replayed: true });
    const now = new Date().toISOString();
    function receipt(result: unknown) {
      return env.DB.prepare(
        "INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,result_ref,correlation_id,created_at,updated_at) SELECT ?,?,'user',?,?,'succeeded',?,?,?,? WHERE changes()=1",
      ).bind(
        receiptKey,
        operation,
        user,
        requestHash,
        JSON.stringify(result),
        receiptKey,
        now,
        now,
      );
    }
    const guard =
      "EXISTS(SELECT 1 FROM operation_receipts r WHERE r.idempotency_key=? AND r.request_hash=?)";
    if (kind === "archives" && request.method === "POST" && !id) {
      const title = text(body.title, limits.titleCharacters, true),
        description = text(
          body.description ?? "",
          limits.descriptionCharacters,
        ),
        archiveId = `family_archive_${(await sha256Text(receiptKey)).slice(0, 40)}`,
        result = { id: archiveId, version: 1 };
      try {
        const changes = await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO family_archives(id,owner_user_id,title,description,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM family_archives WHERE owner_user_id=?)<?",
          ).bind(
            archiveId,
            user,
            title,
            description,
            now,
            now,
            user,
            limits.maximumArchives,
          ),
          receipt(result),
        ]);
        if (!changes[0]!.meta.changes) fail(429, "family_archive_limit");
      } catch (error) {
        const old = await prior();
        if (old) return json({ ...old, replayed: true });
        throw error;
      }
      return json(result, 201);
    }
    if (kind === "archives" && id) {
      const current = await archive(env, user, id),
        expected = version(body.version);
      if (current.version !== expected) fail(409, "family_archive_conflict");
      const result = { id, version: expected + 1 },
        mutation =
          request.method === "DELETE"
            ? env.DB.prepare(
                "DELETE FROM family_archives WHERE id=? AND owner_user_id=? AND version=?",
              ).bind(id, user, expected)
            : request.method === "PATCH"
              ? env.DB.prepare(
                  "UPDATE family_archives SET title=?,description=?,version=version+1,updated_at=? WHERE id=? AND owner_user_id=? AND version=?",
                ).bind(
                  text(
                    body.title ?? current.title,
                    limits.titleCharacters,
                    true,
                  ),
                  text(
                    body.description ?? current.description,
                    limits.descriptionCharacters,
                  ),
                  now,
                  id,
                  user,
                  expected,
                )
              : null;
      if (!mutation) fail(405, "method");
      const results = await env.DB.batch([mutation, receipt(result)]);
      if (!results[0]!.meta.changes) {
        const old = await prior();
        if (old) return json({ ...old, replayed: true });
        fail(409, "family_archive_conflict");
      }
      return json(result);
    }
    if (kind === "chapters" && request.method === "POST" && !id) {
      const archiveId = identifier(body.archiveId);
      await archive(env, user, archiveId);
      const title = text(body.title, limits.titleCharacters, true),
        description = text(
          body.description ?? "",
          limits.descriptionCharacters,
        ),
        chapterId = `family_chapter_${(await sha256Text(receiptKey)).slice(0, 40)}`,
        result = { id: chapterId, version: 1 };
      try {
        const results = await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO family_chapters(id,archive_id,title,description,position,created_at,updated_at) SELECT ?,?,?,?,COALESCE((SELECT max(position)+1 FROM family_chapters WHERE archive_id=?),0),?,? WHERE (SELECT count(*) FROM family_chapters WHERE archive_id=?)<?",
          ).bind(
            chapterId,
            archiveId,
            title,
            description,
            archiveId,
            now,
            now,
            archiveId,
            limits.maximumChapters,
          ),
          receipt(result),
        ]);
        if (!results[0]!.meta.changes) fail(429, "family_archive_limit");
      } catch (error) {
        const old = await prior();
        if (old) return json({ ...old, replayed: true });
        throw error;
      }
      return json(result, 201);
    }
    if (kind === "chapters" && id) {
      const current = await chapter(env, user, id),
        expected = version(body.version);
      if (current.version !== expected) fail(409, "family_archive_conflict");
      const result = { id, version: expected + 1 };
      if (request.method === "DELETE") {
        const results = await env.DB.batch([
          env.DB.prepare(
            "DELETE FROM family_chapters WHERE id=? AND version=?",
          ).bind(id, expected),
          receipt(result),
        ]);
        if (!results[0]!.meta.changes) fail(409, "family_archive_conflict");
        return json(result);
      }
      if (request.method !== "PATCH") fail(405, "method");
      const archiveId =
        body.archiveId === undefined
          ? current.archive_id
          : identifier(body.archiveId);
      await archive(env, user, archiveId);
      if (archiveId !== current.archive_id) {
        const count = await env.DB.prepare(
          "SELECT count(*) AS n FROM family_chapters WHERE archive_id=?",
        )
          .bind(archiveId)
          .first<{ n: number }>();
        if ((count?.n ?? 0) >= limits.maximumChapters)
          fail(429, "family_archive_limit");
      }
      const previous = await chapterView(env, current),
        ids =
          body.memoryIds === undefined ? previous.memoryIds : body.memoryIds;
      if (
        !Array.isArray(ids) ||
        ids.length > limits.maximumMemoriesPerChapter ||
        new Set(ids).size !== ids.length
      )
        fail(400, "family_archive_invalid");
      for (const memory of ids) identifier(memory);
      const owned = await env.DB.prepare(
        "SELECT count(*) AS n FROM json_each(?) selected JOIN memory_stories m ON m.id=selected.value WHERE m.owner_user_id=? AND m.status='complete'",
      )
        .bind(JSON.stringify(ids), user)
        .first<{ n: number }>();
      if (owned?.n !== ids.length) fail(404, "family_archive_not_found");
      const cover =
        body.coverMemoryId === undefined
          ? current.cover_memory_id
          : body.coverMemoryId === null
            ? null
            : identifier(body.coverMemoryId);
      if (cover && !ids.includes(cover)) fail(400, "family_archive_invalid");
      const gated = `${guard} AND EXISTS(SELECT 1 FROM family_chapters c WHERE c.id=? AND c.version=?)`,
        params = [receiptKey, requestHash, id, expected + 1];
      const statements = [
        env.DB.prepare(
          "UPDATE family_chapters SET archive_id=?,title=?,description=?,cover_memory_id=NULL,version=version+1,updated_at=? WHERE id=? AND version=? AND (archive_id=? OR (SELECT count(*) FROM family_chapters WHERE archive_id=?)<?)",
        ).bind(
          archiveId,
          text(body.title ?? current.title, limits.titleCharacters, true),
          text(
            body.description ?? current.description,
            limits.descriptionCharacters,
          ),
          now,
          id,
          expected,
          archiveId,
          archiveId,
          limits.maximumChapters,
        ),
        receipt(result),
        env.DB.prepare(
          `DELETE FROM family_chapter_memories WHERE chapter_id=? AND ${gated} AND memory_story_id NOT IN (SELECT value FROM json_each(?))`,
        ).bind(id, ...params, JSON.stringify(ids)),
        env.DB.prepare(
          `INSERT INTO family_chapter_memories(chapter_id,memory_story_id,added_by_user_id,position,created_at) SELECT ?,selected.value,?,CAST(selected.key AS INTEGER),? FROM json_each(?) selected WHERE ${gated} ON CONFLICT(chapter_id,memory_story_id) DO UPDATE SET position=excluded.position`,
        ).bind(id, user, now, JSON.stringify(ids), ...params),
      ];
      statements.push(
        env.DB.prepare(
          `UPDATE family_chapters SET cover_memory_id=? WHERE id=? AND ${gated}`,
        ).bind(cover, id, ...params),
      );
      const results = await env.DB.batch(statements);
      if (!results[0]!.meta.changes) {
        const old = await prior();
        if (old) return json({ ...old, replayed: true });
        fail(409, "family_archive_conflict");
      }
      return json(result);
    }
    if (kind === "memories" && id && request.method === "PATCH") {
      if (
        !(await env.DB.prepare(
          "SELECT id FROM memory_stories WHERE id=? AND owner_user_id=?",
        )
          .bind(id, user)
          .first())
      )
        fail(404, "family_archive_not_found");
      const title = text(body.title, limits.titleCharacters, true),
        expected = body.version;
      if (
        typeof expected !== "number" ||
        !Number.isSafeInteger(expected) ||
        expected < 0
      )
        fail(400, "family_archive_invalid");
      const result = { id, version: expected + 1 };
      const mutation =
        expected === 0
          ? env.DB.prepare(
              "INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM family_memory_labels WHERE memory_story_id=?)",
            ).bind(id, title, user, now, id)
          : env.DB.prepare(
              "UPDATE family_memory_labels SET title=?,version=version+1,updated_at=? WHERE memory_story_id=? AND updated_by_user_id=? AND version=?",
            ).bind(title, now, id, user, expected);
      const results = await env.DB.batch([mutation, receipt(result)]);
      if (!results[0]!.meta.changes) fail(409, "family_archive_conflict");
      return json(result);
    }
    fail(405, "method");
  } catch (error) {
    const e =
      error instanceof ArchiveError
        ? error
        : new ArchiveError(503, "family_archive_unavailable");
    return json({ error: { code: e.code } }, e.status);
  }
}
