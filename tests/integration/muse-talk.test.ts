/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleMuseTalkRoute } from "../../worker/muse-talk";
import { ceilingOperation } from "../../worker/usage-ceilings";
import { rateLimitClass } from "../../worker/rate-limit";
import { phase1Config } from "../../config/phase-1";

// Talk with Muse M4a (decision 2026-11-16): an open conversation with every
// companion safeguard from the first message.
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

type View = { talkId: string; turns: { turnId: string; speaker: string; kind: string; content: string; support?: { emergencyNumber: string | null } }[] };
const start = Date.parse("2026-11-16T10:00:00.000Z");
const at = (minutes: number) => new Date(start + minutes * 60_000);

async function setup(options: { reply?: string } = {}) {
  const fixture = await setupLegacyFixture();
  cleanup.push(() => fixture.db.close());
  const prompts: string[] = [];
  const env = {
    ...fixture.env,
    AI: {
      run: async (_model: string, input: { messages: { content: string }[] }) => {
        prompts.push(input.messages[1]!.content);
        return { choices: [{ message: { content: options.reply ?? "What did the kitchen smell like?" } }] };
      },
    } as unknown as Ai,
  };
  const call = async (path: string, init: { method?: string; body?: unknown; cookie?: string; locale?: string; now?: Date; header?: string } = {}) => {
    const response = (await handleMuseTalkRoute(
      new Request(`https://example.test/resources/muse/${path}`, {
        method: init.method ?? "GET",
        headers: {
          Cookie: init.cookie ?? fixture.owner,
          "Content-Type": "application/json",
          "X-Memories-Request": init.header ?? "muse-talk-v1",
          ...(init.locale ? { "X-UI-Locale": init.locale } : {}),
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      }),
      env as never,
      init.now ?? at(0),
    ))!;
    return { status: response.status, body: (await response.json()) as View & { error?: { code: string }; confirmed?: boolean } };
  };
  const consent = () => call("talk/consent", { method: "POST", body: { adult: true, understandsAi: true, disclosureVersion: phase1Config.ai.museTalkDisclosureVersion } });
  const say = (talk: View, text: string, minutes = 1) => call(`talks/${talk.talkId}/messages`, { method: "POST", body: { text, afterTurnId: talk.turns.at(-1)!.turnId }, now: at(minutes) });
  return { ...fixture, sql: fixture.db.database, env, prompts, call, consent, say };
}

describe("Talk with Muse (M4a)", () => {
  it("asks once for adult confirmation and understanding that Muse is an AI, then opens by saying so", async () => {
    const s = await setup();
    expect((await s.call("talks", { method: "POST" })).body.error!.code).toBe("muse_talk_consent_required");
    expect((await s.call("talk/consent", { method: "POST", body: { adult: true, understandsAi: false, disclosureVersion: phase1Config.ai.museTalkDisclosureVersion } })).status).toBe(400);
    expect((await s.call("talk/consent", { method: "POST", body: { adult: true, understandsAi: true, disclosureVersion: "old" } })).status).toBe(400);
    expect((await s.consent()).body.confirmed).toBe(true);
    expect((await s.call("talk/consent")).body.confirmed).toBe(true);
    const opened = await s.call("talks", { method: "POST" });
    expect(opened.status).toBe(201);
    expect(opened.body.turns).toEqual([expect.objectContaining({ speaker: "muse", kind: "greeting" })]);
    expect(opened.body.turns[0]!.content).toMatch(/^Hi, I'm Muse\. I'm an AI that helps you tell your stories\./);
    expect(s.prompts).toHaveLength(0); // The opening is fixed wording, not a model reply.
  });

  it("opens from the person's own archive: an unfinished memory first, else someone they named, in their language", async () => {
    const s = await setup();
    await s.consent();
    const now = new Date().toISOString();
    s.sql.prepare("INSERT INTO living_memory_context_entries(id,memory_story_id,kind,value,context_state,source_ref,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run("ctx_talk", s.memory, "person", "Tía Carmen", "stated", "muse:t", "owner_legacy_test", now, now);
    expect((await s.call("talks", { method: "POST", locale: "es-PR" })).body.turns[0]!.content).toContain("Me has hablado de Tía Carmen.");
    s.sql.prepare("INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,'photo_durable','en-US',?,?,'2099-01-01T00:00:00Z')").run("draft_talk_unfinished", "owner_legacy_test", now, now);
    expect((await s.call("talks", { method: "POST" })).body.turns[0]!.content).toContain("You have a memory you haven't finished.");
  });

  it("keeps the person's words exactly, answers with one question, and never lets Muse invent a name", async () => {
    const s = await setup({ reply: "Was Margarita cooking that day?" });
    await s.consent();
    const talk = (await s.call("talks", { method: "POST" })).body;
    const answered = (await s.say(talk, "  Sundays   at my grandmother's house in Ponce.  ")).body;
    expect(answered.turns.map((turn) => [turn.speaker, turn.kind])).toEqual([["muse", "greeting"], ["person", "words"], ["muse", "question"]]);
    expect(answered.turns[1]!.content).toBe("Sundays at my grandmother's house in Ponce.");
    // "Margarita" was never said by the person: the question is replaced.
    expect(answered.turns[2]!.content).toBe("What else comes back to you?");
    expect(s.prompts[0]).toContain("Person: Sundays at my grandmother's house in Ponce.");
    expect(() => s.sql.prepare("UPDATE muse_talk_turns SET content='changed' WHERE speaker='person'").run()).toThrow(/append only/);
  });

  it("answers words of danger first, with real people to reach and no model call", async () => {
    const s = await setup();
    await s.consent();
    const talk = (await s.call("talks", { method: "POST", locale: "es-PR" })).body;
    const body = (await s.say(talk, "Desde que ella murió ya no quiero vivir.")).body;
    expect(body.turns.at(-1)).toMatchObject({ kind: "support", support: { emergencyNumber: "911" } });
    expect(body.turns.at(-1)!.content).toContain("988");
    expect(s.prompts).toHaveLength(0);
    // The conversation stays open.
    expect((await s.say(body, "Gracias. Ella cantaba boleros.", 3)).body.turns.at(-1)!.kind).toBe("question");
  });

  it("says it is an AI again after three hours, and suggests family once after a long talk", async () => {
    const s = await setup();
    await s.consent();
    let talk = (await s.call("talks", { method: "POST" })).body;
    talk = (await s.say(talk, "We lived near the sea.", 10)).body;
    expect(talk.turns.at(-1)!.kind).toBe("question");
    talk = (await s.say(talk, "My father fished every morning.", 46)).body;
    expect(talk.turns.at(-1)).toMatchObject({ kind: "family" });
    expect(talk.turns.at(-1)!.content).toContain("share with someone in your family");
    talk = (await s.say(talk, "Maybe with my daughter.", 50)).body;
    expect(talk.turns.filter((turn) => turn.kind === "family")).toHaveLength(1);
    talk = (await s.say(talk, "He sold fish at the market.", 181)).body;
    expect(talk.turns.slice(-2).map((turn) => turn.kind)).toEqual(["disclosure", "question"]);
    expect(talk.turns.at(-2)!.content).toBe("A gentle reminder: I'm Muse, an AI, not a person.");
  });

  it("refuses out-of-turn sends, returns a retry unchanged, and keeps each person's talks to themselves", async () => {
    const s = await setup();
    await s.consent();
    const talk = (await s.call("talks", { method: "POST" })).body;
    const first = (await s.say(talk, "The porch had a swing.")).body;
    expect((await s.say(talk, "The porch had a swing.")).body.turns).toEqual(first.turns);
    expect((await s.say(talk, "Something else.")).status).toBe(409);
    expect(s.prompts).toHaveLength(1);
    const now = new Date().toISOString();
    s.sql.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run("someone_else", now, now);
    const stranger = (await createAppSession(s.env, "someone_else")).cookie.split(";")[0]!;
    expect((await s.call(`talks/${talk.talkId}`, { cookie: stranger })).status).toBe(404);
    expect((await s.call(`talks/${talk.talkId}/messages`, { method: "POST", cookie: stranger, body: { text: "hi", afterTurnId: first.turns.at(-1)!.turnId } })).status).toBe(404);
    expect((await s.call(`talks/${talk.talkId}`, { method: "DELETE", header: "other" })).status).toBe(400);
    expect((await s.call(`talks/${talk.talkId}`, { method: "DELETE" })).status).toBe(200);
    expect(s.sql.prepare("SELECT COUNT(*) AS n FROM muse_talk_turns").get()).toEqual({ n: 0 });
  });

  it("counts each message against the Muse conversation ceiling and the costly rate limit", () => {
    const send = new Request("https://example.test/resources/muse/talks/talk_0123456789abcdef0123456789abcdef/messages", { method: "POST" });
    expect(ceilingOperation(send)).toBe("muse_conversation");
    expect(rateLimitClass(send)).toBe("costly");
  });
});
