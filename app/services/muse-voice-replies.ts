import type { LocalAudio } from "../features/capture/local-draft";

export type MuseVoiceReplyUploadIdentity = {
  readonly assetId: string;
  readonly idempotencyKey: string;
};

export type MuseVoiceReplyView = {
  readonly assetId: string;
  readonly replyToTurnId: string;
  readonly byteSize: number;
  readonly durationMs: number;
  readonly sha256: string;
  readonly r2Etag: string | null;
  readonly durabilityStatus: "pending" | "durable" | "failed";
  readonly transcript: string | null;
  readonly locale: string | null;
  readonly storytellerText: string | null;
  readonly storytellerConfirmedAt: string | null;
  readonly transcribedAt: string | null;
  readonly mediaUrl: string;
};

export type MuseVoiceReplyResult = {
  readonly state: "ready" | "transcription_pending";
  readonly voiceReply: MuseVoiceReplyView;
  readonly replayed: boolean;
};

export class MuseVoiceReplyError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

async function responseError(response: Response): Promise<MuseVoiceReplyError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    return new MuseVoiceReplyError(
      body.error?.message ?? "The voice reply could not continue.",
      body.error?.code ?? "muse_voice_reply_failed",
      response.status
    );
  } catch {
    return new MuseVoiceReplyError(
      "The voice reply could not continue.",
      "muse_voice_reply_failed",
      response.status
    );
  }
}

export function makeMuseVoiceReplyIdentity(
  draftId: string,
  replyToTurnId: string
): MuseVoiceReplyUploadIdentity {
  const nonce = crypto.randomUUID();
  return {
    assetId: `muse_voice_${nonce}`,
    idempotencyKey: `muse_voice_upload_${draftId}_${replyToTurnId}_${nonce}`
  };
}

export async function uploadMuseVoiceReply(input: {
  readonly draftId: string;
  readonly replyToTurnId: string;
  readonly identity: MuseVoiceReplyUploadIdentity;
  readonly audio: LocalAudio;
}): Promise<MuseVoiceReplyResult> {
  let response: Response;
  try {
    response = await fetch(
      `/resources/drafts/${encodeURIComponent(input.draftId)}/muse-voice-replies/${encodeURIComponent(input.identity.assetId)}`,
      {
        method: "PUT",
        credentials: "same-origin",
        body: input.audio.blob,
        headers: {
          "Content-Type": input.audio.mimeType,
          "X-Audio-Duration-MS": String(input.audio.durationMs),
          "X-Content-Length": String(input.audio.byteSize),
          "X-Content-SHA256": input.audio.sha256,
          "X-Idempotency-Key": input.identity.idempotencyKey,
          "X-Memories-Request": "muse-voice-reply-v1",
          "X-Reply-To-Turn-ID": input.replyToTurnId
        }
      }
    );
  } catch {
    throw new MuseVoiceReplyError(
      "Your voice reply is still on this device. Reconnect and try again.",
      "network",
      0
    );
  }

  if (!response.ok && response.status !== 202) {
    throw await responseError(response);
  }

  return response.json() as Promise<MuseVoiceReplyResult>;
}

export async function retryMuseVoiceReplyTranscription(
  draftId: string,
  assetId: string
): Promise<MuseVoiceReplyResult> {
  const response = await fetch(
    `/resources/drafts/${encodeURIComponent(draftId)}/muse-voice-replies/${encodeURIComponent(assetId)}`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-Memories-Request": "muse-voice-reply-v1"
      }
    }
  );

  if (!response.ok && response.status !== 202) {
    throw await responseError(response);
  }
  return response.json() as Promise<MuseVoiceReplyResult>;
}
