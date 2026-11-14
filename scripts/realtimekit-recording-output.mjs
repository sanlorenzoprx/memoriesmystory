import { createHash } from "node:crypto";

/** Provider download metadata stays private; return only explicitly mapped originals. */
export function recordingOutputs(composite, track, participants) {
  if (composite?.status !== "UPLOADED" || track?.status !== "UPLOADED") throw new Error("outputs_not_uploaded");
  if (typeof composite.download_url !== "string") throw new Error("composite_output_missing");
  const output = [{ kind: "composite_video", url: composite.download_url }];
  let layers = track.download_url;
  // Observed live API: one opaque wrapper field contains the layer array.
  // Do not infer a participant from wrapper names or accept ambiguous lists.
  if (layers && !Array.isArray(layers) && typeof layers === "object") {
    const candidates = Object.values(layers).filter(Array.isArray);
    if (candidates.length !== 1) throw new Error("track_manifest_missing");
    layers = candidates[0];
  }
  if (!Array.isArray(layers)) throw new Error("track_manifest_missing");
  for (const layer of layers) {
    for (const [filename, value] of Object.entries(layer.download_urls ?? {})) {
      if (!filename.endsWith(".webm") || typeof value?.download_url !== "string") throw new Error("invalid_track_output");
      const owners = participants.filter(p => filename.includes(`_${p.participantId}_`));
      if (owners.length !== 1) throw new Error("track_attribution_unconfirmed");
      output.push({ kind: "participant_audio", participantId: owners[0].participantId, role: owners[0].role, url: value.download_url });
    }
  }
  if (!participants.every(p => output.some(asset => asset.participantId === p.participantId))) throw new Error("participant_output_missing");
  return output;
}
export function validateRecordingDownload(value) {
  const url = new URL(value);
  const domains = ["cloudflarestorage.com", "cloudflare.com", "amazonaws.com", "dyte.io", "realtimekit.com"];
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error("unapproved_download_origin");
  return url;
}
export async function downloadRecordingBytes(value, fetcher = globalThis.fetch, limit = 64 * 1024 * 1024) {
  const url = validateRecordingDownload(value);
  const response = await fetcher(url.href, { redirect: "error", signal: globalThis.AbortSignal.timeout(60000) });
  if (!response.ok || !response.body || Number(response.headers.get("Content-Length")) > limit) throw new Error("download_failed");
  const reader = response.body.getReader(), chunks = [], hash = createHash("sha256");
  let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length;
      if (length > limit) { await reader.cancel().catch(() => {}); throw new Error("download_too_large"); }
      hash.update(part.value);chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  if (!length) throw new Error("empty_output");
  const bytes = new Uint8Array(length);let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset);offset += chunk.length; }
  return { bytes, sha256: hash.digest("hex") };
}
