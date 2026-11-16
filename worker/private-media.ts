/**
 * Shared response for private originals: full or single-range reads with
 * consistent Content-Length and Content-Range.
 *
 * A request is treated as ranged only when its Range header is one well-formed
 * byte range, and answered with 206 when that range is satisfiable — including
 * a range that happens to cover the whole file, which some players (Safari)
 * send and expect 206 for. A malformed, multi-part or unsatisfiable range is
 * answered with the whole file and 200 (the server may ignore Range), never with
 * a 206 that claims a range the client did not ask for.
 */
const singleByteRange = /^bytes=(?:\d+-\d*|-\d+)$/;

export function wantsRange(request: Request): boolean {
  return singleByteRange.test((request.headers.get("Range") ?? "").trim());
}

export async function getPrivateObject(
  bucket: R2Bucket,
  key: string,
  request: Request,
): Promise<{ object: R2ObjectBody | null; ranged: string | null }> {
  const ranged = wantsRange(request)
    ? (request.headers.get("Range") ?? "").trim()
    : null;
  return {
    object: ranged
      ? await bucket.get(key, { range: request.headers })
      : await bucket.get(key),
    ranged,
  };
}

/** Whether a single byte range can be served from a file of this size. */
export function satisfiable(range: string, totalBytes: number): boolean {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || totalBytes <= 0) return false;
  const [, start, end] = match;
  if (start === "") return end !== "" && Number(end) > 0;
  return (
    Number(start) < totalBytes && (end === "" || Number(end) >= Number(start))
  );
}

export function privateMediaResponse(
  object: R2ObjectBody,
  ranged: string | null,
  totalBytes: number,
  headersInit: HeadersInit,
): Response {
  const headers = new Headers(headersInit);
  headers.set("Accept-Ranges", "bytes");
  const range = object.range;
  if (
    ranged &&
    satisfiable(ranged, totalBytes) &&
    range &&
    "offset" in range &&
    typeof range.offset === "number"
  ) {
    const length = range.length ?? totalBytes - range.offset;
    headers.set("Content-Length", String(length));
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + length - 1}/${totalBytes}`,
    );
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(totalBytes));
  return new Response(object.body, { status: 200, headers });
}

/** The Cloudflare Images binding, narrowed to what a viewing copy needs. */
export type ViewingImagesBinding = {
  input(stream: ReadableStream<Uint8Array>): {
    output(options: { format: "image/jpeg"; quality?: number }): Promise<{ response(): Response }>;
  };
};

const viewingInputLimit = 20 * 1024 * 1024;

/**
 * A display-only JPEG of a HEIC or HEIF original (lane L1.4). Most browsers
 * cannot show HEIC. The original's bytes and record never change; the copy is
 * made on request, labelled with the original's id and hash, and never
 * claims to be the original. Returns null when no copy applies or can be made,
 * so the caller serves the original exactly as before.
 */
export async function viewingCopyResponse(
  request: Request,
  bucket: R2Bucket,
  images: ViewingImagesBinding | undefined,
  original: { id: string; r2_key: string; content_type: string; byte_size: number; sha256: string },
): Promise<Response | null> {
  if (new URL(request.url).searchParams.get("display") !== "jpeg") return null;
  if (!images || !/^image\/hei[cf]$/.test(original.content_type) || original.byte_size > viewingInputLimit) return null;
  try {
    const object = await bucket.get(original.r2_key);
    if (!object) return null;
    const converted = (await images.input(object.body).output({ format: "image/jpeg", quality: 90 })).response();
    if (!converted.ok || !converted.body) return null;
    return new Response(converted.body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Viewing-Copy-Of": original.id,
        "X-Source-SHA256": original.sha256,
      },
    });
  } catch {
    return null;
  }
}
