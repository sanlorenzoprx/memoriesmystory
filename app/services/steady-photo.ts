import { phase1Config } from "../../config/phase-1";
import { captureStillPhoto } from "./still-photo-capture";
import { inspectLocalPhoto } from "./photo-inspection";
import type { LocalPhoto } from "../features/capture/local-draft";
export async function cameraFocusAssist(
  track: MediaStreamTrack,
): Promise<void> {
  try {
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
      focusMode?: string[];
    };
    if (capabilities?.focusMode?.includes("continuous"))
      await Promise.race([
        track.applyConstraints({
          advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 1200)),
      ]);
  } catch {
    /* Optional focus controls must not block camera access. */
  }
}
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export async function captureSteadyPhoto(
  video: HTMLVideoElement,
  stream: MediaStream,
  signal: AbortSignal,
): Promise<LocalPhoto> {
  let best: LocalPhoto | null = null,
    selectedIndex = 0,
    completed = 0;
  for (let index = 0; index < phase1Config.capture.steadyShots; index++) {
    signal.throwIfAborted();
    try {
      const shot = await captureStillPhoto(video, stream, signal);
      const photo = await inspectLocalPhoto(
        shot.blob,
        "camera",
        shot.acquisition,
      );
      signal.throwIfAborted();
      completed++;
      // Relative detail only: this does not prove optical sharpness or remove blur.
      if (!best || photo.inspection.detailScore > best.inspection.detailScore) {
        best = photo;
        selectedIndex = index;
      }
    } catch (error) {
      signal.throwIfAborted();
      if (!best) throw error;
      break;
    }
    if (index + 1 < phase1Config.capture.steadyShots)
      await abortableDelay(phase1Config.capture.steadyDelayMs, signal);
  }
  if (!best)
    throw new Error("The photograph was not captured. Please try again.");
  return {
    ...best,
    capture: {
      ...best.capture!,
      steady: { method: "best-shot-v1", candidates: completed, selectedIndex },
    },
  };
}
