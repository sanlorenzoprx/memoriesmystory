/** Storage verification only. A caller must still commit its authorized D1 source receipt. */
export type VerifiedSourceStorage = {
  r2Key: string;
  sha256: string;
  byteSize: number;
  contentType: "audio/webm" | "video/webm" | "video/mp4";
  etag: string;
};
type SourceStorageOptions = {
  sessionId: string;
  sourceId: string;
  contentType: VerifiedSourceStorage["contentType"];
  maximumBytes: number;
  expectedSha256?: string;
  assertAuthorized: () => Promise<void>;
};
type DigestSink = WritableStream<Uint8Array> & {
  readonly digest: Promise<ArrayBuffer>;
};
function streamingDigest(): DigestSink {
  const runtime = crypto as typeof crypto & {
    DigestStream?: new (algorithm: string) => DigestSink;
  };
  if (!runtime.DigestStream)
    throw new Error("source_streaming_digest_unavailable");
  return new runtime.DigestStream("SHA-256");
}
const identifier = /^[A-Za-z0-9_-]{8,128}$/;
const partBytes = 8 * 1024 * 1024;
const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
function validSignature(prefix: Uint8Array, length: number, type: string) {
  if (length < 12) return false;
  if (type === "video/mp4")
    return (
      prefix[4] === 0x66 &&
      prefix[5] === 0x74 &&
      prefix[6] === 0x79 &&
      prefix[7] === 0x70
    );
  return (
    prefix[0] === 0x1a &&
    prefix[1] === 0x45 &&
    prefix[2] === 0xdf &&
    prefix[3] === 0xa3
  );
}
async function hashStoredSource(
  body: ReadableStream<Uint8Array>,
  maximum: number,
) {
  const digest = streamingDigest(),
    writer = digest.getWriter(),
    reader = body.getReader();
  // Aborting DigestStream rejects its digest promise; always observe that rejection.
  const hash = digest.digest;
  void hash.catch(() => {});
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximum) throw new Error("source_readback_size_mismatch");
      await writer.write(part.value);
    }
    await writer.close();
    return { sha256: hex(await hash), size: total };
  } catch (error) {
    await Promise.allSettled([reader.cancel(), writer.abort(error)]);
    throw error;
  } finally {
    reader.releaseLock();
    writer.releaseLock();
  }
}

/** Stream immutable originals with bounded buffers, then independently hash their R2 read-back. */
export async function storeOriginalSource(
  bucket: R2Bucket,
  body: ReadableStream<Uint8Array>,
  options: SourceStorageOptions,
): Promise<VerifiedSourceStorage> {
  if (
    !identifier.test(options.sessionId) ||
    !identifier.test(options.sourceId) ||
    !Number.isSafeInteger(options.maximumBytes) ||
    options.maximumBytes < 12 ||
    !["audio/webm", "video/webm", "video/mp4"].includes(options.contentType) ||
    (options.expectedSha256 !== undefined &&
      !/^[a-f0-9]{64}$/.test(options.expectedSha256))
  )
    throw new Error("source_storage_invalid");
  if (body.locked) throw new Error("source_stream_in_use");
  let digest: DigestSink;
  try {
    digest = streamingDigest();
  } catch (error) {
    await body.cancel().catch(() => {});
    throw error;
  }
  const writer = digest.getWriter(),
    hash = digest.digest;
  void hash.catch(() => {});
  // Each attempt has an internally generated key. Retries cannot overwrite earlier originals.
  const r2Key = `legacy/${options.sessionId}/sources/${options.sourceId}/${crypto.randomUUID()}/original`;
  let upload: R2MultipartUpload;
  try {
    await options.assertAuthorized();
    upload = await bucket.createMultipartUpload(r2Key, {
      httpMetadata: {
        contentType: options.contentType,
        cacheControl: "private, no-store",
      },
      customMetadata: {
        sessionId: options.sessionId,
        sourceId: options.sourceId,
      },
    });
  } catch (error) {
    await Promise.allSettled([body.cancel(), writer.abort(error)]);
    writer.releaseLock();
    throw error;
  }
  const reader = body.getReader(),
    parts: R2UploadedPart[] = [];
  const buffer = new Uint8Array(partBytes),
    prefix = new Uint8Array(16);
  let used = 0,
    size = 0,
    prefixSize = 0,
    completed = false,
    digestClosed = false;
  async function flush() {
    if (!used) return;
    await options.assertAuthorized();
    parts.push(
      await upload.uploadPart(parts.length + 1, buffer.subarray(0, used)),
    );
    used = 0;
  }
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const value = part.value;
      size += value.byteLength;
      if (size > options.maximumBytes) throw new Error("source_too_large");
      if (prefixSize < prefix.length) {
        const n = Math.min(prefix.length - prefixSize, value.length);
        prefix.set(value.subarray(0, n), prefixSize);
        prefixSize += n;
      }
      if (
        prefixSize >= 12 &&
        !validSignature(prefix, prefixSize, options.contentType)
      )
        throw new Error("source_signature_invalid");
      await writer.write(value);
      for (let offset = 0; offset < value.length; ) {
        const n = Math.min(partBytes - used, value.length - offset);
        buffer.set(value.subarray(offset, offset + n), used);
        used += n;
        offset += n;
        if (used === partBytes) await flush();
      }
    }
    if (!validSignature(prefix, prefixSize, options.contentType))
      throw new Error("source_signature_invalid");
    await flush();
    await writer.close();
    digestClosed = true;
    const sha256 = hex(await hash);
    if (options.expectedSha256 && options.expectedSha256 !== sha256)
      throw new Error("source_checksum_mismatch");
    await options.assertAuthorized();
    const stored = await upload.complete(parts);
    completed = true;
    const head = await bucket.head(r2Key);
    if (!head || head.size !== size || head.etag !== stored.etag)
      throw new Error("source_storage_unconfirmed");
    const object = await bucket.get(r2Key);
    if (!object) throw new Error("source_readback_missing");
    const readback = await hashStoredSource(object.body, size);
    if (readback.size !== size || readback.sha256 !== sha256)
      throw new Error("source_readback_checksum_mismatch");
    await options.assertAuthorized();
    return {
      r2Key,
      sha256,
      byteSize: size,
      contentType: options.contentType,
      etag: head.etag,
    };
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (!digestClosed) await writer.abort(error).catch(() => {});
    if (!completed) await upload.abort().catch(() => {});
    // A completed but unconfirmed object is quarantined by its unreferenced attempt key.
    // Never delete or replace an earlier original to make a retry appear successful.
    throw error;
  } finally {
    reader.releaseLock();
    writer.releaseLock();
  }
}
