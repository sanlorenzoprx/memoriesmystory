import { phase1Config } from "../config/phase-1";
import {
  asId,
  validateStoryContext,
  type LivingMemoryId,
  type StoryContextEntry,
  type StoryContextId,
  type StoryContextInput,
  type UserId
} from "../app/domain";
import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import {
  ensureLivingMemoryFoundation,
  LivingMemoryPersistenceError,
  type LivingMemoryPersistenceEnv
} from "./living-memory-persistence";

export type MuseEnv = AuthSessionEnv &
  LivingMemoryPersistenceEnv & {
    readonly AI: Ai;
  };

type TranscriptRow = {
  id: string;
  text: string;
  locale: string;
};

type MuseArtifactRow = {
  id: string;
  content: string;
  source_refs_json: string;
  model_config_version: string;
  prompt_version: string;
  created_at: string;
};

type ContextRow = {
  id: string;
  memory_story_id: string;
  kind: "person" | "place" | "time" | "event";
  value: string | null;
  context_state: "stated" | "approximate" | "unknown" | "omitted";
  created_by_user_id: string;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
};

class MuseRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const requestHeader = "muse-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,160}$/;
const judgmentPattern =
  /\b(are you sure|is that true|was that really|actually|correct|incorrect|wrong|accurate|inaccurate|verify|verified|prove|contradict|disputed|reliable|unreliable)\b/i;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
function validIdentifier(value: string | null, label: string): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new MuseRouteError(400, "invalid_identifier", `${label} is invalid.`);
  }
  return candidate;
}

function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new MuseRouteError(403, "csrf", "The remembering request could not be verified.");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new MuseRouteError(403, "origin", "The remembering request origin is not allowed.");
  }
}

async function requireOwner(request: Request, env: MuseEnv): Promise<string> {
  const session = await authenticateAppSession(request, env);
  if (!session) throw new MuseRouteError(401, "session_required", "Sign in to continue this Living Memory.");
  return session.userId;
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fallbackQuestion(locale: string): string {
  return locale.toLowerCase().startsWith("es")
    ? "¿Qué más recuerdas cuando miras esta foto?"
    : "What else comes back to you when you look at this photograph?";
}

function normalizeQuestion(candidate: string, locale: string): string {
  const singleLine = candidate.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
  const sentence = singleLine.split(/(?<=[?])\s+/)[0]?.trim() ?? "";
  if (
    !sentence ||
    sentence.length > 220 ||
    !sentence.endsWith("?") ||
    judgmentPattern.test(sentence)
  ) {
    return fallbackQuestion(locale);
  }
  return sentence;
}

function aiResponseText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const response = (result as Record<string, unknown>).response;
  return typeof response === "string" ? response : "";
}
async function transcriptFor(
  env: MuseEnv,
  livingMemoryId: string
): Promise<TranscriptRow | null> {
  return env.DB.prepare(
    `SELECT tr.id, tr.text, tr.locale
     FROM memory_stories ms
     JOIN transcript_revisions tr ON tr.id = ms.current_transcript_revision_id
     WHERE ms.id = ?`
  ).bind(livingMemoryId).first<TranscriptRow>();
}

async function currentMusePrompt(
  env: MuseEnv,
  livingMemoryId: string
): Promise<MuseArtifactRow | null> {
  return env.DB.prepare(
    `SELECT id, content, source_refs_json, model_config_version, prompt_version, created_at
     FROM generated_artifacts
     WHERE memory_story_id = ? AND kind = 'muse_prompt' AND status = 'ready'
     ORDER BY created_at DESC LIMIT 1`
  ).bind(livingMemoryId).first<MuseArtifactRow>();
}

async function currentContext(
  env: MuseEnv,
  livingMemoryId: string
): Promise<StoryContextEntry[]> {
  const result = await env.DB.prepare(
    `SELECT id, memory_story_id, kind, value, context_state,
            created_by_user_id, source_ref, created_at, updated_at
     FROM living_memory_context_entries
     WHERE memory_story_id = ?
     ORDER BY created_at DESC`
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
async function generateMuseQuestion(
  env: MuseEnv,
  livingMemoryId: string,
  transcript: TranscriptRow
): Promise<MuseArtifactRow> {
  const existing = await currentMusePrompt(env, livingMemoryId);
  if (existing) return existing;

  const sourceRef = `transcript:${transcript.id}`;
  const artifactHash = await sha256(
    [livingMemoryId, transcript.id, phase1Config.ai.musePromptVersion].join("|")
  );
  const artifactId = `muse_${artifactHash.slice(0, 48)}`;
  let modelConfigVersion: string = phase1Config.ai.modelConfigVersion;
  let question = fallbackQuestion(transcript.locale);

  if (transcript.text.trim()) {
    try {
      const result = await env.AI.run(phase1Config.ai.museModelId, {
        messages: [
          {
            role: "system",
            content:
              "You are Muse, a quiet remembering companion. Ask exactly one warm question that may help the storyteller remember more of their own experience. Use only what the storyteller said below as context. Never fact-check, correct, challenge, verify, judge, rank, diagnose, or introduce facts. Do not say the memory is true, false, accurate, disputed, or unreliable. Ask in the storyteller's language. Output only the question, with no preamble."
          },
          {
            role: "user",
            content: `Storyteller transcript:\n${transcript.text}`
          }
        ],
        max_tokens: 80,
        temperature: 0.4
      });
      question = normalizeQuestion(aiResponseText(result), transcript.locale);
    } catch {
      modelConfigVersion = "deterministic-fallback-v1";
    }
  } else {
    modelConfigVersion = "deterministic-fallback-v1";
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO generated_artifacts (
      id, memory_story_id, kind, content, status, source_refs_json,
      model_config_version, prompt_version, created_at, updated_at
    ) VALUES (?, ?, 'muse_prompt', ?, 'ready', ?, ?, ?, ?, ?)`
  ).bind(
    artifactId,
    livingMemoryId,
    question,
    JSON.stringify([sourceRef]),
    modelConfigVersion,
    phase1Config.ai.musePromptVersion,
    now,
    now
  ).run();

  return (await currentMusePrompt(env, livingMemoryId)) ?? {
    id: artifactId,
    content: question,
    source_refs_json: JSON.stringify([sourceRef]),
    model_config_version: modelConfigVersion,
    prompt_version: phase1Config.ai.musePromptVersion,
    created_at: now
  };
}
async function museSnapshot(
  request: Request,
  env: MuseEnv,
  draftId: string
): Promise<Response> {
  const userId = await requireOwner(request, env);
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const transcript = await transcriptFor(env, foundation.livingMemoryId);
  const prompt = await currentMusePrompt(env, foundation.livingMemoryId);
  const context = await currentContext(env, foundation.livingMemoryId);

  return json({
    ok: true,
    livingMemoryId: foundation.livingMemoryId,
    transcript: transcript
      ? { revisionId: transcript.id, text: transcript.text, locale: transcript.locale }
      : null,
    musePrompt: prompt
      ? {
          artifactId: prompt.id,
          question: prompt.content,
          sourceRefs: JSON.parse(prompt.source_refs_json) as string[],
          promptVersion: prompt.prompt_version,
          modelConfigVersion: prompt.model_config_version
        }
      : null,
    context
  });
}

async function askMuse(
  request: Request,
  env: MuseEnv,
  draftId: string
): Promise<Response> {
  assertMutation(request);
  const userId = await requireOwner(request, env);
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const transcript = await transcriptFor(env, foundation.livingMemoryId);
  if (!transcript) {
    throw new MuseRouteError(
      409,
      "transcript_not_ready",
      "Your photograph and voice are safe. Muse can help after the transcript is ready."
    );
  }
  const prompt = await generateMuseQuestion(env, foundation.livingMemoryId, transcript);
  return json({
    ok: true,
    livingMemoryId: foundation.livingMemoryId,
    musePrompt: {
      artifactId: prompt.id,
      question: prompt.content,
      sourceRefs: JSON.parse(prompt.source_refs_json) as string[],
      promptVersion: prompt.prompt_version,
      modelConfigVersion: prompt.model_config_version
    }
  }, 201);
}
type ContextBody = {
  entries?: unknown;
};

function parseContextEntries(value: unknown): StoryContextInput[] {
  if (!Array.isArray(value) || value.length > 4) {
    throw new MuseRouteError(400, "invalid_context", "Story context must contain up to four fields.");
  }
  const seen = new Set<string>();
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      throw new MuseRouteError(400, "invalid_context", "Story context is invalid.");
    }
    const record = candidate as Record<string, unknown>;
    const kind = record.kind;
    const state = record.state;
    if (!["person", "place", "time", "event"].includes(String(kind))) {
      throw new MuseRouteError(400, "invalid_context", "Story context kind is invalid.");
    }
    if (!["stated", "approximate", "unknown", "omitted"].includes(String(state))) {
      throw new MuseRouteError(400, "invalid_context", "Story context state is invalid.");
    }
    if (seen.has(String(kind))) {
      throw new MuseRouteError(400, "invalid_context", "Each story context field may appear once.");
    }
    seen.add(String(kind));
    try {
      return validateStoryContext({
        kind: kind as StoryContextInput["kind"],
        state: state as StoryContextInput["state"],
        value: typeof record.value === "string" ? record.value : null,
        sourceRef: typeof record.sourceRef === "string" ? record.sourceRef : null
      });
    } catch (error) {
      throw new MuseRouteError(
        400,
        "invalid_context",
        error instanceof Error ? error.message : "Story context is invalid."
      );
    }
  });
}

async function saveContext(
  request: Request,
  env: MuseEnv,
  draftId: string
): Promise<Response> {
  assertMutation(request);
  const userId = await requireOwner(request, env);
  const idempotencyKey = validIdentifier(request.headers.get("X-Idempotency-Key"), "Idempotency key");
  const foundation = await ensureLivingMemoryFoundation(env, draftId, userId);
  const body = (await request.json().catch(() => null)) as ContextBody | null;
  if (!body) throw new MuseRouteError(400, "invalid_body", "Story context could not be read.");
  const entries = parseContextEntries(body.entries);
  const now = new Date().toISOString();

  for (const entry of entries) {
    const hash = await sha256(
      [idempotencyKey, foundation.livingMemoryId, entry.kind].join("|")
    );
    const contextId = `context_${hash.slice(0, 48)}`;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO living_memory_context_entries (
        id, memory_story_id, kind, value, context_state, source_type,
        source_ref, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'storyteller', ?, ?, ?, ?)`
    ).bind(
      contextId,
      foundation.livingMemoryId,
      entry.kind,
      entry.value,
      entry.state,
      entry.sourceRef ?? null,
      userId,
      now,
      now
    ).run();
  }

  await env.DB.prepare(
    `UPDATE memory_story_drafts
     SET status = 'review_ready', updated_at = ?, version = version + 1
     WHERE id = ? AND owner_user_id = ?`
  ).bind(now, draftId, userId).run();

  return json({
    ok: true,
    livingMemoryId: foundation.livingMemoryId,
    context: await currentContext(env, foundation.livingMemoryId)
  });
}
export async function handleMuseRoute(
  request: Request,
  env: MuseEnv
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const museMatch = pathname.match(/^\/resources\/drafts\/([^/]+)\/muse$/);
  const contextMatch = pathname.match(/^\/resources\/drafts\/([^/]+)\/context$/);
  if (!museMatch?.[1] && !contextMatch?.[1]) return null;
  const draftId = validIdentifier(
    decodeURIComponent((museMatch?.[1] ?? contextMatch?.[1])!),
    "Draft ID"
  );

  try {
    if (museMatch?.[1] && request.method === "GET") {
      return await museSnapshot(request, env, draftId);
    }
    if (museMatch?.[1] && request.method === "POST") {
      return await askMuse(request, env, draftId);
    }
    if (contextMatch?.[1] && request.method === "PUT") {
      return await saveContext(request, env, draftId);
    }
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    if (error instanceof LivingMemoryPersistenceError) {
      const status = error.code === "draft_not_found" ? 404
        : error.code === "owner_required" ? 401
          : error.code === "owner_mismatch" ? 403
            : 409;
      return json({ ok: false, error: { code: error.code, message: error.message } }, status);
    }
    const routeError = error instanceof MuseRouteError
      ? error
      : new MuseRouteError(500, "internal", "Muse could not help right now.");
    return json({ ok: false, error: { code: routeError.code, message: routeError.message } }, routeError.status);
  }
}

export const museValidation = {
  normalizeQuestion,
  fallbackQuestion,
  judgmentPattern
};
