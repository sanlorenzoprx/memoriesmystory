import { phase1Config } from "../../config/phase-1";
import type { PhotoAcquisition } from "../features/capture/local-draft";

// Keep the optional browser API behind a small capability boundary.
type StillCapabilities = { imageWidth?: { max?: number }; imageHeight?: { max?: number } };
type StillCamera = {
  getPhotoCapabilities?: () => Promise<StillCapabilities>;
  takePhoto: (settings?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>;
};
type ImageCaptureConstructor = new (track: MediaStreamTrack) => StillCamera;

export function validatePhotoBlob(blob: Blob): void {
  if (!blob.size) throw new Error("The photograph was not captured. Please try again.");
  if (!(phase1Config.media.supportedImageMimeTypes as readonly string[]).includes(blob.type)) {
    throw new Error("Choose a JPEG, PNG, WebP, HEIC, or HEIF photograph.");
  }
  if (blob.size > phase1Config.media.maxImageBytes) {
    throw new Error("That photograph is too large. Choose one smaller than 25 MB.");
  }
}

async function photoFromVideo(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("The camera is still getting ready. Please try once more.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not capture the photograph.");
  context.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("The photograph was not captured. Please try again."));
  }, "image/jpeg", phase1Config.capture.videoJpegQuality));
}

// A timed-out device operation may finish late; its blob is never committed by this service.
async function bounded<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  let onAbort: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      onAbort = () => reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => reject(new Error("Still capture timed out")), phase1Config.capture.stillRequestTimeoutMs);
    })]);
  } finally { clearTimeout(timer); if (onAbort) signal?.removeEventListener("abort", onAbort); }
}

export async function captureStillPhoto(video: HTMLVideoElement, stream: MediaStream, signal?: AbortSignal): Promise<{
  readonly blob: Blob;
  readonly acquisition: PhotoAcquisition;
}> {
  signal?.throwIfAborted();
  const track = stream.getVideoTracks()[0];
  const Constructor = (globalThis as unknown as { ImageCapture?: ImageCaptureConstructor }).ImageCapture;
  let still: Blob | null = null;
  if (track?.readyState === "live" && Constructor) {
    try {
      const camera = new Constructor(track);
      // Capability discovery can fail even when default takePhoto works.
      let capabilities: StillCapabilities | undefined;
      try { capabilities = await bounded(camera.getPhotoCapabilities?.() ?? Promise.resolve({}), signal); } catch { /* Try the default still. */ }
      signal?.throwIfAborted();
      const width = capabilities?.imageWidth?.max;
      const height = capabilities?.imageHeight?.max;
      const settings = {
        ...(Number.isFinite(width) && width! > 0 ? { imageWidth: width } : {}),
        ...(Number.isFinite(height) && height! > 0 ? { imageHeight: height } : {})
      };
      try { still = await bounded(camera.takePhoto(settings), signal); }
      catch { signal?.throwIfAborted(); still = await bounded(camera.takePhoto(), signal); }
    } catch { /* Explicitly labeled video-frame fallback below. */ }
  }
  signal?.throwIfAborted();
  if (still) {
    // Never shrink or replace an obtained full-size still just to fit a limit.
    validatePhotoBlob(still);
    return { blob: still, acquisition: "image_capture" };
  }
  const blob = await photoFromVideo(video);
  signal?.throwIfAborted();
  validatePhotoBlob(blob);
  return { blob, acquisition: "video_frame" };
}
