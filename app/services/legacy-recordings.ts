import type {
  LegacyRecordingReceipt,
  LegacyRecording,
} from "../domain/our-living-legacy";
import type { LocalLegacyTake } from "./legacy-recording-store";
import { legacyPath, legacyRequest, LegacyApiError } from "./legacy-api";
import { apiMessageKey } from "../localization/errors";
export const loadLegacyRecordings = (sessionId: string, guest = false) =>
  legacyRequest<{ recordings: LegacyRecording[] }>(
    legacyPath(sessionId, guest, "/recordings"),
  );
export async function preserveLegacyRecording(
  take: LocalLegacyTake,
  blob: Blob,
): Promise<LegacyRecordingReceipt> {
  const digest = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const response = await fetch(
    legacyPath(take.sessionId, false, `/recordings/${take.id}`),
    {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "X-Memories-Request": "legacy-v1",
        "Content-Type": blob.type,
        "X-Content-SHA256": digest,
        "X-Audio-Duration-MS": String(take.durationMs),
        "X-Recording-Interrupted": take.interrupted ? "1" : "0",
      },
      body: blob,
    },
  );
  const value = (await response.json()) as LegacyRecordingReceipt & {
    error?: { code?: string };
  };
  if (!response.ok)
    throw new LegacyApiError(
      apiMessageKey(
        value.error?.code,
        "This recording's backup was not confirmed. Keep your device copy and try again.",
      ),
      response.status,
      value.error?.code ?? "legacy_recording_pending",
    );
  if (
    value.status !== "durable" ||
    value.sha256 !== digest ||
    value.byteSize !== blob.size ||
    value.recordingId !== take.id
  )
    throw new Error(
      "This recording's backup was not confirmed. Keep your device copy and try again.",
    );
  return value;
}
