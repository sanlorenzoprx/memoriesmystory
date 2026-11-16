import { describe, expect, it } from "vitest";
import { privateMediaResponse, satisfiable, wantsRange } from "../../worker/private-media";

const body = (range?: R2Range) =>
  ({ body: new Response("0123456789").body, range, size: 10 }) as unknown as R2ObjectBody;
const request = (range?: string) =>
  new Request("https://example.test/", range ? { headers: { Range: range } } : {});

describe("private media responses", () => {
  it("treats only one well-formed byte range as a range request", () => {
    expect(wantsRange(request("bytes=0-3"))).toBe(true);
    expect(wantsRange(request("bytes=4-"))).toBe(true);
    expect(wantsRange(request("bytes=-3"))).toBe(true);
    for (const value of [undefined, "bytes=0-1,4-5", "garbage", "items=0-3", "bytes="]) expect(wantsRange(request(value))).toBe(false);
  });

  it("answers a partial read with 206 and exact headers", async () => {
    const response = privateMediaResponse(body({ offset: 4, length: 3 }), "bytes=4-6", 10, { "Content-Type": "audio/webm" });
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 4-6/10");
    expect(response.headers.get("Content-Length")).toBe("3");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Type")).toBe("audio/webm");
  });

  it("answers an open-ended range from its offset to the end", () => {
    const response = privateMediaResponse(body({ offset: 7 } as R2Range), "bytes=7-", 10, {});
    expect(response.headers.get("Content-Range")).toBe("bytes 7-9/10");
    expect(response.headers.get("Content-Length")).toBe("3");
  });

  it("answers a satisfiable range covering the whole file with 206, as players expect", () => {
    const response = privateMediaResponse(body({ offset: 0, length: 10 }), "bytes=0-", 10, {});
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-9/10");
  });

  it("knows which ranges a file of a given size can serve", () => {
    expect(satisfiable("bytes=0-3", 10)).toBe(true);
    expect(satisfiable("bytes=9-", 10)).toBe(true);
    expect(satisfiable("bytes=-3", 10)).toBe(true);
    expect(satisfiable("bytes=10-12", 10)).toBe(false);
    expect(satisfiable("bytes=5-2", 10)).toBe(false);
    expect(satisfiable("bytes=-0", 10)).toBe(false);
    expect(satisfiable("bytes=0-1", 0)).toBe(false);
  });

  it("never claims a range the client did not get (review finding F6)", () => {
    // Storage resolves an unsatisfiable range to the whole object.
    const whole = privateMediaResponse(body({ offset: 0, length: 10 }), "bytes=20-30", 10, {});
    expect(whole.status).toBe(200);
    expect(whole.headers.get("Content-Range")).toBeNull();
    expect(whole.headers.get("Content-Length")).toBe("10");
    const plain = privateMediaResponse(body(), null, 10, {});
    expect(plain.status).toBe(200);
    expect(plain.headers.get("Content-Length")).toBe("10");
  });
});
