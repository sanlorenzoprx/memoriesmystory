import { phase1Config } from "../../config/phase-1";
import {
  updateLocalUpload,
  type LocalMemoryDraft,
  type LocalUploadState
} from "../features/capture/local-draft";
import {
  MediaDurabilityError,
  uploadOriginalAudio,
  uploadOriginalPhoto
} from "./media-durability";

export type DraftCommit = (draft: LocalMemoryDraft) => Promise<void>;

function withUploadState(
  draft: LocalMemoryDraft,
  role: "photo" | "audio",
  upload: LocalUploadState
): LocalMemoryDraft {
  return {
    ...draft,
    ...(role === "photo" ? { photoUpload: upload } : { audioUpload: upload }),
    updatedAt: new Date().toISOString()
  };
}

async function preservePhoto(
  draft: LocalMemoryDraft,
  commit: DraftCommit
): Promise<LocalMemoryDraft> {
  if (!draft.photo || !draft.photoUpload || draft.photoUpload.status === "durable") {
    return draft;
  }

  const uploading = withUploadState(
    draft,
    "photo",
    updateLocalUpload(draft.photoUpload, {
      status: "uploading",
      lastError: null
    })
  );
  await commit(uploading);

  try {
    const receipt = await uploadOriginalPhoto(uploading);
    const durable = withUploadState(
      uploading,
      "photo",
      updateLocalUpload(uploading.photoUpload!, {
        status: "durable",
        receipt,
        lastError: null
      })
    );
    await commit(durable);
    return durable;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Photograph backup is waiting for a connection.";
    const waiting = withUploadState(
      uploading,
      "photo",
      updateLocalUpload(uploading.photoUpload!, {
        status: "needs_connection",
        lastError: message
      })
    );
    await commit(waiting);
    throw error;
  }
}

async function preserveAudio(
  draft: LocalMemoryDraft,
  commit: DraftCommit
): Promise<LocalMemoryDraft> {
  if (
    !draft.audio?.acceptedAt ||
    !draft.audioUpload ||
    draft.audioUpload.status === "durable"
  ) {
    return draft;
  }

  if (draft.photoUpload?.status !== "durable") {
    throw new MediaDurabilityError(
      "Photograph backup must finish before voice backup.",
      true,
      "photo_order"
    );
  }

  const uploading = withUploadState(
    draft,
    "audio",
    updateLocalUpload(draft.audioUpload, {
      status: "uploading",
      lastError: null
    })
  );
  await commit(uploading);

  try {
    const receipt = await uploadOriginalAudio(uploading);
    const durable = withUploadState(
      uploading,
      "audio",
      updateLocalUpload(uploading.audioUpload!, {
        status: "durable",
        receipt,
        lastError: null
      })
    );
    await commit(durable);
    return durable;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Voice backup is waiting for a connection.";
    const waiting = withUploadState(
      uploading,
      "audio",
      updateLocalUpload(uploading.audioUpload!, {
        status: "needs_connection",
        lastError: message
      })
    );
    await commit(waiting);
    throw error;
  }
}

export function needsOriginalSync(draft: LocalMemoryDraft): boolean {
  const photoPending = Boolean(
    draft.photo?.acceptedAt && draft.photoUpload?.status !== "durable"
  );
  const audioPending = Boolean(
    draft.audio?.acceptedAt && draft.audioUpload?.status !== "durable"
  );
  return photoPending || audioPending;
}

export async function syncAcceptedOriginalsOnce(
  draft: LocalMemoryDraft,
  commit: DraftCommit
): Promise<LocalMemoryDraft> {
  const withPhoto = await preservePhoto(draft, commit);
  return preserveAudio(withPhoto, commit);
}

function isRetryable(error: unknown): boolean {
  return !(error instanceof MediaDurabilityError) || error.retryable;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function syncAcceptedOriginalsInBackground(input: {
  readonly getDraft: () => LocalMemoryDraft;
  readonly commit: DraftCommit;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<LocalMemoryDraft> {
  const wait = input.wait ?? delay;
  let lastError: unknown;

  for (const retryDelay of phase1Config.durability.backgroundRetryDelaysMs) {
    if (retryDelay > 0) await wait(retryDelay);

    const current = input.getDraft();
    if (!needsOriginalSync(current)) return current;

    try {
      return await syncAcceptedOriginalsOnce(current, input.commit);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) break;
    }
  }

  throw lastError ?? new Error("Background backup is waiting for a connection.");
}
