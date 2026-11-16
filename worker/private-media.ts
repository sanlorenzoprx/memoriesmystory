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
