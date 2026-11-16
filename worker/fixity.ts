/**
 * Scheduled integrity (fixity) checks (A5, lane L3).
 *
 * Each pass re-hashes the stored files whose last check is oldest (never-checked
 * files first) and records one append-only result per file: match, mismatch or
 * missing. It never repairs, rewrites or deletes an object. A mismatch or
 * missing object is logged for operators with ids only, never content.
 */
export interface FixityEnv {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
}

export const fixityLimits = {
  /** Files re-hashed in one scheduled pass. */
  filesPerPass: 100,
  /** Stop starting new files once this many bytes were read in one pass. */
  bytesPerPass: 2 * 1024 * 1024 * 1024,
} as const;

type StoredFile = {
  kind: string;
  id: string;
  r2_key: string;
  sha256: string;
  byte_size: number;
};

/** Every stored object that carries a hash recorded when it was preserved. */
const storedFiles = `
SELECT 'asset' AS kind,id,r2_key,sha256,byte_size FROM media_assets WHERE durability_status='durable'
UNION ALL SELECT 'voice-reply',id,r2_key,sha256,byte_size FROM muse_voice_reply_assets WHERE durability_status='durable'
UNION ALL SELECT 'contribution-voice',id,r2_key,sha256,byte_size FROM family_contribution_voice_sources
UNION ALL SELECT 'contribution-photo',id,r2_key,sha256,byte_size FROM family_contribution_photo_sources
UNION ALL SELECT 'session-recording',recording_id,r2_key,sha256,byte_size FROM legacy_recording_media WHERE durability_status='durable'
UNION ALL SELECT 'session-source',id,r2_key,sha256,byte_size FROM legacy_remote_sources WHERE durability_status='durable'`;

async function hashObject(
  object: R2ObjectBody,
): Promise<{ sha256: string; byteSize: number }> {
  const hex = (buffer: ArrayBuffer) =>
    [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const Digest = (crypto as unknown as { DigestStream?: new (algorithm: string) => WritableStream<Uint8Array> & { digest: Promise<ArrayBuffer> } }).DigestStream;
  if (Digest && object.body) {
    // Streams the object, so memory use does not grow with a long recording.
    const stream = new Digest("SHA-256");
    let byteSize = 0;
    await object.body
      .pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            byteSize += chunk.byteLength;
            controller.enqueue(chunk);
          },
        }),
      )
      .pipeTo(stream);
    return { sha256: hex(await stream.digest), byteSize };
  }
  const bytes = await object.arrayBuffer();
  return { sha256: hex(await crypto.subtle.digest("SHA-256", bytes)), byteSize: bytes.byteLength };
}

export type FixityPassResult = {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
};

export async function runFixityPass(
  env: FixityEnv,
  options: { filesPerPass?: number; bytesPerPass?: number; now?: () => string } = {},
): Promise<FixityPassResult> {
  const filesPerPass = options.filesPerPass ?? fixityLimits.filesPerPass,
    bytesPerPass = options.bytesPerPass ?? fixityLimits.bytesPerPass,
    now = options.now ?? (() => new Date().toISOString());
  const { results } = await env.DB.prepare(
    `SELECT f.kind,f.id,f.r2_key,f.sha256,f.byte_size FROM (${storedFiles}) f
     LEFT JOIN (SELECT source_kind,source_id,max(checked_at) AS last FROM fixity_checks GROUP BY source_kind,source_id) c
       ON c.source_kind=f.kind AND c.source_id=f.id
     ORDER BY c.last IS NOT NULL, c.last, f.kind, f.id LIMIT ?1`,
  )
    .bind(filesPerPass)
    .all<StoredFile>();
  const result: FixityPassResult = { checked: 0, matched: 0, mismatched: 0, missing: 0 };
  let bytesRead = 0;
  for (const file of results) {
    if (bytesRead >= bytesPerPass) break;
    let outcome: "match" | "mismatch" | "missing",
      observed: { sha256: string; byteSize: number } | null = null;
    const object = await env.MEDIA_BUCKET.get(file.r2_key);
    if (!object) outcome = "missing";
    else {
      observed = await hashObject(object);
      bytesRead += observed.byteSize;
      outcome =
        observed.sha256 === file.sha256 && observed.byteSize === file.byte_size
          ? "match"
          : "mismatch";
    }
    await env.DB.prepare(
      "INSERT INTO fixity_checks(id,source_kind,source_id,outcome,expected_sha256,observed_sha256,observed_byte_size,checked_at) VALUES(?,?,?,?,?,?,?,?)",
    )
      .bind(
        `fixity_${crypto.randomUUID()}`,
        file.kind,
        file.id,
        outcome,
        file.sha256,
        observed?.sha256 ?? null,
        observed?.byteSize ?? null,
        now(),
      )
      .run();
    result.checked++;
    if (outcome === "match") result.matched++;
    else {
      if (outcome === "mismatch") result.mismatched++;
      else result.missing++;
      // Ids only: an operator can find the object; no family content is logged.
      console.error("Stored file failed its integrity check", {
        kind: file.kind,
        id: file.id,
        outcome,
      });
    }
  }
  return result;
}
