import { phase1Config } from "../../config/phase-1";
import { preferredAudioMimeType } from "./audio-capture";
export type LegacyCapture = {
  stop: (interrupted?: boolean) => void;
  pause: () => void;
  resume: () => void;
  elapsed: () => number;
};
/** One recorder per take; reload recovery never concatenates independently encoded takes. */
export function captureLegacyAudio(
  stream: MediaStream,
  handlers: {
    chunk: (
      blob: Blob,
      index: number,
      elapsedMs: number,
      mimeType: string,
    ) => void;
    stopped: (blob: Blob, durationMs: number, interrupted: boolean) => void;
  },
): LegacyCapture {
  const type = preferredAudioMimeType(),
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined),
    chunks: Blob[] = [];
  let stopped = false,
    partial = false,
    index = 0,
    activeStart = performance.now(),
    accumulated = 0,
    paused = false,
    finalized = false;
  const elapsed = () =>
    Math.round(
      accumulated + (paused || stopped ? 0 : performance.now() - activeStart),
    );
  const release = () => stream.getTracks().forEach((track) => track.stop());
  const stop = (interrupted = false) => {
    partial = partial || interrupted;
    if (stopped) return;
    accumulated = elapsed();
    stopped = true;
    clearInterval(limit);
    if (recorder.state !== "inactive") recorder.stop();
    else queueMicrotask(finish);
  };
  const limit = setInterval(() => {
    if (elapsed() >= phase1Config.legacy.maxRecordingSeconds * 1000) stop();
  }, 200);
  recorder.ondataavailable = (event) => {
    if (event.data.size) {
      chunks.push(event.data);
      handlers.chunk(
        event.data,
        index++,
        elapsed(),
        (recorder.mimeType || event.data.type || "audio/webm").split(";")[0]!,
      );
    }
  };
  const finish = () => {
    if (finalized) return;
    finalized = true;
    accumulated = elapsed();
    stopped = true;
    clearInterval(limit);
    release();
    handlers.stopped(
      new Blob(chunks, {
        type: (recorder.mimeType || "audio/webm").split(";")[0],
      }),
      elapsed(),
      partial,
    );
  };
  recorder.onstop = finish;
  recorder.onerror = () => stop(true);
  stream.getAudioTracks().forEach((track) => {
    track.onended = () => stop(true);
  });
  try {
    recorder.start(phase1Config.legacy.recordingChunkMs);
  } catch (e) {
    clearInterval(limit);
    release();
    throw e;
  }
  return {
    elapsed,
    stop,
    pause: () => {
      if (recorder.state === "recording") {
        accumulated = elapsed();
        paused = true;
        recorder.pause();
        recorder.requestData();
      }
    },
    resume: () => {
      if (recorder.state === "paused") {
        activeStart = performance.now();
        paused = false;
        recorder.resume();
      }
    },
  };
}
