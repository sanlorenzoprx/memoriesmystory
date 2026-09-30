import {
  authenticateAppSession,
  sha256Text,
  type AuthSessionEnv
} from "./auth-session";
import {
  createMuseSpeechProvider,
  type MuseSpeechProviderEnv
} from "./providers/muse-speech-provider";

export type MuseTtsEnv = AuthSessionEnv & MuseSpeechProviderEnv;

type DraftRow = {
  owner_user_id: string | null;
  anonymous_identity_hash: string | null;
};

class MuseTtsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const requestHeader = "muse-tts-v1";
const identifierPattern = /^[A-Za-z0-9_-]{8,160}$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function validIdentifier(value: string | null): string {
  const candidate = value?.trim() ?? "";
  if (!identifierPattern.test(candidate)) {
    throw new MuseTtsError(400, "invalid_identifier", "Draft ID is invalid.");
  }
  return candidate;
}

function assertMutation(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== requestHeader) {
    throw new MuseTtsError(403, "csrf", "The Muse voice request could not be verified.");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new MuseTtsError(403, "origin", "The Muse voice request origin is not allowed.");
  }
}

async function authorizeDraft(
  request: Request,
  env: MuseTtsEnv,
  draftId: string
): Promise<void> {
  const draft = await env.DB.prepare(
    "SELECT owner_user_id, anonymous_identity_hash FROM memory_story_drafts WHERE id = ?"
  ).bind(draftId).first<DraftRow>();

  if (!draft) {
    throw new MuseTtsError(404, "draft_not_found", "That memory draft was not found.");
  }

  if (draft.owner_user_id) {
    const session = await authenticateAppSession(request, env);
    if (!session || session.userId !== draft.owner_user_id) {
      throw new MuseTtsError(401, "session_required", "Sign in to hear Muse for this memory.");
    }
    return;
  }

  const token = request.headers.get("X-Draft-Token")?.trim() ?? "";
  if (!draft.anonymous_identity_hash || token.length < 32 || token.length > 256) {
    throw new MuseTtsError(403, "draft_scope", "This local memory could not be verified.");
  }
  const tokenHash = await sha256Text(token);
  if (!safeEqual(tokenHash, draft.anonymous_identity_hash)) {
    throw new MuseTtsError(403, "draft_scope", "This local memory could not be verified.");
  }
}

async function synthesize(
  request: Request,
  env: MuseTtsEnv,
  draftId: string
): Promise<Response> {
  assertMutation(request);
  await authorizeDraft(request, env, draftId);

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > 420) {
    throw new MuseTtsError(400, "invalid_text", "Muse speech must be a short prompt.");
  }

  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  const voiceId = env.ELEVENLABS_MUSE_VOICE_ID?.trim();
  if (!apiKey || !voiceId) {
    throw new MuseTtsError(
      503,
      "muse_tts_not_configured",
      "Muse voice is not configured yet."
    );
  }

  let providerResponse: Response;
  try {
    providerResponse = await createMuseSpeechProvider(env).synthesize({ text });
  } catch {
    throw new MuseTtsError(
      503,
      "muse_tts_transport",
      "Muse voice could not connect right now."
    );
  }

  if (!providerResponse.ok || !providerResponse.body) {
    throw new MuseTtsError(
      503,
      "muse_tts_provider",
      "Muse voice is not available right now."
    );
  }

  return new Response(providerResponse.body, {
    status: 200,
    headers: {
      "Content-Type": providerResponse.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function handleMuseTtsRoute(
  request: Request,
  env: MuseTtsEnv
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(
    /^\/resources\/drafts\/([^/]+)\/muse-tts$/
  );
  if (!match?.[1]) return null;
  if (request.method !== "POST") {
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  }

  try {
    return await synthesize(request, env, validIdentifier(decodeURIComponent(match[1])));
  } catch (error) {
    const routeError = error instanceof MuseTtsError
      ? error
      : new MuseTtsError(500, "internal", "Muse voice could not be created.");
    return json(
      { ok: false, error: { code: routeError.code, message: routeError.message } },
      routeError.status
    );
  }
}
