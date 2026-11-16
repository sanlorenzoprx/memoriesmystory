/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { handleMuseConversationRoute } from "../../worker/muse-conversation";
import { acceptablePhotoNote, ensurePhotoNote } from "../../worker/muse-photo";

// Talk with Muse M3 (decision 2026-11-16): Muse looks at the photograph once,
// describes only what can be seen, and asks about it without saying who,
// when or where. Without a usable photograph or model, Muse asks from words.
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

type Message = { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] };
type Call = { model: string; messages: Message[] };

async function setup(options: { note?: string; visionFails?: boolean } = {}) {
  const fixture = await setupLegacyFixture();
  cleanup.push(() => fixture.db.close());
  const sql = fixture.db.database,
    at = new Date().toISOString();
  sql.prepare(
    "INSERT INTO transcript_revisions(id,memory_story_id,source_audio_asset_id,parent_revision_id,revision_kind,text,locale,created_by_type,created_by_user_id,model_config_version,created_at) VALUES(?,?,?,NULL,'machine_transcript',?,'en-US','machine',NULL,'test',?)",
  ).run("transcript_photo", fixture.memory, "asset_legacy_original_audio", "This was the day we moved into the new house.", at);
  sql.prepare("UPDATE memory_stories SET current_transcript_revision_id=? WHERE id=?").run("transcript_photo", fixture.memory);
  const calls: Call[] = [];
  const AI = {
    run: async (model: string, input: { messages: Message[] }) => {
      calls.push({ model, messages: input.messages });
      const sawPhoto = Array.isArray(input.messages[1]!.content);
      if (sawPhoto) {
        if (options.visionFails) throw new Error("vision outage");
        return { choices: [{ message: { content: options.note ?? "A woman in a white dress stands beside a man holding a cake on a porch." } }] };
      }
      return { choices: [{ message: { content: JSON.stringify({ question: "Who is the woman in the white dress?", focus: "person" }) } }] };
    },
  } as unknown as Ai;
  const env = { ...fixture.env, AI };
  const converse = async () =>
    (await (await handleMuseConversationRoute(
      new Request(`https://example.test/resources/drafts/${fixture.memory}/muse-conversation`, {
        method: "POST",
        headers: { Cookie: fixture.owner, Origin: "https://example.test", "Content-Type": "application/json", "X-Memories-Request": "muse-conversation-v1" },
        body: "{}",
      }),
      env as never,
    ))!.json()) as { currentQuestion: { turnId: string; content: string } };
  return { ...fixture, sql, env, calls, converse };
}

const questionPrompt = (call: Call) => String(call.messages[1]!.content);

describe("Muse looks at the photograph (Talk with Muse M3)", () => {
  it("sends the memory's own photograph once, keeps only what can be seen, and asks about it", async () => {
    const s = await setup();
    const body = await s.converse();
    const [vision, question] = s.calls;
    expect(s.calls).toHaveLength(2);
    // The photograph itself, from private storage, as an inline image to Gemini.
    expect(vision!.model).toBe("google/gemini-3-flash");
    const parts = vision!.messages[1]!.content as { type: string; image_url?: { url: string } }[];
    expect(parts[1]!.image_url!.url).toBe(`data:image/png;base64,${Buffer.from([1, 2, 3, 4]).toString("base64")}`);
    expect(String(vision!.messages[0]!.content)).toMatch(/Never give or guess a name, age, date, year, place name, relationship/);
    // The note is stored as Muse's own material and shapes the question.
    expect(s.sql.prepare("SELECT content, source_type, photo_asset_id FROM muse_photo_notes").get()).toEqual({
      content: "A woman in a white dress stands beside a man holding a cake on a porch.",
      source_type: "muse_generated",
      photo_asset_id: "asset_legacy_original_photo",
    });
    expect(questionPrompt(question!)).toContain("What Muse can see in the photograph (Muse's own observation, not the storyteller's words; ask about it, never state it): A woman in a white dress");
    expect(body.currentQuestion.content).toBe("Who is the woman in the white dress?");
    // Later questions reuse the note without sending the photograph again.
    const next = await handleMuseConversationRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}/muse-conversation`, {
        method: "POST",
        headers: { Cookie: s.owner, Origin: "https://example.test", "Content-Type": "application/json", "X-Memories-Request": "muse-conversation-v1" },
        body: JSON.stringify({ replyToTurnId: body.currentQuestion.turnId, answer: "My aunt Carmen, on her wedding day.", state: "stated" }),
      }),
      s.env as never,
    );
    expect(next!.status).toBe(200);
    expect(s.calls).toHaveLength(3);
    expect(Array.isArray(s.calls[2]!.messages[1]!.content)).toBe(false);
    expect(questionPrompt(s.calls[2]!)).toContain("A woman in a white dress");
  });

  it("discards a description that guesses a year or age, and asks from the words alone", async () => {
    const s = await setup({ note: "A family in 1962 celebrates a 50th birthday." });
    await s.converse();
    expect(s.sql.prepare("SELECT COUNT(*) AS n FROM muse_photo_notes").get()).toEqual({ n: 0 });
    expect(questionPrompt(s.calls.at(-1)!)).not.toContain("What Muse can see");
  });

  it("keeps listening when no model can look at the photograph, and never sends it to the text-only fallback", async () => {
    const s = await setup({ visionFails: true });
    const body = await s.converse();
    expect(body.currentQuestion.content).toBe("Who is the woman in the white dress?");
    // The photograph went to Gemini only; the Workers AI fallback refused it uncalled.
    expect(s.calls.filter((call) => Array.isArray(call.messages[1]!.content)).map((call) => call.model)).toEqual(["google/gemini-3-flash"]);
    expect(s.sql.prepare("SELECT COUNT(*) AS n FROM muse_photo_notes").get()).toEqual({ n: 0 });
  });

  it("does not send a HEIC or oversized original without a JPEG copy", async () => {
    const s = await setup();
    // Originals are immutable, so each case is its own memory.
    const memoryWith = async (id: string, type: string, size: number) => {
      const at = new Date().toISOString();
      s.sql.prepare("UPDATE story_entitlements SET free_story_limit=free_story_limit+1,free_stories_unlocked=free_stories_unlocked+1 WHERE user_id=?").run("owner_legacy_test");
      s.sql.prepare("INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,'complete','en-US',?,?,'2099-01-01T00:00:00Z')").run(id, "owner_legacy_test", at, at);
      s.sql.prepare("INSERT INTO memory_stories(id,owner_user_id,status,created_at,updated_at) VALUES(?,?,'draft',?,?)").run(id, "owner_legacy_test", at, at);
      await s.bucket.put(`${id}_photo`, new Uint8Array([7, 7, 7, 7]).buffer);
      s.sql.prepare("INSERT INTO media_assets(id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,sha256,r2_etag,durability_status,created_at) VALUES(?,?,?,'original_photo',?,?,?,?,'etag','durable',?)").run(`${id}_photo`, id, id, `${id}_photo`, type, size, "c".repeat(64), at);
      s.sql.prepare("UPDATE memory_stories SET primary_photo_asset_id=? WHERE id=?").run(`${id}_photo`, id);
      return id;
    };
    const heic = await memoryWith("memory_heic", "image/heic", 4),
      large = await memoryWith("memory_large", "image/jpeg", 9_000_000);
    expect(await ensurePhotoNote(s.env as never, heic, "en-US")).toBeNull();
    expect(await ensurePhotoNote(s.env as never, large, "en-US")).toBeNull();
    expect(s.calls).toHaveLength(0);
    // With the Images binding, a HEIC original is sent as a JPEG copy; the original is untouched.
    const IMAGES = { input: () => ({ output: async () => ({ response: () => new Response(new Uint8Array([9, 9]), { headers: { "Content-Type": "image/jpeg" } }) }) }) };
    expect(await ensurePhotoNote({ ...s.env, IMAGES } as never, heic, "en-US")).toContain("white dress");
    expect((s.calls[0]!.messages[1]!.content as { image_url?: { url: string } }[])[1]!.image_url!.url).toBe("data:image/jpeg;base64,CQk=");
    expect([...new Uint8Array(s.bucket.objects.get("memory_heic_photo")!.body)]).toEqual([7, 7, 7, 7]);
  });

  it("refuses a note that is not about the memory's own photograph", async () => {
    const s = await setup();
    expect(() =>
      s.sql.prepare("INSERT INTO muse_photo_notes(memory_story_id,photo_asset_id,content,model_config_version,prompt_version,created_at) VALUES(?,?,?,?,?,?)").run(s.memory, "asset_legacy_original_audio", "x", "v", "v", new Date().toISOString()),
    ).toThrow(/own original photograph/);
  });

  it.each([
    ["Two children sit on a stone wall by the sea.", true],
    ["A man, about 40, holds a baby.", false],
    ["", false],
  ])("accepts only descriptions of what can be seen: %s", (note, kept) => {
    expect(acceptablePhotoNote(note) !== null).toBe(kept);
  });
});
