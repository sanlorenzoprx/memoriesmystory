import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import {
  familyTimelineLimits as limits,
  yearWrittenIn,
  type FamilyTimelineResponse,
} from "../app/domain/family-timeline";

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });

/**
 * The owner's own complete memories with the storyteller's current answer about
 * when. Storyteller context is private to the owner, so there is no family mode.
 */
export async function handleFamilyTimelineRoute(
  request: Request,
  env: AuthSessionEnv,
): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/resources/family-timeline")
    return null;
  try {
    if (request.method !== "GET")
      return json({ error: { code: "method" } }, 405);
    const session = await authenticateAppSession(request, env);
    if (!session) return json({ error: { code: "session_required" } }, 401);
    const rows = (
      await env.DB.prepare(
        // Only the latest answer for "time" counts; an earlier one is history, not the timeline.
        "SELECT m.id,l.title,e.value,e.context_state FROM memory_stories m LEFT JOIN family_memory_labels l ON l.memory_story_id=m.id LEFT JOIN living_memory_context_entries e ON e.memory_story_id=m.id AND e.kind='time' AND e.rowid=(SELECT x.rowid FROM living_memory_context_entries x WHERE x.memory_story_id=m.id AND x.kind='time' ORDER BY x.created_at DESC,x.rowid DESC LIMIT 1) WHERE m.owner_user_id=? AND m.status='complete' ORDER BY m.id LIMIT ?",
      )
        .bind(session.userId, limits.maximumEntries + 1)
        .all<{
          id: string;
          title: string | null;
          value: string | null;
          context_state: string | null;
        }>()
    ).results;
    const response: FamilyTimelineResponse = {
      truncated: rows.length > limits.maximumEntries,
      entries: rows.slice(0, limits.maximumEntries).map((row) => {
        const said =
          (row.context_state === "stated" ||
            row.context_state === "approximate") &&
          row.value?.trim()
            ? row.value
            : null;
        return {
          memoryId: row.id,
          title: row.title,
          when: said
            ? { text: said, approximate: row.context_state === "approximate" }
            : null,
          orderingYear: said ? yearWrittenIn(said) : null,
        };
      }),
    };
    return json(response);
  } catch {
    return json({ error: { code: "family_timeline_unavailable" } }, 503);
  }
}
