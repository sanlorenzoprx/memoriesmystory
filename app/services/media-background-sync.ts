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
export type DraftRead = () => LocalMemoryDraft;

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
  commit: DraftCommit,
  getDraft: DraftRead
): Promise<LocalMemoryDraft> {
  if (!draft.photo || !draft.photoUpload || draft.photoUpload.status === "durable") {
    return draft;
  }

  const latestBeforeUpload = getDraft();
  if (latestBeforeUpload.photoUpload?.assetId !== draft.photoUpload.assetId) {
    return latestBeforeUpload;
  }
  const uploading = withUploadState(
    latestBeforeUpload,
    "photo",
    updateLocalUpload(latestBeforeUpload.photoUpload, {
      status: "uploading",
      lastError: null
    })
  );
  await commit(uploading);

  try {
    const receipt = await uploadOriginalPhoto(uploading);
    const latest = getDraft();
    const latestUpload = latest.photoUpload;
    if (
      !latestUpload ||
      latestUpload.assetId !== uploading.photoUpload?.assetId ||
      latestUpload.status === "durable"
    ) {
      return latest;
    }
    const durable = withUploadState(
      latest,
      "photo",
      updateLocalUpload(latestUpload, {
        status: "durable",
        receipt,
        lastError: null
      })
    );
    await commit(durable);
    return durable;
  } catch (error) {
    const latest = getDraft();
    const latestUpload = latest.photoUpload;
    if (
      !latestUpload ||
      latestUpload.assetId !== uploading.photoUpload?.assetId ||
      latestUpload.status === "durable"
    ) {
      return latest;
    }
    const message =
      error instanceof Error ? error.message : "Photograph backup is waiting for a connection.";
    const waiting = withUploadState(
      latest,
      "photo",
      updateLocalUpload(latestUpload, {
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
  commit: DraftCommit,
  getDraft: DraftRead
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

  const latestBeforeUpload = getDraft();
  if (latestBeforeUpload.audioUpload?.assetId !== draft.audioUpload.assetId) {
    return latestBeforeUpload;
  }
  const uploading = withUploadState(
    latestBeforeUpload,
    "audio",
    updateLocalUpload(latestBeforeUpload.audioUpload, {
      status: "uploading",
      lastError: null
    })
  );
  await commit(uploading);

  try {
    const receipt = await uploadOriginalAudio(uploading);
    const latest = getDraft();
    const latestUpload = latest.audioUpload;
    if (
      !latestUpload ||
      latestUpload.assetId !== uploading.audioUpload?.assetId ||
      latestUpload.status === "durable"
    ) {
      return latest;
    }
    const durable = withUploadState(
      latest,
      "audio",
      updateLocalUpload(latestUpload, {
        status: "durable",
        receipt,
        lastError: null
      })
    );
    await commit(durable);
    return durable;
  } catch (error) {
    const latest = getDraft();
    const latestUpload = latest.audioUpload;
    if (
      !latestUpload ||
      latestUpload.assetId !== uploading.audioUpload?.assetId ||
      latestUpload.status === "durable"
    ) {
      return latest;
    }
    const message =
      error instanceof Error ? error.message : "Voice backup is waiting for a connection.";
    const waiting = withUploadState(
      latest,
      "audio",
      updateLocalUpload(latestUpload, {
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
  commit: DraftCommit,
  getDraft?: DraftRead
): Promise<LocalMemoryDraft> {
  let latestCommitted = draft;
  const readLatest = getDraft ?? (() => latestCommitted);
  const trackCommit: DraftCommit = async (next) => {
    latestCommitted = next;
    await commit(next);
  };
  const withPhoto = await preservePhoto(draft, trackCommit, readLatest);
  return preserveAudio(withPhoto, trackCommit, readLatest);
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
      return await syncAcceptedOriginalsOnce(current, input.commit, input.getDraft);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) break;
    }
  }

  throw lastError ?? new Error("Background backup is waiting for a connection.");
}
