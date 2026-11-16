import { phase1Config } from "../config/phase-1";
import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import { fallbackQuestion, normalizeQuestion } from "./muse-guard";
import { readLeftOff, readRemembered } from "./muse-memory";
import { showsCrisisSignal, supportReply } from "./muse-safety";
import { createMuseTextProvider, type MuseProviderEnv } from "./providers/muse-provider";

/**
 * Talk with Muse (packet M4a, docs/DECISIONS/2026-11-16-talk-with-muse.md).
 *
 * An open conversation a person chooses to start. Every companion safeguard
 * applies from the first message:
 * - The person confirms once that they are an adult and that Muse is an AI.
 * - Muse says it is an AI when a conversation starts, and again after
 *   `museTalkDisclosureEveryMinutes` of continued conversation.
 * - Words that may signal danger are answered before anything else.
 * - After `museTalkFamilyAfterMinutes`, Muse suggests sharing a story with
 *   family once, instead of encouraging more time with Muse.
 * - There are no streaks, rewards or nudges to come back.
 * The person's words are kept exactly as given; the person can delete a
 * conversation. Muse remembers only what the person confirmed in their own
 * Living Memories (M2) and never invents a name, date or place.
 */
export type MuseTalkEnv = AuthSessionEnv & MuseProviderEnv;

type Turn = { id: string; turn_index: number; speaker: "muse" | "person"; kind: string; content: string; created_at: string };
type Talk = { id: string; user_id: string; ui_locale: string; started_at: string; last_activity_at: string; last_disclosure_at: string; family_suggested_at: string | null };

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
const failure = (code: string, status: number) => json({ error: { code } }, status);
const spanish = (locale: string) => locale.toLowerCase().startsWith("es");
const minutesBetween = (from: string, to: Date) => (to.getTime() - Date.parse(from)) / 60_000;

export function talkFallbackQuestion(locale: string): string {
  return spanish(locale) ? "¿Qué más te viene a la memoria?" : "What else comes back to you?";
}

const copy = {
  disclosure: (locale: string) =>
    spanish(locale)
      ? "Un recordatorio: soy Muse, una inteligencia artificial, no una persona."
      : "A gentle reminder: I'm Muse, an AI, not a person.",
  family: (locale: string) =>
    spanish(locale)
      ? "Llevamos un buen rato conversando. ¿Hay alguna de estas historias que te gustaría compartir con alguien de tu familia?"
      : "We've been talking for a while. Is there one of these stories you'd like to share with someone in your family?",
};

/** The opening: who Muse is, then one invitation built only from the person's own archive. */
export async function openingFor(env: { DB: D1Database }, userId: string, locale: string, now = new Date()): Promise<string> {
  const es = spanish(locale),
    intro = es
      ? "Hola, soy Muse. Soy una inteligencia artificial que te ayuda a contar tus historias. Lo que digas aquí es privado, a menos que tú decidas compartirlo."
      : "Hi, I'm Muse. I'm an AI that helps you tell your stories. What you say here stays private unless you choose to share it.";
  const leftOff = await readLeftOff(env, userId, now);
  if (leftOff)
    return `${intro} ${es ? "Tienes un recuerdo sin terminar. ¿Quieres seguir con él o contarme algo nuevo?" : "You have a memory you haven't finished. Would you like to keep going with it, or tell me something new?"}`;
  const person = (await readRemembered(env, userId, { limit: 20 })).find((entry) => entry.kind === "person");
  if (person)
    return `${intro} ${es ? `Me has hablado de ${person.value}. ¿Hay alguna historia sobre esa persona que te gustaría contar?` : `You've told me about ${person.value}. Is there a story about them you'd like to tell?`}`;
  return `${intro} ${es ? "¿Qué te gustaría recordar hoy?" : "What would you like to remember today?"}`;
}

function talkSystemPrompt(locale: string): string {
  return (
    "You are Muse, an AI that helps a person tell the stories of their life and family. Listen first. " +
    "Reply with exactly one short, warm question that helps the person remember and tell more of their own story. " +
    "Never fact-check, correct, judge, diagnose, give advice, or introduce a name, place, date or detail the person did not say. " +
    "Never claim to be human, to have feelings, or to be their friend. Do not praise, flatter, or encourage them to spend more time with you. " +
    "If they mention family, you may gently ask about telling or sharing the story with them. " +
    `Output only the question, in ${spanish(locale) ? "Spanish" : "English"}.`
  );
}

async function readTalk(env: { DB: D1Database }, userId: string, talkId: string): Promise<Talk | null> {
  return env.DB.prepare("SELECT * FROM muse_talks WHERE id = ? AND user_id = ?").bind(talkId, userId).first<Talk>();
}

async function readTurns(env: { DB: D1Database }, talkId: string): Promise<Turn[]> {
  return (
    await env.DB.prepare("SELECT id, turn_index, speaker, kind, content, created_at FROM muse_talk_turns WHERE talk_id = ? ORDER BY turn_index")
      .bind(talkId)
      .all<Turn>()
  ).results;
}

function insertTurn(env: { DB: D1Database }, talkId: string, index: number, speaker: "muse" | "person", kind: string, content: string, at: string, model: string | null = null) {
  return env.DB.prepare(
    "INSERT INTO muse_talk_turns(id, talk_id, turn_index, speaker, kind, content, model_config_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(`${talkId}_t${index}`, talkId, index, speaker, kind, content, model, at);
}

const view = (talk: Talk, turns: Turn[]) => ({
  talkId: talk.id,
  startedAt: talk.started_at,
  turns: turns.map((turn) => ({
    turnId: turn.id,
    speaker: turn.speaker,
    kind: turn.kind,
    content: turn.content,
    createdAt: turn.created_at,
    ...(turn.kind === "support" ? { support: (({ lines, emergencyNumber }) => ({ lines, emergencyNumber }))(supportReply(talk.ui_locale)) } : {}),
  })),
});

async function hasConsent(env: { DB: D1Database }, userId: string): Promise<boolean> {
  return Boolean(
    await env.DB.prepare("SELECT 1 AS ok FROM muse_companion_consents WHERE user_id = ? AND disclosure_version = ?")
      .bind(userId, phase1Config.ai.museTalkDisclosureVersion)
      .first(),
  );
}

/** Muse's next question, kept to the person's own words; a safe fixed question when no model answers. */
async function nextQuestion(env: MuseTalkEnv, userId: string, talk: Talk, turns: Turn[]): Promise<{ question: string; model: string }> {
  const remembered = await readRemembered(env, userId, { limit: 12 }).catch(() => []),
    personWords = turns.filter((turn) => turn.speaker === "person").map((turn) => turn.content),
    known = [...personWords, ...remembered.map((entry) => entry.value)].join("\n"),
    dialogue = turns
      .filter((turn) => turn.kind !== "support")
      .slice(-16)
      .map((turn) => `${turn.speaker === "muse" ? "Muse" : "Person"}: ${turn.content}`)
      .join("\n");
  try {
    const raw = await createMuseTextProvider(env).generate({
      system: talkSystemPrompt(talk.ui_locale),
      user:
        `Conversation so far:\n${dialogue}` +
        (remembered.length
          ? `\n\nWhat this person confirmed in their own Living Memories (their words; never state as fact):\n${remembered.map((entry) => `${entry.kind}: ${entry.value}`).join("\n")}`
          : ""),
      maxTokens: 120,
      temperature: 0.5,
    });
    const checked = normalizeQuestion(raw, talk.ui_locale, known);
    // The guard's own fallback speaks of "this photograph"; an open conversation may have none.
    return checked === fallbackQuestion(talk.ui_locale)
      ? { question: talkFallbackQuestion(talk.ui_locale), model: "talk-guard-fallback-v1" }
      : { question: checked, model: phase1Config.ai.modelConfigVersion };
  } catch {
    return { question: talkFallbackQuestion(talk.ui_locale), model: "talk-provider-fallback-v1" };
  }
}

async function addMessage(request: Request, env: MuseTalkEnv, userId: string, talkId: string, now: Date): Promise<Response> {
  const talk = await readTalk(env, userId, talkId);
  if (!talk) return failure("muse_talk_not_found", 404);
  const body = (await request.json().catch(() => null)) as { text?: unknown; afterTurnId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > phase1Config.ai.museTalkMessageCharacters || typeof body?.afterTurnId !== "string")
    return failure("muse_talk_invalid", 400);
  let turns = await readTurns(env, talkId);
  const last = turns.at(-1)!;
  // A retried send after Muse already answered returns the conversation unchanged.
  const retried = turns.find((turn, index) => turn.speaker === "person" && turn.content === text && turns[index - 1]?.id === body.afterTurnId);
  if (retried) return json(view(talk, turns));
  if (body.afterTurnId !== last.id) return failure("muse_talk_out_of_turn", 409);

  const at = now.toISOString();
  const counter = { next: last.turn_index + 1 };
  const take = () => counter.next++;
  const writes = [insertTurn(env, talkId, take(), "person", "words", text, at)];
  turns = [...turns, { id: `${talkId}_t${counter.next - 1}`, turn_index: counter.next - 1, speaker: "person", kind: "words", content: text, created_at: at }];

  let disclosedAt = talk.last_disclosure_at,
    familyAt = talk.family_suggested_at;
  if (showsCrisisSignal(text)) {
    // Danger first: fixed, reviewed wording; no model; the conversation stays open.
    writes.push(insertTurn(env, talkId, take(), "muse", "support", supportReply(talk.ui_locale).message, at, "muse-safety-support-v1"));
    disclosedAt = at; // The support message says Muse is an AI.
  } else {
    if (minutesBetween(talk.last_disclosure_at, now) >= phase1Config.ai.museTalkDisclosureEveryMinutes) {
      writes.push(insertTurn(env, talkId, take(), "muse", "disclosure", copy.disclosure(talk.ui_locale), at));
      disclosedAt = at;
    }
    if (!familyAt && minutesBetween(talk.started_at, now) >= phase1Config.ai.museTalkFamilyAfterMinutes) {
      writes.push(insertTurn(env, talkId, take(), "muse", "family", copy.family(talk.ui_locale), at));
      familyAt = at;
    } else {
      const next = await nextQuestion(env, userId, talk, turns);
      writes.push(insertTurn(env, talkId, take(), "muse", "question", next.question, at, next.model));
    }
  }
  writes.push(
    env.DB.prepare("UPDATE muse_talks SET last_activity_at = ?, last_disclosure_at = ?, family_suggested_at = ? WHERE id = ? AND user_id = ?").bind(
      at,
      disclosedAt,
      familyAt,
      talkId,
      userId,
    ),
  );
  try {
    await env.DB.batch(writes);
  } catch {
    // Another send claimed these turns first.
    return failure("muse_talk_out_of_turn", 409);
  }
  return json(view((await readTalk(env, userId, talkId))!, await readTurns(env, talkId)));
}

export async function handleMuseTalkRoute(request: Request, env: MuseTalkEnv, now = new Date()): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/resources/muse/talk")) return null;
  const session = await authenticateAppSession(request, env);
  if (!session) return failure("session_required", 401);
  const userId = session.userId,
    writing = request.method !== "GET";
  if (writing && request.headers.get("X-Memories-Request") !== "muse-talk-v1") return failure("muse_talk_invalid", 400);

  if (path === "/resources/muse/talk/consent") {
    if (request.method === "GET")
      return json({ confirmed: await hasConsent(env, userId), disclosureVersion: phase1Config.ai.museTalkDisclosureVersion });
    if (request.method !== "POST") return failure("method", 405);
    const body = (await request.json().catch(() => null)) as { adult?: unknown; understandsAi?: unknown; disclosureVersion?: unknown } | null;
    if (!body || body.adult !== true || body.understandsAi !== true || body.disclosureVersion !== phase1Config.ai.museTalkDisclosureVersion)
      return failure("muse_talk_consent_invalid", 400);
    await env.DB.prepare("INSERT OR IGNORE INTO muse_companion_consents(user_id, disclosure_version, adult_confirmed_at) VALUES (?, ?, ?)")
      .bind(userId, phase1Config.ai.museTalkDisclosureVersion, now.toISOString())
      .run();
    return json({ confirmed: true, disclosureVersion: phase1Config.ai.museTalkDisclosureVersion });
  }

  if (path === "/resources/muse/talks") {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, started_at, last_activity_at FROM muse_talks WHERE user_id = ? ORDER BY last_activity_at DESC LIMIT 20",
      )
        .bind(userId)
        .all<{ id: string; started_at: string; last_activity_at: string }>();
      return json({ talks: results.map((row) => ({ talkId: row.id, startedAt: row.started_at, lastActivityAt: row.last_activity_at })) });
    }
    if (request.method !== "POST") return failure("method", 405);
    if (!(await hasConsent(env, userId))) return failure("muse_talk_consent_required", 409);
    const header = request.headers.get("X-UI-Locale") ?? "",
      locale = (phase1Config.localization.supportedLocales as readonly string[]).includes(header) ? header : "en-US",
      at = now.toISOString(),
      talkId = `talk_${crypto.randomUUID().replace(/-/g, "")}`;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO muse_talks(id, user_id, ui_locale, started_at, last_activity_at, last_disclosure_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(talkId, userId, locale, at, at, at),
      insertTurn(env, talkId, 0, "muse", "greeting", await openingFor(env, userId, locale, now), at, "talk-opening-v1"),
    ]);
    return json(view((await readTalk(env, userId, talkId))!, await readTurns(env, talkId)), 201);
  }

  const match = /^\/resources\/muse\/talks\/(talk_[a-f0-9]{32})(\/messages)?$/.exec(path);
  if (!match) return failure("muse_talk_not_found", 404);
  const talkId = match[1]!;
  if (match[2]) return request.method === "POST" ? addMessage(request, env, userId, talkId, now) : failure("method", 405);
  const talk = await readTalk(env, userId, talkId);
  if (!talk) return failure("muse_talk_not_found", 404);
  if (request.method === "GET") return json(view(talk, await readTurns(env, talkId)));
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM muse_talks WHERE id = ? AND user_id = ?").bind(talkId, userId).run();
    return json({ deleted: true });
  }
  return failure("method", 405);
}
