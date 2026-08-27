import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as MediaDurabilityModule from "../../app/services/media-durability";

import {
  acceptLocalAudio,
  acceptLocalPhoto,
  attachLocalAudio,
  attachLocalPhoto,
  createLocalDraft,
  type DurableMediaReceipt,
  type LocalMemoryDraft,
  type LocalPhoto
} from "../../app/features/capture/local-draft";
import {
  syncAcceptedOriginalsInBackground,
  syncAcceptedOriginalsOnce
} from "../../app/services/media-background-sync";

const uploads = vi.hoisted(() => ({
  photo: vi.fn(),
  audio: vi.fn()
}));

vi.mock("../../app/services/media-durability", async (importOriginal) => {
  const actual = await importOriginal<typeof MediaDurabilityModule>();
  return {
    ...actual,
    uploadOriginalPhoto: uploads.photo,
    uploadOriginalAudio: uploads.audio
  };
});

const photoReceipt: DurableMediaReceipt = {
  assetId: "asset-photo",
  role: "original_photo",
  byteSize: 15,
  durationMs: null,
  sha256: "photo-sha",
  r2Etag: "photo-etag",
  durableAt: "2026-07-16T12:10:00.000Z",
  correlationId: "photo-correlation"
};

const audioReceipt: DurableMediaReceipt = {
  assetId: "asset-audio",
  role: "original_audio",
  byteSize: 15,
  durationMs: 1200,
  sha256: "audio-sha",
  r2Etag: "audio-etag",
  durableAt: "2026-07-16T12:11:00.000Z",
  correlationId: "audio-correlation"
};

function acceptedStory(): LocalMemoryDraft {
  const photo: LocalPhoto = {
    blob: new Blob(["synthetic-photo"], { type: "image/jpeg" }),
    mimeType: "image/jpeg",
    byteSize: 15,
    sha256: "photo-sha",
    source: "import",
    capturedAt: "2026-07-16T12:01:00.000Z",
    inspection: {
      width: 1600,
      height: 1200,
      averageLuminance: 128,
      brightPixelRatio: 0.02,
      contrast: 42,
      detailScore: 18
    },
    warning: null,
    acceptedAt: null
  };
  const withPhoto = acceptLocalPhoto(attachLocalPhoto(createLocalDraft({
    id: "local-offline-story",
    entryMode: "import",
    locale: "en-US",
    draftToken: "f".repeat(64)
  }), photo));
  const withAudio = attachLocalAudio(withPhoto, {
    blob: new Blob(["synthetic-audio"], { type: "audio/webm" }),
    mimeType: "audio/webm",
    byteSize: 15,
    sha256: "audio-sha",
    durationMs: 1200,
    capturedAt: "2026-07-16T12:05:00.000Z",
    acceptedAt: null
  });
  return acceptLocalAudio(withAudio, "2026-07-16T12:06:00.000Z");
}

function acceptedPhotoOnly(): LocalMemoryDraft {
  const story = acceptedStory();
  return {
    ...story,
    audio: null,
    audioUpload: null
  };
}

function recordedAudio() {
  return {
    blob: new Blob(["newly-recorded-audio"], { type: "audio/webm" }),
    mimeType: "audio/webm",
    byteSize: 20,
    sha256: "newly-recorded-audio-sha",
    durationMs: 900,
    capturedAt: "2026-07-16T12:07:00.000Z",
    acceptedAt: null
  };
}

describe("ordered background original sync", () => {
  beforeEach(() => {
    uploads.photo.mockReset();
    uploads.audio.mockReset();
    uploads.photo.mockImplementation(async (draft: LocalMemoryDraft) => ({
      ...photoReceipt,
      assetId: draft.photoUpload!.assetId
    }));
    uploads.audio.mockImplementation(async (draft: LocalMemoryDraft) => ({
      ...audioReceipt,
      assetId: draft.audioUpload!.assetId
    }));
  });

  it("uploads an accepted local photo before its accepted local voice", async () => {
    let current = acceptedStory();
    const result = await syncAcceptedOriginalsOnce(current, async (next) => {
      current = next;
    });

    expect(uploads.photo).toHaveBeenCalledTimes(1);
    expect(uploads.audio).toHaveBeenCalledTimes(1);
    expect(uploads.photo.mock.invocationCallOrder[0]).toBeLessThan(
      uploads.audio.mock.invocationCallOrder[0]!
    );
    expect(result.photoUpload?.status).toBe("durable");
    expect(result.audioUpload?.status).toBe("durable");
  });

  it("retries quietly, preserves stable identities, and completes later", async () => {
    let current = acceptedStory();
    const originalPhotoAsset = current.photoUpload?.assetId;
    const originalAudioAsset = current.audioUpload?.assetId;
    const waits: number[] = [];
    uploads.photo
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce(new TypeError("still offline"))
      .mockImplementationOnce(async (draft: LocalMemoryDraft) => ({
        ...photoReceipt,
        assetId: draft.photoUpload!.assetId
      }));

    const result = await syncAcceptedOriginalsInBackground({
      getDraft: () => current,
      commit: async (next) => {
        current = next;
      },
      wait: async (milliseconds) => {
        waits.push(milliseconds);
      }
    });

    expect(uploads.photo).toHaveBeenCalledTimes(3);
    expect(uploads.audio).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([1_000, 3_000]);
    expect(result.photoUpload?.assetId).toBe(originalPhotoAsset);
    expect(result.audioUpload?.assetId).toBe(originalAudioAsset);
    expect(result.audioUpload?.status).toBe("durable");
  });

  it("does not erase a recording completed while an offline photo request is settling", async () => {
    let current = acceptedPhotoOnly();
    let rejectPhoto: ((reason: unknown) => void) | undefined;
    uploads.photo.mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => { rejectPhoto = reject; })
    );

    const syncing = syncAcceptedOriginalsOnce(
      current,
      async (next) => { current = next; },
      () => current
    );
    await vi.waitFor(() => expect(rejectPhoto).toBeTypeOf("function"));

    current = attachLocalAudio(current, recordedAudio());
    rejectPhoto!(new TypeError("offline"));

    await expect(syncing).rejects.toThrow("offline");
    expect(current.photoUpload?.status).toBe("needs_connection");
    expect(current.audio?.sha256).toBe("newly-recorded-audio-sha");
    expect(current.audioUpload?.assetId).toBeTruthy();
  });

  it("ignores a response for a photograph replaced during an in-flight upload", async () => {
    let current = acceptedPhotoOnly();
    const originalAssetId = current.photoUpload?.assetId;
    let resolvePhoto: ((receipt: DurableMediaReceipt) => void) | undefined;
    uploads.photo.mockImplementationOnce(
      () => new Promise<DurableMediaReceipt>((resolve) => { resolvePhoto = resolve; })
    );

    const syncing = syncAcceptedOriginalsOnce(
      current,
      async (next) => { current = next; },
      () => current
    );
    await vi.waitFor(() => expect(resolvePhoto).toBeTypeOf("function"));

    const replacement = {
      ...current.photo!,
      sha256: "replacement-photo-sha",
      capturedAt: "2026-07-16T12:08:00.000Z",
      acceptedAt: null
    };
    current = acceptLocalPhoto(attachLocalPhoto(current, replacement));
    const replacementAssetId = current.photoUpload?.assetId;
    resolvePhoto!({ ...photoReceipt, assetId: originalAssetId! });

    await syncing;
    expect(current.photoUpload?.assetId).toBe(replacementAssetId);
    expect(current.photoUpload?.status).toBe("local");
    expect(current.photo?.sha256).toBe("replacement-photo-sha");
  });
});
