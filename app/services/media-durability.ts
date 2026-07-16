import type {
  DurableMediaReceipt,
  LocalAudio,
  LocalMemoryDraft,
  LocalPhoto,
  LocalUploadState
} from "../features/capture/local-draft";

type UploadRole = "photo" | "audio";

export class MediaDurabilityError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code: string
  ) {
    super(message);
  }
}

async function responseError(response: Response): Promise<MediaDurabilityError> {
  const fallback = "The original is still on this device. Please try again.";
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: string };
    };
    return new MediaDurabilityError(
      body.error?.message ?? fallback,
      response.status >= 500 || response.status === 408 || response.status === 429,
      body.error?.code ?? "upload_failed"
    );
  } catch {
    return new MediaDurabilityError(fallback, response.status >= 500, "upload_failed");
  }
}

async function uploadOriginal(input: {
  readonly draft: LocalMemoryDraft;
  readonly upload: LocalUploadState;
  readonly media: LocalPhoto | LocalAudio;
  readonly role: UploadRole;
}): Promise<DurableMediaReceipt> {
  let response: Response;
  try {
    response = await fetch(
      `/resources/drafts/${encodeURIComponent(input.draft.id)}/${input.role}`,
      {
        method: "PUT",
        body: input.media.blob,
        headers: {
          "Content-Type": input.media.mimeType,
          "X-Asset-ID": input.upload.assetId,
          "X-Content-Length": String(input.media.byteSize),
          "X-Content-SHA256": input.media.sha256,
          "X-Draft-Token": input.draft.draftToken,
          "X-Idempotency-Key": input.upload.idempotencyKey,
          "X-Memories-Request": "media-v1",
          "X-UI-Locale": input.draft.locale,
          ...(input.role === "audio"
            ? { "X-Audio-Duration-MS": String((input.media as LocalAudio).durationMs) }
            : {})
        }
      }
    );
  } catch {
    throw new MediaDurabilityError(
      "The original is still on this device. Reconnect and try again.",
      true,
      "network"
    );
  }

  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as { receipt?: DurableMediaReceipt };
  if (!body.receipt?.r2Etag || body.receipt.sha256 !== input.media.sha256) {
    throw new MediaDurabilityError(
      "The preservation receipt could not be verified. Retry safely.",
      true,
      "receipt"
    );
  }
  return body.receipt;
}

export function uploadOriginalPhoto(
  draft: LocalMemoryDraft
): Promise<DurableMediaReceipt> {
  if (!draft.photo || !draft.photoUpload) {
    return Promise.reject(
      new MediaDurabilityError("No local photograph is ready.", false, "missing_photo")
    );
  }
  return uploadOriginal({
    draft,
    upload: draft.photoUpload,
    media: draft.photo,
    role: "photo"
  });
}

export function uploadOriginalAudio(
  draft: LocalMemoryDraft
): Promise<DurableMediaReceipt> {
  if (!draft.audio || !draft.audioUpload) {
    return Promise.reject(
      new MediaDurabilityError("No local recording is ready.", false, "missing_audio")
    );
  }
  return uploadOriginal({
    draft,
    upload: draft.audioUpload,
    media: draft.audio,
    role: "audio"
  });
}

export async function verifyOriginalReceipts(draft: LocalMemoryDraft): Promise<{
  readonly originalsDurable: boolean;
  readonly assets: readonly DurableMediaReceipt[];
}> {
  const response = await fetch(
    `/resources/drafts/${encodeURIComponent(draft.id)}/media-status`,
    { headers: { "X-Draft-Token": draft.draftToken } }
  );
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<{
    originalsDurable: boolean;
    assets: DurableMediaReceipt[];
  }>;
}

export async function retrieveOriginal(
  draft: LocalMemoryDraft,
  assetId: string
): Promise<Blob> {
  const response = await fetch(
    `/resources/drafts/${encodeURIComponent(draft.id)}/media/${encodeURIComponent(assetId)}`,
    { headers: { "X-Draft-Token": draft.draftToken } }
  );
  if (!response.ok) throw await responseError(response);
  return response.blob();
}

