import {
  authenticateAppSession,
  sha256Text,
  type AuthSessionEnv,
} from "./auth-session";
import { readBoundedText } from "./request-body";
import { phase1Config } from "../config/phase-1";
const limits = phase1Config.familyPeople;
const validId = /^[A-Za-z0-9_-]{8,120}$/;
class PeopleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
function fail(status: number, code = "family_archive_invalid"): never {
  throw new PeopleError(status, code);
}
function id(value: unknown): string {
  if (typeof value !== "string" || !validId.test(value)) fail(400);
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim().length > max) fail(400);
  return value.trim();
}
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
type Env = AuthSessionEnv;
type Row = {
  id: string;
  archive_id: string;
  kind: string;
  document_json: string;
  active: number;
  version: number;
  created_by_user_id: string;
};
const view = (row: Row) => ({
  id: row.id,
  archiveId: row.archive_id,
  kind: row.kind,
  document: JSON.parse(row.document_json),
  active: Boolean(row.active),
  version: row.version,
  authorId: row.created_by_user_id,
});
export async function handlePeopleRoute(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url),
    match = url.pathname.match(
      /^\/resources\/family-people(?:\/(person|relationship)(?:\/([^/]+)(?:\/(memories))?)?)?$/,
    );
  if (!match) return null;
  try {
    const session = await authenticateAppSession(request, env);
    if (!session) fail(401, "session_required");
    const user = session.userId;
    // A person album is read-only; it never accepts a change.
    if (match[3] && request.method !== "GET") fail(405, "method");
    const recordId = match[2] ? id(decodeURIComponent(match[2])) : null,
      kind = match[1];
    const existing = recordId
      ? await env.DB.prepare(
          "SELECT p.* FROM family_people_records p JOIN family_archives a ON a.id=p.archive_id WHERE p.id=? AND p.kind=? AND a.owner_user_id=?",
        )
          .bind(recordId, kind, user)
          .first<Row>()
      : null;
    if (recordId && !existing) fail(404, "family_archive_not_found");
    const archiveId =
      existing?.archive_id ?? id(url.searchParams.get("archiveId"));
    if (
      !(await env.DB.prepare(
        "SELECT id FROM family_archives WHERE id=? AND owner_user_id=?",
      )
        .bind(archiveId, user)
        .first())
    )
      fail(404, "family_archive_not_found");
    if (request.method === "GET") {
      if (existing && match[3] === "memories") {
        // A person album: the complete memories a human linked to this person.
        // Nothing is matched by face, voice or name; a removed person has none.
        if (existing.kind !== "person") fail(404, "family_archive_not_found");
        const document = JSON.parse(existing.document_json) as {
          label?: string;
          memoryIds?: unknown;
        };
        const linked =
          existing.active && Array.isArray(document.memoryIds)
            ? document.memoryIds
                .filter(
                  (value): value is string =>
                    typeof value === "string" && validId.test(value),
                )
                .slice(0, limits.maximumMemoryReferences)
            : [];
        const rows = linked.length
          ? (
              await env.DB.prepare(
                "SELECT m.id,l.title,p.id AS photo_id,p.draft_id AS photo_draft FROM json_each(?1) j JOIN memory_stories m ON m.id=j.value LEFT JOIN family_memory_labels l ON l.memory_story_id=m.id LEFT JOIN media_assets p ON p.id=m.primary_photo_asset_id AND p.memory_story_id=m.id AND p.role='original_photo' AND p.durability_status='durable' WHERE m.owner_user_id=?2 AND m.status='complete' ORDER BY j.key",
              )
                .bind(JSON.stringify(linked), user)
                .all<{
                  id: string;
                  title: string | null;
                  photo_id: string | null;
                  photo_draft: string | null;
                }>()
            ).results
          : [];
        return json({
          person: {
            id: existing.id,
            label: typeof document.label === "string" ? document.label : "",
            active: Boolean(existing.active),
          },
          memories: rows.map((row) => ({
            id: row.id,
            title: row.title,
            photoUrl:
              row.photo_id && row.photo_draft
                ? `/resources/drafts/${encodeURIComponent(row.photo_draft)}/media/${encodeURIComponent(row.photo_id)}`
                : null,
          })),
        });
      }
      if (match[3]) fail(404, "family_archive_not_found");
      if (existing) {
        const history = (
          await env.DB.prepare(
            "SELECT version,document_json,active,actor_user_id,recorded_at FROM family_people_history WHERE record_id=? ORDER BY version DESC LIMIT ?",
          )
            .bind(existing.id, limits.historyPageSize)
            .all<{
              version: number;
              document_json: string;
              active: number;
              actor_user_id: string;
              recorded_at: string;
            }>()
        ).results;
        return json({
          record: view(existing),
          history: history.map((h) => ({
            version: h.version,
            document: JSON.parse(h.document_json),
            active: Boolean(h.active),
            authorId: h.actor_user_id,
            recordedAt: h.recorded_at,
          })),
        });
      }
      const cursor = url.searchParams.get("after");
      if (cursor) id(cursor);
      const rows = (
        await env.DB.prepare(
          "SELECT * FROM family_people_records WHERE archive_id=? AND id>? ORDER BY id LIMIT ?",
        )
          .bind(archiveId, cursor ?? "", limits.pageSize + 1)
          .all<Row>()
      ).results;
      const page = rows.slice(0, limits.pageSize);
      return json({
        records: page.map(view),
        nextCursor: rows.length > page.length ? page.at(-1)!.id : null,
      });
    }
    if (
      request.headers.get("X-Memories-Request") !== "family-v1" ||
      (request.headers.has("Origin") &&
        request.headers.get("Origin") !== url.origin)
    )
      fail(403, "csrf");
    if (!["POST", "PATCH", "DELETE"].includes(request.method) || !kind)
      fail(405, "method");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(
        await readBoundedText(request, limits.maximumRequestBytes),
      );
      if (!body || typeof body !== "object" || Array.isArray(body)) fail(400);
    } catch {
      fail(400);
    }
    const key = id(request.headers.get("X-Idempotency-Key")),
      operation = `people_${kind}_${request.method}`,
      receiptKey = `people_${await sha256Text(`${user}:${operation}:${key}`)}`,
      hash = await sha256Text(JSON.stringify({ recordId, archiveId, body }));
    async function prior() {
      const row = await env.DB.prepare(
        "SELECT request_hash,result_ref FROM operation_receipts WHERE idempotency_key=? AND scope_type='user' AND scope_id=?",
      )
        .bind(receiptKey, user)
        .first<{ request_hash: string; result_ref: string }>();
      if (row && row.request_hash !== hash) fail(409, "idempotency_conflict");
      return row ? JSON.parse(row.result_ref) : null;
    }
    const old = await prior();
    if (old) return json({ ...old, replayed: true });
    if (
      (request.method === "POST" && existing) ||
      (request.method !== "POST" && !existing)
    )
      fail(405, "method");
    const expected = existing ? body.version : 0;
    if (
      !Number.isSafeInteger(expected) ||
      expected !== Number(expected) ||
      Number(expected) < 0 ||
      (existing && expected !== existing.version)
    )
      fail(409, "family_archive_conflict");
    const active =
      request.method === "DELETE" ? 0 : body.active === false ? 0 : 1;
    let document: Record<string, unknown>;
    if (request.method === "DELETE")
      document = JSON.parse(existing!.document_json);
    else {
      const supplied = body.document;
      if (!supplied || typeof supplied !== "object" || Array.isArray(supplied))
        fail(400);
      const value = supplied as Record<string, unknown>;
      if (kind === "person") {
        const memoryIds = value.memoryIds;
        if (
          !Array.isArray(memoryIds) ||
          memoryIds.length > limits.maximumMemoryReferences ||
          new Set(memoryIds).size !== memoryIds.length
        )
          fail(400);
        for (const memory of memoryIds) id(memory);
        const owned = await env.DB.prepare(
          "SELECT count(*) AS n FROM json_each(?) j JOIN memory_stories m ON m.id=j.value WHERE m.owner_user_id=? AND m.status='complete'",
        )
          .bind(JSON.stringify(memoryIds), user)
          .first<{ n: number }>();
        if (owned?.n !== memoryIds.length)
          fail(404, "family_archive_not_found");
        if (
          !["known", "approximate", "unknown"].includes(
            String(value.datePrecision),
          )
        )
          fail(400);
        document = {
          label: text(value.label, limits.labelCharacters),
          notes: text(value.notes, limits.notesCharacters),
          dateText: text(value.dateText, limits.dateCharacters),
          datePrecision: value.datePrecision,
          memoryIds,
        };
        if (value.datePrecision === "unknown" && document.dateText) fail(400);
      } else {
        const fromId = id(value.fromId),
          toId = id(value.toId);
        if (
          fromId === toId ||
          !["relationship", "same_person"].includes(String(value.type)) ||
          !["stated", "uncertain", "unknown"].includes(String(value.certainty))
        )
          fail(400);
        const people = await env.DB.prepare(
          "SELECT count(*) AS n FROM family_people_records WHERE archive_id=? AND kind='person' AND active=1 AND id IN (?,?)",
        )
          .bind(archiveId, fromId, toId)
          .first<{ n: number }>();
        if (people?.n !== 2) fail(404, "family_archive_not_found");
        document = {
          fromId,
          toId,
          label: text(value.label, limits.labelCharacters),
          type: value.type,
          certainty: value.certainty,
        };
        if (value.type === "relationship" && !document.label) fail(400);
      }
    }
    const now = new Date().toISOString(),
      newId =
        recordId ??
        `family_person_${(await sha256Text(receiptKey)).slice(0, 40)}`,
      nextVersion = Number(expected) + 1,
      result = { id: newId, version: nextVersion };
    const mutation = existing
      ? env.DB.prepare(
          "UPDATE family_people_records SET document_json=?,active=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        ).bind(JSON.stringify(document), active, now, newId, expected)
      : env.DB.prepare(
          "INSERT INTO family_people_records(id,archive_id,kind,document_json,created_by_user_id,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM family_people_records WHERE archive_id=?)<?",
        ).bind(
          newId,
          archiveId,
          kind,
          JSON.stringify(document),
          user,
          now,
          now,
          archiveId,
          limits.maximumRecords,
        );
    try {
      const results = await env.DB.batch([
        mutation,
        env.DB.prepare(
          "INSERT INTO operation_receipts(idempotency_key,operation_kind,scope_type,scope_id,request_hash,status,result_ref,correlation_id,created_at,updated_at) SELECT ?,?,'user',?,?,'succeeded',?,?,?,? WHERE changes()=1",
        ).bind(
          receiptKey,
          operation,
          user,
          hash,
          JSON.stringify(result),
          receiptKey,
          now,
          now,
        ),
        env.DB.prepare(
          "INSERT INTO family_people_history(record_id,version,document_json,active,actor_user_id,recorded_at) SELECT id,version,document_json,active,?,? FROM family_people_records WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM operation_receipts WHERE idempotency_key=? AND request_hash=?)",
        ).bind(user, now, newId, nextVersion, receiptKey, hash),
      ]);
      if (!results[0]!.meta.changes) {
        const replay = await prior();
        if (replay) return json({ ...replay, replayed: true });
        fail(
          existing ? 409 : 429,
          existing ? "family_archive_conflict" : "family_archive_limit",
        );
      }
    } catch (error) {
      const replay = await prior();
      if (replay) return json({ ...replay, replayed: true });
      throw error;
    }
    return json(result, existing ? 200 : 201);
  } catch (error) {
    return error instanceof PeopleError
      ? json({ error: { code: error.code } }, error.status)
      : json({ error: { code: "family_archive_unavailable" } }, 503);
  }
}
