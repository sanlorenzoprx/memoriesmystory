import { describe, expect, it } from "vitest";

import {
  acceptLocalPhoto,
  assessPhotoQuality,
  attachLocalAudio,
  attachLocalPhoto,
  createLocalDraft,
  type LocalPhoto,
  type PhotoInspection
} from "../../app/features/capture/local-draft";

const healthyInspection: PhotoInspection = {
  width: 1600,
  height: 1200,
  averageLuminance: 128,
  brightPixelRatio: 0.02,
  contrast: 42,
  detailScore: 18
};

function localPhoto(overrides: Partial<LocalPhoto> = {}): LocalPhoto {
  return {
    blob: new Blob(["synthetic-photo"], { type: "image/jpeg" }),
    mimeType: "image/jpeg",
    byteSize: 15,
    sha256: "abc123",
    source: "import",
    capturedAt: "2026-07-16T12:01:00.000Z",
    inspection: healthyInspection,
    warning: null,
    acceptedAt: null,
    ...overrides
  };
}

describe("local-first photograph contract", () => {
  it("moves a recoverable draft to photo_local without claiming durability", () => {
    const draft = createLocalDraft({
      id: "local-draft-1",
      entryMode: "import",
      locale: "en-US",
      draftToken: "a".repeat(64),
      now: "2026-07-16T12:00:00.000Z"
    });
    const withPhoto = attachLocalPhoto(
      draft,
      localPhoto(),
      "2026-07-16T12:02:00.000Z"
    );

    expect(withPhoto.status).toBe("photo_local");
    expect(withPhoto.photo?.blob).toBeInstanceOf(Blob);
    expect(withPhoto.photo?.sha256).toBe("abc123");
    expect(withPhoto.photo?.acceptedAt).toBeNull();
  });

  it("records manual acceptance without replacing the local original", () => {
    const photo = localPhoto({
      warning: {
        kind: "glare",
        message: "Tilt the phone slightly."
      }
    });
    const draft = attachLocalPhoto(
      createLocalDraft({
        id: "local-draft-2",
        entryMode: "camera",
        locale: "es-PR",
        draftToken: "b".repeat(64)
      }),
      photo
    );
    const accepted = acceptLocalPhoto(draft, "2026-07-16T12:03:00.000Z");

    expect(accepted.photo?.acceptedAt).toBe("2026-07-16T12:03:00.000Z");
    expect(accepted.photo?.blob).toBe(photo.blob);
    expect(accepted.photo?.warning?.kind).toBe("glare");
    expect(accepted.photoUpload?.assetId).toBe(draft.photoUpload?.assetId);
  });

  it("rejects acceptance when no photograph exists", () => {
    const draft = createLocalDraft({
      id: "local-draft-3",
      entryMode: "camera",
      locale: "en-US",
      draftToken: "c".repeat(64)
    });

    expect(() => acceptLocalPhoto(draft)).toThrow(/must be present/i);
  });

  it.each([
    [
      "resolution",
      { ...healthyInspection, width: 600, height: 450 },
      /closer/i
    ],
    [
      "glare",
      { ...healthyInspection, brightPixelRatio: 0.3 },
      /glare/i
    ],
    [
      "shadow",
      { ...healthyInspection, averageLuminance: 35 },
      /light/i
    ],
    [
      "focus",
      { ...healthyInspection, detailScore: 3 },
      /hold still/i
    ]
  ] as const)("offers one %s correction at a time", (kind, inspection, copy) => {
    const warning = assessPhotoQuality(inspection);

    expect(warning?.kind).toBe(kind);
    expect(warning?.message).toMatch(copy);
  });

  it("does not invent a warning when the lightweight checks are healthy", () => {
    expect(assessPhotoQuality(healthyInspection)).toBeNull();
  });

  it("creates a new immutable identity for voice only after the photo receipt", () => {
    const withPhoto = attachLocalPhoto(
      createLocalDraft({
        id: "local-draft-voice",
        entryMode: "import",
        locale: "en-US",
        draftToken: "d".repeat(64)
      }),
      localPhoto()
    );
    const durablePhoto = {
      ...withPhoto,
      photoUpload: {
        ...withPhoto.photoUpload!,
        status: "durable" as const,
        receipt: {
          assetId: withPhoto.photoUpload!.assetId,
          role: "original_photo" as const,
          byteSize: 15,
          durationMs: null,
          sha256: "abc123",
          r2Etag: "etag-photo",
          durableAt: "2026-07-16T12:04:00.000Z",
          correlationId: "cor-photo"
        }
      }
    };
    const withAudio = attachLocalAudio(durablePhoto, {
      blob: new Blob(["synthetic-audio"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      byteSize: 15,
      sha256: "def456",
      durationMs: 1200,
      capturedAt: "2026-07-16T12:05:00.000Z"
    });

    expect(withAudio.audioUpload?.assetId).toMatch(/^asset_/);
    expect(withAudio.audioUpload?.idempotencyKey).toMatch(/^upload_/);
    expect(withAudio.audioUpload?.status).toBe("local");
    expect(withAudio.photoUpload?.receipt?.r2Etag).toBe("etag-photo");
  });
});
