import { realtimeKitRequest, type RealtimeKitEnv } from "./realtimekit";
export type ProviderRecording = {
  id: string;
  meeting_id?: string;
  status:
    | "INVOKED"
    | "RECORDING"
    | "PAUSED"
    | "UPLOADING"
    | "UPLOADED"
    | "ERRORED";
  download_url?: unknown;
  output_file_name?: string;
};
export type RecordingParticipant = { id: string; providerId: string };
export type ProviderSource = {
  kind: "composite_video" | "participant_audio";
  participantId: string | null;
  providerRecordingId: string;
  filename: string;
  contentType: "video/mp4" | "audio/webm";
  downloadUrl: string;
};
const validId = /^[A-Za-z0-9_-]{8,128}$/;
export const recordingSegment = (id: string) => {
  if (!validId.test(id)) throw new Error("recording_provider_identity_invalid");
  return encodeURIComponent(id);
};
export const recordingFilePrefix = (id: string) =>
  `memoriesmystory_${id.slice(-24)}`;
export async function readProviderRecording(
  env: RealtimeKitEnv,
  id: string,
): Promise<ProviderRecording> {
  const data = await realtimeKitRequest<
    ProviderRecording | { recording: ProviderRecording }
  >(env, `/recordings/${recordingSegment(id)}`);
  const record = "recording" in data ? data.recording : data;
  if (record.id !== id) throw new Error("recording_provider_identity_invalid");
  return record;
}
export async function startProviderRecording(
  env: RealtimeKitEnv,
  input: {
    meetingId: string;
    recordingId: string;
    kind: "track" | "composite";
    maxSeconds: number;
  },
): Promise<string> {
  const data = await realtimeKitRequest<{
    id?: string;
    recording?: { id: string };
  }>(env, `/recordings${input.kind === "track" ? "/track" : ""}`, "POST", {
    meeting_id: input.meetingId,
    ...(input.kind === "track"
      ? {
          layers: {
            default: {
              media_kind: "audio",
              file_name_prefix: recordingFilePrefix(input.recordingId),
            },
          },
        }
      : {
          allow_multiple_recordings: true,
          max_seconds: input.maxSeconds,
          video_config: { codec: "H264", width: 640, height: 480 },
          file_name_prefix: recordingFilePrefix(input.recordingId),
        }),
  });
  const id = data.recording?.id ?? data.id;
  if (!id || !validId.test(id))
    throw new Error("recording_provider_identity_invalid");
  return id;
}
export async function stopProviderRecording(env: RealtimeKitEnv, id: string) {
  const record = await readProviderRecording(env, id);
  if (["INVOKED", "RECORDING", "PAUSED"].includes(record.status)) {
    await realtimeKitRequest(
      env,
      `/recordings/${recordingSegment(id)}`,
      "PUT",
      { action: "stop" },
    );
    return false;
  }
  if (!["UPLOADING", "UPLOADED", "ERRORED"].includes(record.status))
    throw new Error("recording_state_unconfirmed");
  return true;
}
export function providerSources(
  composite: ProviderRecording | null,
  track: ProviderRecording | null,
  participants: RecordingParticipant[],
  allowPartial = false,
): ProviderSource[] {
  if (
    !allowPartial &&
    (composite?.status !== "UPLOADED" || track?.status !== "UPLOADED")
  )
    throw new Error("recording_not_uploaded");
  const result: ProviderSource[] = [];
  if (composite?.status === "UPLOADED") {
    if (typeof composite.download_url !== "string")
      throw new Error("recording_output_missing");
    result.push({
      kind: "composite_video",
      participantId: null,
      providerRecordingId: composite.id,
      filename:
        typeof composite.output_file_name === "string"
          ? composite.output_file_name
          : `${composite.id}.mp4`,
      contentType: "video/mp4",
      downloadUrl: composite.download_url,
    });
  }
  if (track?.status !== "UPLOADED") {
    if (allowPartial) return result;
    throw new Error("recording_not_uploaded");
  }
  let layers = track.download_url;
  if (layers && !Array.isArray(layers) && typeof layers === "object") {
    const candidates = Object.values(layers).filter(Array.isArray);
    if (candidates.length !== 1)
      throw new Error("recording_track_manifest_invalid");
    layers = candidates[0];
  }
  if (!Array.isArray(layers))
    throw new Error("recording_track_manifest_invalid");
  for (const layer of layers) {
    if (
      !layer ||
      typeof layer !== "object" ||
      !layer.download_urls ||
      typeof layer.download_urls !== "object"
    )
      throw new Error("recording_track_manifest_invalid");
    for (const [filename, raw] of Object.entries(layer.download_urls)) {
      const file = raw as { download_url?: unknown } | null;
      const owners = participants.filter((person) =>
        filename.includes(`_${person.providerId}_`),
      );
      if (
        owners.length !== 1 ||
        !filename.endsWith(".webm") ||
        typeof file?.download_url !== "string"
      )
        throw new Error("recording_attribution_unconfirmed");
      result.push({
        kind: "participant_audio",
        participantId: owners[0]!.id,
        providerRecordingId: track.id,
        filename,
        contentType: "audio/webm",
        downloadUrl: file.download_url,
      });
    }
  }
  if (
    result.length > 100 ||
    (!allowPartial &&
      !participants.every((person) =>
        result.some((source) => source.participantId === person.id),
      ))
  )
    throw new Error("recording_participant_missing");
  return result;
}
export function recordingDownloadUrl(value: string): string {
  const url = new URL(value);
  const domains = [
    "cloudflarestorage.com",
    "cloudflare.com",
    "amazonaws.com",
    "dyte.io",
    "realtimekit.com",
  ];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !domains.some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  )
    throw new Error("recording_download_origin_invalid");
  return url.href;
}
