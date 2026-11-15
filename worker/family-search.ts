import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import { activeFamilyGrant, type FamilyGrant } from "./family-permissions";
import {
  familySearchLimits as limits,
  matchesSearch,
  normalizeSearchQuery,
  searchLikePattern,
  searchSnippet,
  type FamilySearchMatch,
  type FamilySearchMatchKind,
  type FamilySearchResponse,
  type FamilySearchResult,
} from "../app/domain/family-search";

class SearchError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
function fail(status: number, code: string): never {
  throw new SearchError(status, code);
}
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
const idPattern = /^[A-Za-z0-9_-]{8,120}$/;

type Candidate = {
  memory_id: string;
  kind: string;
  body: string;
  attribution: string | null;
  approximate: number;
};

// Every source is restricted to complete memories owned by one account (?1) and
// matched coarsely by ?2; exact matching happens afterwards on the returned text.
const like = "LIKE ?2 ESCAPE '\\'";
const ownedMemory =
  "EXISTS(SELECT 1 FROM memory_stories m WHERE m.id=%ID% AND m.owner_user_id=?1 AND m.status='complete')";
const owned = (column: string) => ownedMemory.replace("%ID%", column);

const titleSource = `SELECT l.memory_story_id AS memory_id,'title' AS kind,l.title AS body,NULL AS attribution,0 AS approximate FROM family_memory_labels l WHERE l.title ${like} AND ${owned("l.memory_story_id")}`;

// Private organization, people and storyteller context: the owner's view only.
const ownerOnlySources = [
  `SELECT cm.memory_story_id,'chapter',c.title,NULL,0 FROM family_chapters c JOIN family_archives a ON a.id=c.archive_id AND a.owner_user_id=?1 JOIN family_chapter_memories cm ON cm.chapter_id=c.id WHERE (c.title ${like} OR c.description ${like}) AND ${owned("cm.memory_story_id")}`,
  `SELECT j.value,'person',json_extract(r.document_json,'$.label'),NULL,0 FROM family_people_records r JOIN family_archives a ON a.id=r.archive_id AND a.owner_user_id=?1, json_each(r.document_json,'$.memoryIds') j WHERE r.kind='person' AND r.active=1 AND json_extract(r.document_json,'$.label') ${like} AND ${owned("j.value")}`,
  // Only the storyteller's current answer for each detail, never a superseded one.
  `SELECT e.memory_story_id,'context_'||e.kind,e.value,NULL,CASE e.context_state WHEN 'approximate' THEN 1 ELSE 0 END FROM living_memory_context_entries e WHERE e.context_state IN ('stated','approximate') AND e.value ${like} AND e.rowid=(SELECT x.rowid FROM living_memory_context_entries x WHERE x.memory_story_id=e.memory_story_id AND x.kind=e.kind ORDER BY x.created_at DESC,x.rowid DESC LIMIT 1) AND ${owned("e.memory_story_id")}`,
  // The owner may find any submitted recollection awaiting or past review.
  `SELECT c.memory_story_id,'recollection',v.human_text,v.attribution,0 FROM family_contributions c JOIN family_contribution_revisions v ON v.id=c.latest_revision_id AND v.contribution_id=c.id WHERE c.owner_user_id=?1 AND c.author_state='submitted' AND v.human_text ${like} AND ${owned("c.memory_story_id")}`,
  `SELECT c.memory_story_id,'written_words',t.written_text,s.attribution,0 FROM family_contributions c JOIN family_contribution_voice_sources s ON s.contribution_id=c.id JOIN family_contribution_voice_transcripts t ON t.contribution_id=c.id WHERE c.owner_user_id=?1 AND c.author_state='submitted' AND t.written_text ${like} AND t.rowid=(SELECT max(x.rowid) FROM family_contribution_voice_transcripts x WHERE x.contribution_id=c.id) AND ${owned("c.memory_story_id")}`,
];

// The grant that let a relative contribute must still hold for family to see it.
const sourceGrantHolds = (grantColumn: string) =>
  `(c.author_user_id=c.owner_user_id OR EXISTS(SELECT 1 FROM family_access_grants sg WHERE sg.id=${grantColumn} AND sg.state='accepted' AND sg.accepted_by_user_id=c.author_user_id AND sg.owner_user_id=c.owner_user_id AND sg.role='contributor' AND ((sg.scope_kind='memory' AND sg.scope_id=c.memory_story_id) OR (sg.scope_kind<>'memory' AND EXISTS(SELECT 1 FROM family_chapter_memories scm JOIN family_chapters sc ON sc.id=scm.chapter_id WHERE scm.memory_story_id=c.memory_story_id AND sc.archive_id=sg.archive_id AND (sg.scope_kind='archive' OR sc.id=sg.scope_id))))))`;

// Invited family: titles plus only what the owner included for family.
const memberSources = [
  `SELECT c.memory_story_id,'recollection',v.human_text,v.attribution,0 FROM family_contributions c JOIN family_contribution_revisions v ON v.id=c.included_revision_id AND v.contribution_id=c.id WHERE c.owner_user_id=?1 AND c.author_state='submitted' AND v.human_text ${like} AND ${sourceGrantHolds("v.source_grant_id")} AND ${owned("c.memory_story_id")}`,
  `SELECT c.memory_story_id,'written_words',t.written_text,s.attribution,0 FROM family_contributions c JOIN family_contribution_voice_sources s ON s.contribution_id=c.id AND s.id=c.included_revision_id JOIN family_contribution_transcript_pins p ON p.contribution_id=c.id JOIN family_contribution_voice_transcripts t ON t.id=p.transcript_id WHERE c.owner_user_id=?1 AND c.author_state='submitted' AND t.written_text ${like} AND ${sourceGrantHolds("s.source_grant_id")} AND ${owned("c.memory_story_id")}`,
];

// ?3 = scope kind, ?4 = scope id, ?5 = archive id of the viewer's grant.
const inGrantScope =
  "((?3='memory' AND q.memory_id=?4) OR (?3<>'memory' AND EXISTS(SELECT 1 FROM family_chapter_memories gcm JOIN family_chapters gc ON gc.id=gcm.chapter_id WHERE gcm.memory_story_id=q.memory_id AND gc.archive_id=?5 AND (?3='archive' OR gc.id=?4))))";

export async function handleFamilySearchRoute(
  request: Request,
  env: AuthSessionEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/resources/family-search") return null;
  try {
    if (request.method !== "GET") fail(405, "method");
    const session = await authenticateAppSession(request, env);
    if (!session) fail(401, "session_required");
    const query = normalizeSearchQuery(url.searchParams.get("q"));
    if (!query) fail(400, "family_search_invalid");
    const grantId = url.searchParams.get("grantId");
    let grant: FamilyGrant | null = null;
    if (grantId) {
      if (!idPattern.test(grantId)) fail(400, "family_search_invalid");
      grant = await activeFamilyGrant(env, session.userId, grantId);
      if (!grant) fail(403, "family_search_denied");
    }
    const owner = grant ? grant.owner_user_id : session.userId,
      sources = [titleSource, ...(grant ? memberSources : ownerOnlySources)],
      sql = `SELECT q.memory_id,q.kind,q.body,q.attribution,q.approximate FROM (${sources.join(" UNION ALL ")}) q${grant ? ` WHERE ${inGrantScope}` : ""} ORDER BY q.memory_id,q.kind LIMIT ?${grant ? 6 : 3}`,
      statement = env.DB.prepare(sql),
      rows = (
        await (grant
          ? statement.bind(
              owner,
              searchLikePattern(query),
              grant.scope_kind,
              grant.scope_id,
              grant.archive_id,
              limits.candidateRows + 1,
            )
          : statement.bind(
              owner,
              searchLikePattern(query),
              limits.candidateRows + 1,
            )
        ).all<Candidate>()
      ).results;
    // Access removed while the query ran must not return anything.
    if (grant && !(await activeFamilyGrant(env, session.userId, grant.id)))
      fail(403, "family_search_denied");

    const grouped = new Map<string, FamilySearchMatch[]>();
    let truncated = rows.length > limits.candidateRows;
    for (const row of rows.slice(0, limits.candidateRows)) {
      if (typeof row.body !== "string" || !matchesSearch(row.body, query))
        continue;
      const matches = grouped.get(row.memory_id) ?? [];
      if (!grouped.has(row.memory_id)) {
        if (grouped.size >= limits.maximumMemories) {
          truncated = true;
          continue;
        }
        grouped.set(row.memory_id, matches);
      }
      if (matches.length >= limits.maximumMatchesPerMemory) {
        truncated = true;
        continue;
      }
      matches.push({
        kind: row.kind as FamilySearchMatchKind,
        text: searchSnippet(row.body, query),
        attribution: row.attribution,
        approximate: row.approximate === 1,
      });
    }
    const ids = [...grouped.keys()],
      titles = ids.length
        ? (
            await env.DB.prepare(
              `SELECT memory_story_id,title FROM family_memory_labels WHERE memory_story_id IN (${ids.map(() => "?").join(",")})`,
            )
              .bind(...ids)
              .all<{ memory_story_id: string; title: string }>()
          ).results
        : [];
    const results: FamilySearchResult[] = ids.map((memoryId) => ({
      memoryId,
      title:
        titles.find((row) => row.memory_story_id === memoryId)?.title ?? null,
      matches: grouped.get(memoryId)!,
    }));
    const response: FamilySearchResponse = { query, results, truncated };
    return json(response);
  } catch (error) {
    return error instanceof SearchError
      ? json({ error: { code: error.code } }, error.status)
      : json({ error: { code: "family_search_unavailable" } }, 503);
  }
}
