import type { LocalAudio } from "../features/capture/local-draft";

const preferredRecorderTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus"
] as const;

export function preferredAudioMimeType(): string | undefined {
  return preferredRecorderTypes.find((type) => MediaRecorder.isTypeSupported(type));
}

function canonicalMimeType(value: string): string {
  return value.split(";")[0]?.toLowerCase().trim() || "audio/webm";
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createLocalAudio(
  chunks: readonly Blob[],
  recorderMimeType: string,
  durationMs: number
): Promise<LocalAudio> {
  const mimeType = canonicalMimeType(recorderMimeType);
  const blob = new Blob([...chunks], { type: mimeType });
  if (blob.size === 0) throw new Error("The recording was empty. Please try again.");

  return {
    blob,
    mimeType,
    byteSize: blob.size,
    sha256: await sha256(blob),
    durationMs,
    capturedAt: new Date().toISOString()
  };
}
