import {
  asId,
  validateStoryContext,
  type LivingMemoryId,
  type StoryContextEntry,
  type StoryContextId,
  type StoryContextInput,
  type UserId
} from "../app/domain";
import { phase1Config } from "../config/phase-1";
import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import {
  ensureLivingMemoryFoundation,
  LivingMemoryPersistenceError,
  type LivingMemoryPersistenceEnv
} from "./living-memory-persistence";
import { museValidation } from "./muse";
import {
  createMuseTextProvider,
  type MuseProviderEnv
} from "./providers/muse-provider";

export type MuseConversationEnv = AuthSessionEnv &
  LivingMemoryPersistenceEnv &
  MuseProviderEnv;

type TranscriptRow = {
  id: string;
  text: string;
  locale: string;
};

type TurnSpeaker = "muse" | "storyteller";
type CoreFocus = "person" | "place" | "time" | "event";
type MuseFocus =
  | CoreFocus
  | "detail"
  | "meaning"
  | "sensory"
  | "emotion"
  | "sequence"
  | "open";

type TurnRow = {
  id: string;
  memory_story_id: string;
  turn_index: number;
  speaker: TurnSpeaker;
  content: string;
  focus_kind: MuseFocus | null;
  response_state: "stated" | "approximate" | "unknown" | "omitted" | null;
  source_ref: string | null;
  reply_to_turn_id: string | null;
  voice_reply_asset_id: string | null;
  model_config_version: string | null;
  prompt_version: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

type VoiceReplyRow = {
  id: string;
  memory_story_id: string;
  reply_to_turn_id: string;
  durability_status: "pending" | "durable" | "failed";
  transcript_text: string | null;
  transcript_locale: string | null;
  storyteller_text: string | null;
  storyteller_confirmed_at: string | null;
};

type ContextRow = {
  id: string;
  memory_story_id: string;
  kind: CoreFocus;
  value: string | null;
  context_state: "stated" | "approximate" | "unknown" | "omitted";
  created_by_user_id: string;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
};

class MuseConversationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const coreFocuses: readonly CoreFocus[] = ["person", "place", "time", "event"];
const allFocuses: readonly MuseFocus[] = [
  ...coreFocuses,
  "detail",
  "meaning",
  "sensory",
  "emotion",
  "sequence",
  "open"
];
const requestHeader = "muse-conversation-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,180}$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function validIdentifier(value: string | null, label: string): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new MuseConversationError(400, "invalid_identifier", `${label} is invalid.`);
  }
  return candidate;
}

function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new MuseConversationError(
      403,
      "csrf",
      "The Muse conversation request could not be verified."
    );
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new MuseConversationError(
      403,
      "origin",
      "The Muse conversation origin is not allowed."
    );
  }
}

async function requireOwner(
  request: Request,
  env: MuseConversationEnv
): Promise<string> {
  const session = await authenticateAppSession(request, env);
  if (!session) {
    throw new MuseConversationError(
      401,
      "session_required",
      "Sign in to continue this Living Memory."
    );
  }
  return session.userId;
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function transcriptFor(
  env: MuseConversationEnv,
  livingMemoryId: string
): Promise<TranscriptRow | null> {
  return env.DB.prepare(
    `SELECT tr.id, tr.text, tr.locale
     FROM memory_stories ms
     JOIN transcript_revisions tr ON tr.id = ms.current_transcript_revision_id
     WHERE ms.id = ?`
  ).bind(livingMemoryId).first<TranscriptRow>();
}

async function conversationTurns(
  env: MuseConversationEnv,
  livingMemoryId: string
): Promise<TurnRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, memory_story_id, turn_index, speaker, content, focus_kind,
            response_state, source_ref, reply_to_turn_id, voice_reply_asset_id,
            model_config_version, prompt_version, created_by_user_id, created_at
     FROM muse_conversation_turns
     WHERE memory_story_id = ?
     ORDER BY turn_index ASC`
  ).bind(livingMemoryId).all<TurnRow>();
  return result.results;
}

async function currentContext(
  env: MuseConversationEnv,
  livingMemoryId: string
): Promise<StoryContextEntry[]> {
  const result = await env.DB.prepare(
    `SELECT id, memory_story_id, kind, value, context_state,
            created_by_user_id, source_ref, created_at, updated_at
     FROM living_memory_context_entries
     WHERE memory_story_id = ?
     ORDER BY created_at DESC, rowid DESC`
  ).bind(livingMemoryId).all<ContextRow>();

  const seen = new Set<string>();
  const entries: StoryContextEntry[] = [];
  for (const row of result.results) {
    if (seen.has(row.kind)) continue;
    seen.add(row.kind);
    entries.push({
      id: asId<StoryContextId>(row.id),
      livingMemoryId: asId<LivingMemoryId>(row.memory_story_id),
      kind: row.kind,
      value: row.value,
      state: row.context_state,
      createdByUserId: asId<UserId>(row.created_by_user_id),
      sourceRef: row.source_ref,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
  return entries;
}

function unresolvedContext(context: readonly StoryContextEntry[]): CoreFocus[] {
  const resolved = new Set(context.map((entry) => entry.kind));
  return coreFocuses.filter((kind) => !resolved.has(kind));
}

function questionForFocus(focus: MuseFocus, locale: string): string {
  const spanish = locale.toLowerCase().startsWith("es");
  if (spanish) {
    switch (focus) {
      case "person": return "¿Quién forma parte de este recuerdo para ti?";
      case "place": return "¿Dónde recuerdas que estabas?";
      case "time": return "¿Más o menos en qué momento de tu vida fue esto?";
      case "event": return "¿Qué estaba pasando alrededor de este momento?";
      case "meaning": return "¿Qué hace que este recuerdo sea importante para ti ahora?";
      case "sensory": return "¿Qué detalle de ese momento todavía puedes ver, oír o sentir?";
      case "emotion": return "¿Cómo te sentías en ese momento?";
      case "sequence": return "¿Qué recuerdas que pasó después?";
      default: return "¿Qué más vuelve a tu mente cuando miras esta fotografía?";
    }
  }
  switch (focus) {
    case "person": return "Who is part of this memory for you?";
    case "place": return "Where do you remember being?";
    case "time": return "About when in your life was this?";
    case "event": return "What was happening around this moment?";
    case "meaning": return "What makes this memory matter to you now?";
    case "sensory": return "What detail from that moment can you still see, hear, or feel?";
    case "emotion": return "How did you feel in that moment?";
    case "sequence": return "What do you remember happening next?";
    default: return "What else comes back to you when you look at this photograph?";
  }
}

function parseDecision(
  raw: string,
  locale: string,
  unresolved: readonly CoreFocus[],
  questionCount: number
): { question: string; focus: MuseFocus } {
  const stripped = raw
    .trim()
    .replace(/^\`\`\`(?:json)?/i, "")
    .replace(/\`\`\`$/, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped) as {
      question?: unknown;
      focus?: unknown;
    };
    const focus = allFocuses.includes(String(parsed.focus) as MuseFocus)
      ? (String(parsed.focus) as MuseFocus)
      : null;
    const question =
      typeof parsed.question === "string"
        ? museValidation.normalizeQuestion(parsed.question, locale)
        : "";

    if (focus && question) {
      if (questionCount >= 2 && unresolved.length > 0 && !unresolved.includes(focus as CoreFocus)) {
        const forced = unresolved[0]!;
        return { focus: forced, question: questionForFocus(forced, locale) };
      }
      return { focus, question };
    }
  } catch {
    // Deterministic fallback below.
  }

  if (questionCount === 0) {
    return { focus: "detail", question: questionForFocus("detail", locale) };
  }
  const focus = unresolved[0] ?? (questionCount < 5 ? "meaning" : "open");
  return { focus, question: questionForFocus(focus, locale) };
}

async function generateNextQuestion(
  env: MuseConversationEnv,
  transcript: TranscriptRow,
  turns: readonly TurnRow[],
  context: readonly StoryContextEntry[]
): Promise<{ question: string; focus: MuseFocus; modelConfigVersion: string }> {
  const unresolved = unresolvedContext(context);
  const questionCount = turns.filter((turn) => turn.speaker === "muse").length;

  if (questionCount >= 8 && unresolved.length > 0) {
    const focus = unresolved[0]!;
    return {
      focus,
      question: questionForFocus(focus, transcript.locale),
      modelConfigVersion: "deterministic-anchor-fallback-v1"
    };
  }

  const dialogue = turns
    .map((turn) => `${turn.speaker === "muse" ? "Muse" : "Storyteller"}: ${turn.content}`)
    .join("\n");

  try {
    const provider = createMuseTextProvider(env);
    const result = await provider.generate({
      system:
        "You are Muse, a warm conversational story elicitor for a private family memory. Your job is to help the storyteller remember and tell more of their own story, one short question at a time. Never fact-check, correct, challenge, verify, judge, reconcile, rank, diagnose, or introduce a person, place, date, event, motive, feeling, or detail the storyteller did not provide. Never tell the storyteller what their memory means. Prefer natural follow-ups about vivid detail, what happened next, people, place, time, feeling, sensory memory, or why the memory matters. Avoid checklist language and do not repeat something already answered. The system tracks four preservation anchors: person, place, time, event. Before the conversation closes, each unresolved anchor must be gently asked or the storyteller must choose unknown/omit. Output JSON only in this exact shape: {\"question\":\"one question\",\"focus\":\"person|place|time|event|detail|meaning|sensory|emotion|sequence|open\"}. Ask in the storyteller's language.",
      user:
        `Original storyteller transcript:\n${transcript.text}\n\nConversation so far:\n${dialogue || "(none yet)"}\n\nUnresolved preservation anchors: ${unresolved.join(", ") || "none"}.\nMuse questions already asked: ${questionCount}.`,
      maxTokens: 120,
      temperature: 0.45
    });
    const decision = parseDecision(
      result,
      transcript.locale,
      unresolved,
      questionCount
    );
    return {
      ...decision,
      modelConfigVersion: phase1Config.ai.modelConfigVersion
    };
  } catch {
    const fallback =
      questionCount === 0
        ? { focus: "detail" as MuseFocus, question: questionForFocus("detail", transcript.locale) }
        : {
            focus: (unresolved[0] ?? "meaning") as MuseFocus,
            question: questionForFocus(unresolved[0] ?? "meaning", transcript.locale)
          };
    return {
      ...fallback,
      modelConfigVersion: "deterministic-conversation-fallback-v1"
    };
  }
}

async function insertMuseTurn(
  env: MuseConversationEnv,
  livingMemoryId: string,
  turnIndex: number,
  question: string,
  focus: MuseFocus,
  sourceRef: string,
  modelConfigVersion: string
): Promise<void> {
  const hash = await sha256(
    [livingMemoryId, String(turnIndex), "muse", question, focus].join("|")
  );
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO muse_conversation_turns (
       id, memory_story_id, turn_index, speaker, content, focus_kind,
       response_state, source_ref, model_config_version, prompt_version,
       created_by_user_id, created_at
     ) VALUES (?, ?, ?, 'muse', ?, ?, NULL, ?, ?, ?, NULL, ?)`
  ).bind(
    `muse_turn_${hash.slice(0, 48)}`,
    livingMemoryId,
    turnIndex,
    question,
    focus,
    sourceRef,
    modelConfigVersion,
    phase1Config.ai.museConversationPromptVersion,
    now
  ).run();
}

async function insertStorytellerTurn(
  env: MuseConversationEnv,
  livingMemoryId: string,
  turnIndex: number,
  userId: string,
  replyToTurnId: string,
  content: string,
  state: StoryContextInput["state"],
  focus: MuseFocus | null,
  voiceReplyAssetId: string | null
): Promise<string> {
  const hash = await sha256(
    [
      livingMemoryId,
      replyToTurnId,
      userId,
      state,
      content,
      voiceReplyAssetId ?? ""
    ].join("|")
  );
  const turnId = `story_turn_${hash.slice(0, 48)}`;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO muse_conversation_turns (
       id, memory_story_id, turn_index, speaker, content, focus_kind,
       response_state, source_ref, reply_to_turn_id, voice_reply_asset_id,
       model_config_version, prompt_version, created_by_user_id, created_at
     ) VALUES (?, ?, ?, 'storyteller', ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`
  ).bind(
    turnId,
    livingMemoryId,
    turnIndex,
    content,
    focus,
    state,
    `muse:${replyToTurnId}`,
    replyToTurnId,
    voiceReplyAssetId,
    userId,
    new Date().toISOString()
  ).run();
  return turnId;
}

async function saveContextFromReply(
  env: MuseConversationEnv,
  livingMemoryId: string,
  userId: string,
  focus: MuseFocus | null,
  state: StoryContextInput["state"],
  content: string,
  storytellerTurnId: string
): Promise<void> {
  if (!focus || !coreFocuses.includes(focus as CoreFocus)) return;
  const kind = focus as CoreFocus;
  const value =
    state === "stated" || state === "approximate" ? content.trim() : null;
  const entry = validateStoryContext({
    kind,
    state,
    value,
    sourceRef: `muse-conversation:${storytellerTurnId}`
  });
  const hash = await sha256(
    [livingMemoryId, storytellerTurnId, kind].join("|")
  );
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO living_memory_context_entries (
       id, memory_story_id, kind, value, context_state, source_type,
       source_ref, created_by_user_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 'storyteller', ?, ?, ?, ?)`
  ).bind(
    `context_${hash.slice(0, 48)}`,
    livingMemoryId,
    entry.kind,
    entry.value,
    entry.state,
    entry.sourceRef ?? null,
    userId,
    now,
    now
  ).run();
}

function serializeTurn(turn: TurnRow, draftId: string) {
  return {
    turnId: turn.id,
    index: turn.turn_index,
    speaker: turn.speaker,
    content: turn.content,
    focus: turn.focus_kind,
    state: turn.response_state,
    replyTo:
      turn.reply_to_turn_id ??
      (turn.source_ref?.startsWith("muse:")
        ? turn.source_ref.slice(5)
        : null),
    voiceReplyAssetId: turn.voice_reply_asset_id,
    voiceReplyMediaUrl: turn.voice_reply_asset_id
      ? `/resources/drafts/${encodeURIComponent(draftId)}/muse-voice-replies/${encodeURIComponent(turn.voice_reply_asset_id)}/media`
      : null,
    createdAt: turn.created_at
  };
}

async function snapshot(
  env: MuseConversationEnv,
  livingMemoryId: string,
  draftId: string
): Promise<Response> {
  const turns = await conversationTurns(env, livingMemoryId);
  const context = await currentContext(env, livingMemoryId);
  const unresolved = unresolvedContext(context);
  const museTurns = turns.filter((turn) => turn.speaker === "muse");
  const lastTurn = turns.at(-1) ?? null;
  const done =
    unresolved.length === 0 &&
    lastTurn?.speaker === "storyteller" &&
    museTurns.length >= 2;

  return json({
    ok: true,
    livingMemoryId,
    turns: turns.map((turn) => serializeTurn(turn, draftId)),
    context,
    unresolved,
    done,
    currentQuestion:
      !done && lastTurn?.speaker === "muse"
        ? serializeTurn(lastTurn, draftId)
        : null
  });
}

async function requireVoiceReply(
  env: MuseConversationEnv,
  memoryStoryId: string,
  replyToTurnId: string,
  assetId: string
): Promise<VoiceReplyRow> {
  const asset = await env.DB.prepare(
    `SELECT id, memory_story_id, reply_to_turn_id, durability_status,
            transcript_text, transcript_locale, storyteller_text, storyteller_confirmed_at
     FROM muse_voice_reply_assets
     WHERE id = ? AND memory_story_id = ?`
  ).bind(assetId, memoryStoryId).first<VoiceReplyRow>();

  if (
    !asset ||
    asset.reply_to_turn_id !== replyToTurnId ||
    asset.durability_status !== "durable"
  ) {
    throw new MuseConversationError(
      409,
      "voice_reply_not_ready",
      "That spoken reply is not ready for this Muse question."
    );
  }
  if (!asset.transcript_text?.trim()) {
    throw new MuseConversationError(
      409,
      "voice_reply_transcript_pending",
      "Your voice reply is safe. Muse still needs the transcript before continuing."
    );
  }

  const alreadyUsed = await env.DB.prepare(
    `SELECT id
     FROM muse_conversation_turns
     WHERE memory_story_id = ?
       AND voice_reply_asset_id = ?
     LIMIT 1`
  ).bind(memoryStoryId, assetId).first();
  if (alreadyUsed) {
    throw new MuseConversationError(
      409,
      "voice_reply_used",
      "That spoken reply is already part of the conversation."
    );
  }

  return asset;
}

async function confirmVoiceReplyText(
  env: MuseConversationEnv,
  memoryStoryId: string,
  assetId: string,
  text: string
): Promise<void> {
  const confirmed = text.replace(/\s+/g, " ").trim();
  if (!confirmed || confirmed.length > 1200) {
    throw new MuseConversationError(
      400,
      "invalid_voice_reply_text",
      "Review the words Muse heard before continuing."
    );
  }
  await env.DB.prepare(
    `UPDATE muse_voice_reply_assets
     SET storyteller_text = ?, storyteller_confirmed_at = ?
     WHERE id = ? AND memory_story_id = ?`
  ).bind(
    confirmed,
    new Date().toISOString(),
    assetId,
    memoryStoryId
  ).run();
}

type ConversationBody = {
  replyToTurnId?: unknown;
  answer?: unknown;
  state?: unknown;
  voiceReplyAssetId?: unknown;
};

async function continueConversation(
  request: Request,
  env: MuseConversationEnv,
  draftId: string
): Promise<Response> {
  assertMutation(request);
  const userId = await requireOwner(request, env);
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const transcript = await transcriptFor(env, foundation.livingMemoryId);
  if (!transcript) {
    throw new MuseConversationError(
      409,
      "transcript_not_ready",
      "Your photograph and voice are safe. Muse can continue after the transcript is ready."
    );
  }

  const body = (await request.json().catch(() => ({}))) as ConversationBody;
  let turns = await conversationTurns(env, foundation.livingMemoryId);
  let context = await currentContext(env, foundation.livingMemoryId);

  if (turns.length === 0) {
    const next = await generateNextQuestion(env, transcript, turns, context);
    await insertMuseTurn(
      env,
      foundation.livingMemoryId,
      0,
      next.question,
      next.focus,
      `transcript:${transcript.id}`,
      next.modelConfigVersion
    );
    return snapshot(env, foundation.livingMemoryId, draftId);
  }

  if (body.replyToTurnId) {
    const replyToTurnId = validIdentifier(
      String(body.replyToTurnId),
      "Muse turn ID"
    );
    const target = turns.find(
      (turn) => turn.id === replyToTurnId && turn.speaker === "muse"
    );
    if (!target) {
      throw new MuseConversationError(
        409,
        "conversation_turn",
        "That Muse question is no longer the active turn."
      );
    }

    const existingReply = turns.find(
      (turn) =>
        turn.speaker === "storyteller" &&
        (
          turn.reply_to_turn_id === replyToTurnId ||
          turn.source_ref === `muse:${replyToTurnId}`
        )
    );

    if (!existingReply) {
      const state = ["stated", "approximate", "unknown", "omitted"].includes(
        String(body.state)
      )
        ? (String(body.state) as StoryContextInput["state"])
        : "stated";

      const voiceReplyAssetId =
        typeof body.voiceReplyAssetId === "string" && body.voiceReplyAssetId.trim()
          ? validIdentifier(body.voiceReplyAssetId, "Voice reply asset ID")
          : null;
      const voiceReply = voiceReplyAssetId
        ? await requireVoiceReply(
            env,
            foundation.livingMemoryId,
            replyToTurnId,
            voiceReplyAssetId
          )
        : null;

      const typedAnswer =
        typeof body.answer === "string"
          ? body.answer.replace(/\s+/g, " ").trim()
          : "";
      const rawAnswer = typedAnswer;

      if (voiceReply && !rawAnswer) {
        throw new MuseConversationError(
          400,
          "voice_reply_confirmation_required",
          "Review what Muse heard and confirm the words before continuing."
        );
      }

      if (voiceReply) {
        await confirmVoiceReplyText(
          env,
          foundation.livingMemoryId,
          voiceReply.id,
          rawAnswer
        );
      }

      if (
        (state === "stated" || state === "approximate") &&
        (!rawAnswer || rawAnswer.length > 1200)
      ) {
        throw new MuseConversationError(
          400,
          "invalid_answer",
          "Tell Muse what you remember in a short reply."
        );
      }
      const content =
        state === "unknown"
          ? "I don't remember."
          : state === "omitted"
            ? "I'd rather leave that out."
            : rawAnswer;

      const nextIndex =
        Math.max(...turns.map((turn) => turn.turn_index), -1) + 1;
      const storytellerTurnId = await insertStorytellerTurn(
        env,
        foundation.livingMemoryId,
        nextIndex,
        userId,
        replyToTurnId,
        content,
        state,
        target.focus_kind,
        voiceReplyAssetId
      );
      await saveContextFromReply(
        env,
        foundation.livingMemoryId,
        userId,
        target.focus_kind,
        state,
        content,
        storytellerTurnId
      );
    }
  }

  turns = await conversationTurns(env, foundation.livingMemoryId);
  context = await currentContext(env, foundation.livingMemoryId);
  const unresolved = unresolvedContext(context);
  const museTurns = turns.filter((turn) => turn.speaker === "muse");
  const lastTurn = turns.at(-1);

  if (unresolved.length === 0 && lastTurn?.speaker === "storyteller" && museTurns.length >= 2) {
    return snapshot(env, foundation.livingMemoryId, draftId);
  }

  if (lastTurn?.speaker === "storyteller") {
    const next = await generateNextQuestion(env, transcript, turns, context);
    const nextIndex =
      Math.max(...turns.map((turn) => turn.turn_index), -1) + 1;
    await insertMuseTurn(
      env,
      foundation.livingMemoryId,
      nextIndex,
      next.question,
      next.focus,
      `conversation:${lastTurn.id}`,
      next.modelConfigVersion
    );
  }

  return snapshot(env, foundation.livingMemoryId, draftId);
}

export async function handleMuseConversationRoute(
  request: Request,
  env: MuseConversationEnv
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(
    /^\/resources\/drafts\/([^/]+)\/muse-conversation$/
  );
  if (!match?.[1]) return null;
  const draftId = validIdentifier(decodeURIComponent(match[1]), "Draft ID");

  try {
    const userId = await requireOwner(request, env);
    const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);

    if (request.method === "GET") {
      return snapshot(env, foundation.livingMemoryId, draftId);
    }
    if (request.method === "POST") {
      return await continueConversation(request, env, draftId);
    }
    return json(
      { ok: false, error: { code: "method", message: "Method not allowed." } },
      405
    );
  } catch (error) {
    if (error instanceof LivingMemoryPersistenceError) {
      const status =
        error.code === "draft_not_found"
          ? 404
          : error.code === "owner_required"
            ? 401
            : error.code === "owner_mismatch"
              ? 403
              : 409;
      return json(
        { ok: false, error: { code: error.code, message: error.message } },
        status
      );
    }
    const routeError =
      error instanceof MuseConversationError
        ? error
        : new MuseConversationError(
            500,
            "internal",
            "Muse could not continue the conversation right now."
          );
    return json(
      {
        ok: false,
        error: { code: routeError.code, message: routeError.message }
      },
      routeError.status
    );
  }
}
