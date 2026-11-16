import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";

/**
 * What Muse remembers, and where the person left off (Talk with Muse M2,
 * docs/DECISIONS/2026-11-16-talk-with-muse.md).
 *
 * Muse's memory is not a separate store: it is the person's own confirmed
 * people, places, times and events, already kept with their source on each
 * Living Memory. The person sees all of it, can open the memory it came from
 * to change it, and can tell Muse to stop bringing any of it up elsewhere.
 * Nothing here is inferred, and nothing is shared with anyone.
 */
export type RememberedEntry = {
  readonly id: string;
  readonly memoryId: string;
  readonly memoryTitle: string | null;
  readonly kind: "person" | "place" | "time" | "event";
  readonly value: string;
  readonly approximate: boolean;
  readonly forgotten: boolean;
  readonly updatedAt: string;
};

export type LeftOff = { readonly draftId: string; readonly updatedAt: string; readonly unfinished: number } | null;

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });

const rememberedLimit = 200;

/** The latest confirmed value of each kind on each of the person's memories. */
export async function readRemembered(
  env: { DB: D1Database },
  userId: string,
  options: { exceptMemoryId?: string; includeForgotten?: boolean; limit?: number } = {},
): Promise<RememberedEntry[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.memory_story_id, c.kind, c.value, c.context_state, c.updated_at, l.title,
            CASE WHEN x.context_entry_id IS NULL THEN 0 ELSE 1 END AS forgotten
     FROM living_memory_context_entries c
     JOIN memory_stories m ON m.id = c.memory_story_id AND m.owner_user_id = ?1
     LEFT JOIN family_memory_labels l ON l.memory_story_id = c.memory_story_id
     LEFT JOIN muse_memory_exclusions x ON x.context_entry_id = c.id AND x.user_id = ?1
     WHERE c.context_state IN ('stated', 'approximate')
       AND c.memory_story_id <> ?2
       AND NOT EXISTS (
         SELECT 1 FROM living_memory_context_entries n
         WHERE n.memory_story_id = c.memory_story_id AND n.kind = c.kind
           AND (n.created_at > c.created_at OR (n.created_at = c.created_at AND n.rowid > c.rowid))
       )
     ORDER BY c.updated_at DESC, c.id
     LIMIT ?3`,
  )
    .bind(userId, options.exceptMemoryId ?? "", Math.min(options.limit ?? rememberedLimit, rememberedLimit))
    .all<{ id: string; memory_story_id: string; kind: RememberedEntry["kind"]; value: string; context_state: string; updated_at: string; title: string | null; forgotten: number }>();
  return results
    .filter((row) => options.includeForgotten || row.forgotten === 0)
    .map((row) => ({
      id: row.id,
      memoryId: row.memory_story_id,
      memoryTitle: row.title,
      kind: row.kind,
      value: row.value,
      approximate: row.context_state === "approximate",
      forgotten: row.forgotten === 1,
      updatedAt: row.updated_at,
    }));
}

/** The unfinished memory the person touched most recently, and how many are unfinished. */
export async function readLeftOff(env: { DB: D1Database }, userId: string, now = new Date()): Promise<LeftOff> {
  const { results } = await env.DB.prepare(
    `SELECT id, updated_at, COUNT(*) OVER () AS unfinished
     FROM memory_story_drafts
     WHERE owner_user_id = ? AND status <> 'complete' AND expires_at > ?
     ORDER BY updated_at DESC, id
     LIMIT 1`,
  )
    .bind(userId, now.toISOString())
    .all<{ id: string; updated_at: string; unfinished: number }>();
  const row = results[0];
  return row ? { draftId: row.id, updatedAt: row.updated_at, unfinished: row.unfinished } : null;
}

export async function handleMuseMemoryRoute(request: Request, env: AuthSessionEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== "/resources/muse/memory" && path !== "/resources/muse/memory/forget") return null;
  const session = await authenticateAppSession(request, env);
  if (!session) return json({ error: { code: "session_required" } }, 401);

  if (path === "/resources/muse/memory") {
    if (request.method !== "GET") return json({ error: { code: "method" } }, 405);
    return json({
      leftOff: await readLeftOff(env, session.userId),
      remembered: await readRemembered(env, session.userId, { includeForgotten: true }),
    });
  }

  if (request.method !== "POST") return json({ error: { code: "method" } }, 405);
  if (request.headers.get("X-Memories-Request") !== "muse-memory-v1") return json({ error: { code: "muse_memory_invalid" } }, 400);
  const body = (await request.json().catch(() => null)) as { contextEntryId?: unknown; forgotten?: unknown } | null;
  if (!body || typeof body.contextEntryId !== "string" || body.contextEntryId.length > 200 || typeof body.forgotten !== "boolean")
    return json({ error: { code: "muse_memory_invalid" } }, 400);
  const owned = await env.DB.prepare(
    `SELECT 1 AS ok FROM living_memory_context_entries c
     JOIN memory_stories m ON m.id = c.memory_story_id
     WHERE c.id = ? AND m.owner_user_id = ?`,
  )
    .bind(body.contextEntryId, session.userId)
    .first<{ ok: number }>();
  // Someone else's entry looks the same as one that does not exist.
  if (!owned) return json({ error: { code: "muse_memory_not_found" } }, 404);
  await (body.forgotten
    ? env.DB.prepare("INSERT OR IGNORE INTO muse_memory_exclusions(user_id, context_entry_id, created_at) VALUES (?, ?, ?)").bind(
        session.userId,
        body.contextEntryId,
        new Date().toISOString(),
      )
    : env.DB.prepare("DELETE FROM muse_memory_exclusions WHERE user_id = ? AND context_entry_id = ?").bind(session.userId, body.contextEntryId)
  ).run();
  return json({ remembered: await readRemembered(env, session.userId, { includeForgotten: true }) });
}
