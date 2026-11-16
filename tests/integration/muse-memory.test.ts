/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { addSyntheticMemory, setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleMuseMemoryRoute, readRemembered } from "../../worker/muse-memory";
import { handleMuseConversationRoute } from "../../worker/muse-conversation";
import { normalizeQuestion } from "../../worker/muse-guard";

// Talk with Muse M2 (decision 2026-11-16): Muse remembers only the person's
// own confirmed words, shows all of it, and forgets on request without
// changing the memory the words belong to.
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

const owner = "owner_legacy_test";
let clock = Date.parse("2026-11-01T10:00:00.000Z");
const later = () => new Date((clock += 60_000)).toISOString();

async function setup() {
  const fixture = await setupLegacyFixture();
  cleanup.push(() => fixture.db.close());
  const sql = fixture.db.database,
    second = await addSyntheticMemory(fixture);
  const context = (memory: string, kind: string, value: string | null, state = "stated") => {
    const id = `ctx_${memory}_${kind}_${clock}`,
      at = later();
    sql.prepare(
      "INSERT INTO living_memory_context_entries(id,memory_story_id,kind,value,context_state,source_ref,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(id, memory, kind, value, state, "muse:turn", owner, at, at);
    return id;
  };
  sql.prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)").run(second, "Navidad en Ponce", owner, later());
  const call = (path: string, init: { method?: string; body?: unknown; cookie?: string; header?: string } = {}) =>
    handleMuseMemoryRoute(
      new Request(`https://example.test${path}`, {
        method: init.method ?? "GET",
        headers: {
          ...(init.cookie !== "" ? { Cookie: init.cookie ?? fixture.owner } : {}),
          "Content-Type": "application/json",
          "X-Memories-Request": init.header ?? "muse-memory-v1",
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      }),
      fixture.env,
    ).then((response) => response!);
  return { ...fixture, sql, second, context, call };
}

type Body = {
  leftOff: { draftId: string; unfinished: number } | null;
  remembered: { id: string; memoryId: string; memoryTitle: string | null; kind: string; value: string; approximate: boolean; forgotten: boolean }[];
};

describe("What Muse remembers (Talk with Muse M2)", () => {
  it("shows only the latest confirmed words per kind, with the memory they came from", async () => {
    const s = await setup();
    s.context(s.second, "person", "Tío Lui");
    const luis = s.context(s.second, "person", "Tío Luis"); // a correction replaces the earlier value
    const place = s.context(s.second, "place", "Ponce, about 1975", "approximate");
    s.context(s.second, "time", null, "unknown"); // "I don't remember" is never remembered as a fact
    s.context(s.memory, "event", "Abuela's birthday");
    const body = (await (await s.call("/resources/muse/memory")).json()) as Body;
    expect(body.remembered.map((entry) => [entry.value, entry.kind])).toEqual([
      ["Abuela's birthday", "event"],
      ["Ponce, about 1975", "place"],
      ["Tío Luis", "person"],
    ]);
    expect(body.remembered.find((entry) => entry.id === luis)).toMatchObject({ memoryId: s.second, memoryTitle: "Navidad en Ponce", forgotten: false });
    expect(body.remembered.find((entry) => entry.id === place)!.approximate).toBe(true);
  });

  it("forgets and remembers again on request without changing the memory itself", async () => {
    const s = await setup();
    const luis = s.context(s.second, "person", "Tío Luis");
    const before = s.sql.prepare("SELECT * FROM living_memory_context_entries ORDER BY id").all();
    let body = (await (await s.call("/resources/muse/memory/forget", { method: "POST", body: { contextEntryId: luis, forgotten: true } })).json()) as Body;
    expect(body.remembered).toEqual([expect.objectContaining({ id: luis, forgotten: true })]);
    expect(await readRemembered(s.env, owner)).toEqual([]);
    // The memory's own context is untouched.
    expect(s.sql.prepare("SELECT * FROM living_memory_context_entries ORDER BY id").all()).toEqual(before);
    // Asking twice is harmless; remembering again brings it back.
    expect((await s.call("/resources/muse/memory/forget", { method: "POST", body: { contextEntryId: luis, forgotten: true } })).status).toBe(200);
    body = (await (await s.call("/resources/muse/memory/forget", { method: "POST", body: { contextEntryId: luis, forgotten: false } })).json()) as Body;
    expect(body.remembered[0]!.forgotten).toBe(false);
    expect((await readRemembered(s.env, owner)).map((entry) => entry.value)).toEqual(["Tío Luis"]);
  });

  it("keeps each person's memory to themselves", async () => {
    const s = await setup();
    const luis = s.context(s.second, "person", "Tío Luis");
    const now = new Date().toISOString();
    s.sql.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run("someone_else", now, now);
    const stranger = (await createAppSession(s.env, "someone_else")).cookie.split(";")[0]!;
    expect(((await (await s.call("/resources/muse/memory", { cookie: stranger })).json()) as Body).remembered).toEqual([]);
    // Someone else's entry looks like one that does not exist, and nothing is recorded.
    expect((await s.call("/resources/muse/memory/forget", { method: "POST", cookie: stranger, body: { contextEntryId: luis, forgotten: true } })).status).toBe(404);
    expect(s.sql.prepare("SELECT COUNT(*) AS n FROM muse_memory_exclusions").get()).toEqual({ n: 0 });
    // The database refuses it too.
    expect(() => s.sql.prepare("INSERT INTO muse_memory_exclusions(user_id,context_entry_id,created_at) VALUES(?,?,?)").run("someone_else", luis, now)).toThrow(/only the memory owner/);
    expect((await s.call("/resources/muse/memory", { cookie: "" })).status).toBe(401);
    expect((await s.call("/resources/muse/memory/forget", { method: "POST", header: "other", body: { contextEntryId: luis, forgotten: true } })).status).toBe(400);
    expect((await s.call("/resources/muse/memory/forget", { method: "POST", body: { contextEntryId: luis, forgotten: "yes" } })).status).toBe(400);
  });

  it("finds where the person left off: their latest unfinished memory, never an expired or finished one", async () => {
    const s = await setup();
    expect(((await (await s.call("/resources/muse/memory")).json()) as Body).leftOff).toBeNull();
    const draft = (id: string, updated: string, expires = "2099-01-01T00:00:00Z", status = "review_partial") =>
      s.sql.prepare("INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,?,'en-US',?,?,?)").run(id, owner, status, updated, updated, expires);
    draft("draft_older", "2026-11-10T10:00:00Z");
    draft("draft_latest", "2026-11-15T10:00:00Z", "2099-01-01T00:00:00Z", "photo_durable");
    draft("draft_expired", "2026-11-16T09:00:00Z", "2020-01-01T00:00:00Z");
    expect(((await (await s.call("/resources/muse/memory")).json()) as Body).leftOff).toEqual({ draftId: "draft_latest", updatedAt: "2026-11-15T10:00:00Z", unfinished: 2 });
  });

  it("lets Muse ask whether this memory connects to the person's other memories, using only what they confirmed", async () => {
    const s = await setup();
    s.context(s.second, "person", "Tío Luis");
    const forgotten = s.context(s.second, "place", "Ponce");
    s.sql.prepare("INSERT INTO muse_memory_exclusions(user_id,context_entry_id,created_at) VALUES(?,?,?)").run(owner, forgotten, later());
    const at = later();
    s.sql.prepare(
      "INSERT INTO transcript_revisions(id,memory_story_id,source_audio_asset_id,parent_revision_id,revision_kind,text,locale,created_by_type,created_by_user_id,model_config_version,created_at) VALUES(?,?,?,NULL,'machine_transcript',?,'en-US','machine',NULL,'test',?)",
    ).run("transcript_connect", s.memory, "asset_legacy_original_audio", "We all went to the beach after church.", at);
    s.sql.prepare("UPDATE memory_stories SET current_transcript_revision_id=? WHERE id=?").run("transcript_connect", s.memory);
    let prompt = "";
    const env = {
      ...s.env,
      AI: {
        run: async (_model: string, input: { messages: { content: string }[] }) => {
          prompt = input.messages[1]!.content;
          return { choices: [{ message: { content: JSON.stringify({ question: "Was Tío Luis with you at the beach too?", focus: "person" }) } }] };
        },
      } as unknown as Ai,
    };
    const response = await handleMuseConversationRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}/muse-conversation`, {
        method: "POST",
        headers: { Cookie: s.owner, Origin: "https://example.test", "Content-Type": "application/json", "X-Memories-Request": "muse-conversation-v1" },
        body: "{}",
      }),
      env as never,
    );
    const body = (await response!.json()) as { currentQuestion: { content: string } };
    expect(prompt).toContain("person: Tío Luis");
    expect(prompt).not.toContain("Ponce");
    // A name from the person's own other memory passes the invented-name guard,
    // which would replace the same question if the name came from nowhere.
    expect(body.currentQuestion.content).toBe("Was Tío Luis with you at the beach too?");
    expect(normalizeQuestion("Was Tío Luis with you at the beach too?", "en-US", "We all went to the beach after church.")).not.toContain("Luis");
  });
});
