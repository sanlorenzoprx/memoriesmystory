import type {
  StoryContextEntry,
  StoryContextInput
} from "../domain";

type ApiErrorBody = { error?: { message?: string; code?: string } };

export class LivingMemoryApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

async function responseError(response: Response): Promise<LivingMemoryApiError> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return new LivingMemoryApiError(
    body.error?.message ?? "The Living Memory request could not be completed.",
    body.error?.code ?? "living_memory_request",
    response.status
  );
}

async function requireJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export type TranscriptView = {
  readonly revisionId: string;
  readonly text: string;
  readonly locale: string;
  readonly sourceAudioAssetId?: string;
  readonly createdAt?: string;
};

export type ProcessingView = {
  readonly state: "not_requested" | "queued" | "processing" | "ready" | "failed";
  readonly livingMemoryId: string;
  readonly transcript: TranscriptView | null;
  readonly retryable?: boolean;
};

export async function loadProcessing(draftId: string): Promise<ProcessingView> {
  return requireJson(
    await fetch(`/resources/drafts/${encodeURIComponent(draftId)}/process`, {
      credentials: "same-origin"
    })
  );
}

export async function startProcessing(draftId: string): Promise<ProcessingView> {
  return requireJson(
    await fetch(`/resources/drafts/${encodeURIComponent(draftId)}/process`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-Memories-Request": "processing-v1",
        "X-Idempotency-Key": `transcribe_${draftId}`
      }
    })
  );
}

export type MuseView = {
  readonly livingMemoryId: string;
  readonly transcript: { readonly revisionId: string; readonly text: string; readonly locale: string } | null;
  readonly musePrompt: {
    readonly artifactId: string;
    readonly question: string;
    readonly sourceRefs: readonly string[];
    readonly promptVersion: string;
    readonly modelConfigVersion: string;
  } | null;
  readonly context: readonly StoryContextEntry[];
};

export async function loadMuse(draftId: string): Promise<MuseView> {
  return requireJson(
    await fetch(`/resources/drafts/${encodeURIComponent(draftId)}/muse`, {
      credentials: "same-origin"
    })
  );
}

export async function askMuse(draftId: string): Promise<MuseView["musePrompt"]> {
  const body = await requireJson<{ readonly musePrompt: MuseView["musePrompt"] }>(
    await fetch(`/resources/drafts/${encodeURIComponent(draftId)}/muse`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Memories-Request": "muse-v1" }
    })
  );
  return body.musePrompt;
}


export type MuseConversationTurn = {
  readonly turnId: string;
  readonly index: number;
  readonly speaker: "muse" | "storyteller";
  readonly content: string;
  readonly focus:
    | "person"
    | "place"
    | "time"
    | "event"
    | "detail"
    | "meaning"
    | "sensory"
    | "emotion"
    | "sequence"
    | "open"
    | null;
  readonly state: StoryContextInput["state"] | null;
  readonly replyTo: string | null;
  readonly voiceReplyAssetId: string | null;
  readonly voiceReplyMediaUrl: string | null;
  readonly createdAt: string;
};

export type MuseConversationView = {
  readonly livingMemoryId: string;
  readonly turns: readonly MuseConversationTurn[];
  readonly context: readonly StoryContextEntry[];
  readonly unresolved: readonly ("person" | "place" | "time" | "event")[];
  readonly done: boolean;
  readonly currentQuestion: MuseConversationTurn | null;
};

export async function loadMuseConversation(
  draftId: string
): Promise<MuseConversationView> {
  return requireJson(
    await fetch(
      `/resources/drafts/${encodeURIComponent(draftId)}/muse-conversation`,
      { credentials: "same-origin" }
    )
  );
}

export async function continueMuseConversation(
  draftId: string,
  reply?: {
    readonly replyToTurnId: string;
    readonly answer?: string;
    readonly state?: StoryContextInput["state"];
    readonly voiceReplyAssetId?: string;
  }
): Promise<MuseConversationView> {
  return requireJson(
    await fetch(
      `/resources/drafts/${encodeURIComponent(draftId)}/muse-conversation`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Memories-Request": "muse-conversation-v1"
        },
        body: JSON.stringify(reply ?? {})
      }
    )
  );
}

export async function saveStoryContext(
  draftId: string,
  entries: readonly StoryContextInput[],
  idempotencyKey: string
): Promise<readonly StoryContextEntry[]> {
  const body = await requireJson<{ readonly context: readonly StoryContextEntry[] }>(
    await fetch(`/resources/drafts/${encodeURIComponent(draftId)}/context`, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Memories-Request": "muse-v1",
        "X-Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({ entries })
    })
  );
  return body.context;
}

export type LivingMemorySnapshot = {
  readonly livingMemoryId: string;
  readonly status: "draft" | "complete";
  readonly completedAt: string | null;
  readonly originals: {
    readonly photo: { readonly assetId: string; readonly mediaUrl: string };
    readonly audio: { readonly assetId: string; readonly mediaUrl: string };
  };
  readonly transcript: TranscriptView | null;
  readonly musePrompt: MuseView["musePrompt"];
  readonly context: readonly StoryContextEntry[];
};

export async function loadLivingMemory(draftId: string): Promise<LivingMemorySnapshot> {
  return requireJson(
    await fetch(`/resources/drafts/${encodeURIComponent(draftId)}/living-memory`, {
      credentials: "same-origin"
    })
  );
}

export async function completeLivingMemory(
  draftId: string
): Promise<{
  readonly livingMemoryId: string;
  readonly completedAt: string;
  readonly activationRecorded: boolean;
  readonly replayed: boolean;
}> {
  return requireJson(
    await fetch(`/resources/drafts/${encodeURIComponent(draftId)}/living-memory`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-Memories-Request": "completion-v1",
        "X-Idempotency-Key": `complete_${draftId}`
      }
    })
  );
}

export type ShareSelection = {
  readonly includeVoice: boolean;
  readonly includeCaptions: boolean;
  readonly includeNarratorAttribution: boolean;
  readonly includeBrandAttribution: boolean;
  readonly caption: string | null;
};

export type SharePreview = {
  readonly photo: true;
  readonly voice: boolean;
  readonly captions: string | null;
  readonly narratorAttribution: string | null;
  readonly brandAttribution: string | null;
  readonly caption: string | null;
};

export async function previewLivingMemoryShare(
  livingMemoryId: string,
  selection: ShareSelection
): Promise<SharePreview> {
  const body = await requireJson<{ readonly preview: SharePreview }>(
    await fetch(
      `/resources/living-memories/${encodeURIComponent(livingMemoryId)}/share-preview`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Memories-Request": "share-v1"
        },
        body: JSON.stringify(selection)
      }
    )
  );
  return body.preview;
}

export async function createLivingMemoryShare(
  livingMemoryId: string,
  selection: ShareSelection,
  idempotencyKey: string
): Promise<{
  readonly shareId: string;
  readonly sharePath: string;
  readonly revoked: boolean;
  readonly replayed: boolean;
}> {
  return requireJson(
    await fetch(
      `/resources/living-memories/${encodeURIComponent(livingMemoryId)}/shares`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Memories-Request": "share-v1",
          "X-Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(selection)
      }
    )
  );
}
