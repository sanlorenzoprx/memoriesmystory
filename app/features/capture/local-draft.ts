import type { DraftStatus } from "../../domain/memory-story";

export type CaptureEntryMode = "camera" | "import";

export type PhotoQualityKind =
  | "resolution"
  | "glare"
  | "shadow"
  | "focus";

export type PhotoQualityWarning = {
  readonly kind: PhotoQualityKind;
  readonly message: string;
};

export type PhotoInspection = {
  readonly width: number;
  readonly height: number;
  readonly averageLuminance: number;
  readonly brightPixelRatio: number;
  readonly contrast: number;
  readonly detailScore: number;
};

export type LocalPhoto = {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly source: CaptureEntryMode;
  readonly capturedAt: string;
  readonly inspection: PhotoInspection;
  readonly warning: PhotoQualityWarning | null;
  readonly acceptedAt: string | null;
};

export type DurableMediaReceipt = {
  readonly assetId: string;
  readonly role: "original_photo" | "original_audio";
  readonly byteSize: number;
  readonly durationMs: number | null;
  readonly sha256: string;
  readonly r2Etag: string;
  readonly durableAt: string;
  readonly correlationId: string;
};

export type LocalUploadState = {
  readonly assetId: string;
  readonly idempotencyKey: string;
  readonly status: "local" | "uploading" | "needs_connection" | "durable";
  readonly receipt: DurableMediaReceipt | null;
  readonly lastError: string | null;
};

export type LocalAudio = {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly durationMs: number;
  readonly capturedAt: string;
};

export type LocalMemoryDraft = {
  readonly id: string;
  readonly status: Extract<DraftStatus, "local_draft" | "photo_local">;
  readonly entryMode: CaptureEntryMode;
  readonly locale: string;
  readonly draftToken: string;
  readonly photo: LocalPhoto | null;
  readonly photoUpload: LocalUploadState | null;
  readonly audio: LocalAudio | null;
  readonly audioUpload: LocalUploadState | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: 2;
};

export function createLocalDraft(input: {
  readonly id: string;
  readonly entryMode: CaptureEntryMode;
  readonly locale: string;
  readonly draftToken: string;
  readonly now?: string;
}): LocalMemoryDraft {
  const now = input.now ?? new Date().toISOString();

  return {
    id: input.id,
    status: "local_draft",
    entryMode: input.entryMode,
    locale: input.locale,
    draftToken: input.draftToken,
    photo: null,
    photoUpload: null,
    audio: null,
    audioUpload: null,
    createdAt: now,
    updatedAt: now,
    version: 2
  };
}

export function attachLocalPhoto(
  draft: LocalMemoryDraft,
  photo: LocalPhoto,
  now = new Date().toISOString()
): LocalMemoryDraft {
  return {
    ...draft,
    status: "photo_local",
    photo,
    photoUpload: createLocalUploadState(),
    audio: null,
    audioUpload: null,
    updatedAt: now
  };
}

export function createLocalUploadState(): LocalUploadState {
  return {
    assetId: `asset_${crypto.randomUUID()}`,
    idempotencyKey: `upload_${crypto.randomUUID()}`,
    status: "local",
    receipt: null,
    lastError: null
  };
}

export function updateLocalUpload(
  upload: LocalUploadState,
  update: Pick<LocalUploadState, "status"> &
    Partial<Pick<LocalUploadState, "receipt" | "lastError">>
): LocalUploadState {
  return {
    ...upload,
    status: update.status,
    receipt: update.receipt === undefined ? upload.receipt : update.receipt,
    lastError: update.lastError === undefined ? upload.lastError : update.lastError
  };
}

export function attachLocalAudio(
  draft: LocalMemoryDraft,
  audio: LocalAudio,
  now = new Date().toISOString()
): LocalMemoryDraft {
  if (!draft.photoUpload?.receipt) {
    throw new Error("The photograph must be durable before recording is accepted.");
  }

  return {
    ...draft,
    audio,
    audioUpload: createLocalUploadState(),
    updatedAt: now
  };
}

export function acceptLocalPhoto(
  draft: LocalMemoryDraft,
  now = new Date().toISOString()
): LocalMemoryDraft {
  if (!draft.photo) {
    throw new Error("A photograph must be present before it can be accepted.");
  }

  return {
    ...draft,
    photo: {
      ...draft.photo,
      acceptedAt: now
    },
    updatedAt: now
  };
}

export function assessPhotoQuality(
  inspection: PhotoInspection
): PhotoQualityWarning | null {
  const shortestEdge = Math.min(inspection.width, inspection.height);

  if (shortestEdge < 720) {
    return {
      kind: "resolution",
      message: "Move a little closer so the photograph fills more of the frame."
    };
  }

  if (inspection.brightPixelRatio > 0.18 || inspection.averageLuminance > 225) {
    return {
      kind: "glare",
      message: "Tilt the phone slightly to move the bright glare off the photograph."
    };
  }

  if (inspection.averageLuminance < 48 || inspection.contrast < 18) {
    return {
      kind: "shadow",
      message: "Move toward soft, even light so faces are easier to see."
    };
  }

  if (inspection.detailScore < 7) {
    return {
      kind: "focus",
      message: "Hold still for a moment and tap the photograph to help it look clear."
    };
  }

  return null;
}
