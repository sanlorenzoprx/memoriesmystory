/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { addSyntheticMemory, setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleDeletionRoute } from "../../worker/deletion";
import { handleFamilySearchRoute } from "../../worker/family-search";
import type { FamilySearchResponse } from "../../app/domain/family-search";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
const agreement = "family-contribution-review-v1";

async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const db = s.db.database,
    now = "2026-11-15T00:00:00.000Z",
    owner = "owner_legacy_test",
    archive = "family_search_archive",
    other = await addSyntheticMemory(s, "memory_search_second");
  db.prepare("INSERT INTO family_archives(id,owner_user_id,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(archive, owner, "Synthetic family", "", now, now);
  db.prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)").run(s.memory, "La cocina de la tía María", owner, now);
  db.prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)").run(other, "Beach day", owner, now);
  db.prepare("INSERT INTO family_chapters(id,archive_id,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("chapter_search_one", archive, "Summers in Mayagüez", "", now, now);
  db.prepare("INSERT INTO family_chapter_memories(chapter_id,memory_story_id,added_by_user_id,position,created_at) VALUES(?,?,?,0,?)").run("chapter_search_one", other, owner, now);
  db.prepare("INSERT INTO family_people_records(id,archive_id,kind,document_json,created_by_user_id,created_at,updated_at) VALUES(?,?,'person',?,?,?,?)").run(
    "person_search_one", archive,
    JSON.stringify({ label: "Abuelo Joaquín", notes: "", dateText: "", datePrecision: "unknown", memoryIds: [other] }),
    owner, now, now,
  );
  const context = db.prepare("INSERT INTO living_memory_context_entries(id,memory_story_id,kind,value,context_state,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)");
  // A superseded answer must never be found; only the storyteller's current one.
  context.run("context_search_old", s.memory, "place", "Ponce", "stated", owner, "2026-11-14T00:00:00.000Z", "2026-11-14T00:00:00.000Z");
  context.run("context_search_new", s.memory, "place", "San Germán", "approximate", owner, now, now);
  context.run("context_search_time", s.memory, "time", null, "unknown", owner, now, now);

  const cookies: Record<string, string> = { owner: s.owner },
    grants: Record<string, string> = {};
  for (const [user, scopeKind, scopeId, role] of [
    ["member_memory", "memory", s.memory, "contributor"],
    ["member_chapter", "chapter", "chapter_search_one", "viewer"],
    ["member_archive", "archive", archive, "viewer"],
    ["stranger_user", "", "", ""],
  ] as const) {
    db.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run(user, now, now);
    cookies[user] = (await createAppSession(s.env, user)).cookie.split(";")[0];
    if (!scopeKind) continue;
    grants[user] = `grant_${user}`;
    db.prepare(
      "INSERT INTO family_access_grants(id,archive_id,owner_user_id,role,scope_kind,scope_id,target_email,token_hash,state,accepted_by_user_id,accepted_at,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'accepted',?,?,'2099-01-01T00:00:00Z',?,?)",
    ).run(grants[user], archive, owner, role, scopeKind, scopeId, `${user}@example.test`, `hash_${user}`, user, now, now, now);
  }
  // One written recollection from an invited contributor, not yet included.
  db.prepare("INSERT INTO family_contributions(id,memory_story_id,owner_user_id,author_user_id,author_state,latest_revision_id,created_at,updated_at) VALUES(?,?,?,?,'submitted',?,?,?)").run("contribution_search_one", s.memory, owner, "member_memory", "revision_search_one", now, now);
  db.prepare("INSERT INTO family_contribution_revisions(id,contribution_id,author_user_id,source_grant_id,attribution,human_text,agreement_version,created_at) VALUES(?,?,?,?,?,?,?,?)").run(
    "revision_search_one", "contribution_search_one", "member_memory", grants.member_memory, "Prima Lucía",
    `${"Era domingo. ".repeat(30)}Yo recuerdo el olor a sofrito en esa cocina.${" Después cantamos.".repeat(30)}`,
    agreement, now,
  );
  async function search(actor: string, q: string, grant?: string) {
    return (await handleFamilySearchRoute(
      new Request(
        `https://example.test/resources/family-search?q=${encodeURIComponent(q)}${grant ? `&grantId=${grant}` : ""}`,
        { headers: { Cookie: cookies[actor] ?? "" } },
      ),
      s.env,
    ))!;
  }
  async function found(actor: string, q: string, grant?: string) {
    const response = await search(actor, q, grant);
    expect(response.status).toBe(200);
    return (await response.json()) as FamilySearchResponse;
  }
  return { ...s, db, other, grants, search, found };
}

describe("authorized literal search of a family archive", () => {
  it("finds the owner's memories by title, Chapter, person, current context and recollection, across accents", async () => {
    const s = await setup();
    const title = await s.found("owner", "tia maria");
    expect(title.results).toEqual([
      { memoryId: s.memory, title: "La cocina de la tía María", matches: [{ kind: "title", text: "La cocina de la tía María", attribution: null, approximate: false }] },
    ]);
    expect((await s.found("owner", "MAYAGUEZ")).results[0]).toMatchObject({ memoryId: s.other, matches: [{ kind: "chapter", text: "Summers in Mayagüez" }] });
    expect((await s.found("owner", "joaquin")).results[0]).toMatchObject({ memoryId: s.other, matches: [{ kind: "person", text: "Abuelo Joaquín" }] });
    // An approximate place stays marked approximate; the superseded answer is not found.
    expect((await s.found("owner", "san german")).results[0].matches).toEqual([
      { kind: "context_place", text: "San Germán", attribution: null, approximate: true },
    ]);
    expect((await s.found("owner", "Ponce")).results).toEqual([]);
    const recollection = (await s.found("owner", "sofrito")).results[0].matches[0];
    expect(recollection).toMatchObject({ kind: "recollection", attribution: "Prima Lucía" });
    // The snippet is the person's own words, cut but not rewritten.
    expect(recollection.text).toContain("Yo recuerdo el olor a sofrito en esa cocina.");
    expect(recollection.text.length).toBeLessThan(260);
    expect((await s.found("owner", "nothing-like-this")).results).toEqual([]);
  });

  it("gives invited family only titles and owner-included words inside their own scope", async () => {
    const s = await setup(),
      memoryGrant = s.grants.member_memory,
      chapterGrant = s.grants.member_chapter;
    // In scope: the shared memory's title. Out of scope: the other memory.
    expect((await s.found("member_memory", "cocina", memoryGrant)).results.map((r) => r.memoryId)).toEqual([s.memory]);
    expect((await s.found("member_memory", "beach", memoryGrant)).results).toEqual([]);
    expect((await s.found("member_chapter", "beach", chapterGrant)).results.map((r) => r.memoryId)).toEqual([s.other]);
    expect((await s.found("member_chapter", "cocina", chapterGrant)).results).toEqual([]);
    // Private organization, people and storyteller context are never searchable by family.
    for (const q of ["mayaguez", "joaquin", "san german"])
      expect((await s.found("member_chapter", q, chapterGrant)).results).toEqual([]);
    // A recollection is searchable by family only after the owner includes it.
    expect((await s.found("member_memory", "sofrito", memoryGrant)).results[0]?.matches.some((m) => m.kind === "recollection") ?? false).toBe(false);
    s.db.prepare("UPDATE family_contributions SET included_revision_id='revision_search_one',version=version+1 WHERE id='contribution_search_one'").run();
    expect((await s.found("member_memory", "sofrito", memoryGrant)).results[0].matches[0]).toMatchObject({ kind: "recollection", attribution: "Prima Lucía" });
    // Removing the Chapter reference removes the result on the next search.
    s.db.prepare("DELETE FROM family_chapter_memories WHERE chapter_id='chapter_search_one'").run();
    expect((await s.found("member_chapter", "beach", chapterGrant)).results).toEqual([]);
  });

  it("returns nothing after revocation, to strangers, across families, or for deleted memories", async () => {
    const s = await setup(),
      grant = s.grants.member_memory;
    s.db.prepare("UPDATE family_contributions SET included_revision_id='revision_search_one',version=version+1 WHERE id='contribution_search_one'").run();
    // Another account's own search never reaches this owner's archive.
    expect((await s.found("stranger_user", "cocina")).results).toEqual([]);
    expect((await s.found("member_memory", "cocina")).results).toEqual([]);
    // A grant cannot be borrowed by someone it was not accepted by.
    expect((await s.search("stranger_user", "cocina", grant)).status).toBe(403);
    expect((await s.search("owner", "cocina", "grant_does_not_exist")).status).toBe(403);
    s.db.prepare("UPDATE family_access_grants SET state='revoked',version=version+1 WHERE id=?").run(grant);
    expect((await s.search("member_memory", "cocina", grant)).status).toBe(403);
    // The contributor's revoked grant also hides their words from other family.
    s.db.prepare("INSERT INTO family_chapter_memories(chapter_id,memory_story_id,added_by_user_id,position,created_at) VALUES('chapter_search_one',?,'owner_legacy_test',1,'2026-11-15T00:00:00Z')").run(s.memory);
    expect((await s.found("member_archive", "cocina", s.grants.member_archive)).results.map((r) => r.memoryId)).toEqual([s.memory]);
    expect((await s.found("member_archive", "sofrito", s.grants.member_archive)).results).toEqual([]);
    const deletion = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.other}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(deletion!.status).toBe(200);
    expect((await s.found("owner", "beach")).results).toEqual([]);
  });

  it("requires a session and a bounded query, and treats wildcard characters literally", async () => {
    const s = await setup();
    expect((await s.search("nobody", "cocina")).status).toBe(401);
    expect((await s.search("owner", "a")).status).toBe(400);
    expect((await s.search("owner", "x".repeat(81))).status).toBe(400);
    expect((await s.found("owner", "%%")).results).toEqual([]);
    expect((await s.found("owner", "__")).results).toEqual([]);
    const response = await s.search("owner", "cocina");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
