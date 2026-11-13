export class RequestBodyTooLarge extends Error {}

/** Bound JSON/text requests by actual bytes, including chunked bodies without Content-Length. */
export async function readBoundedText(request: Request, maximumBytes: number): Promise<string> {
  if (Number(request.headers.get("Content-Length")) > maximumBytes) throw new RequestBodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      total += chunk.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLarge();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}
