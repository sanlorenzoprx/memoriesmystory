/// <reference types="@cloudflare/workers-types" />
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TestR2 } from "../helpers/legacy-runtime";
import { viewingCopyResponse, type ViewingImagesBinding } from "../../worker/private-media";
import { displayUrl } from "../../app/services/display-url";

const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function setup(contentType = "image/heic") {
  const bucket = new TestR2();
  await bucket.put("originals/photo_heic", heic.slice().buffer);
  const calls: string[] = [];
  const images: ViewingImagesBinding = {
    input: () => ({
      output: async (options) => {
        calls.push(options.format);
        return { response: () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { headers: { "Content-Type": "image/jpeg" } }) };
      },
    }),
  };
  const original = { id: "photo_heic", r2_key: "originals/photo_heic", content_type: contentType, byte_size: heic.length, sha256: sha(heic) };
  return { bucket: bucket as unknown as R2Bucket, raw: bucket, images, original, calls };
}

describe("HEIC viewing copy (L1.4)", () => {
  it("returns a labelled JPEG for display and leaves the original untouched", async () => {
    const s = await setup(),
      response = (await viewingCopyResponse(new Request("https://example.test/m?display=jpeg"), s.bucket, s.images, s.original))!;
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("X-Viewing-Copy-Of")).toBe("photo_heic");
    expect(response.headers.get("X-Source-SHA256")).toBe(sha(heic));
    // Never presented as the original.
    expect(response.headers.get("X-Content-SHA256")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0xff, 0xd8]));
    expect(sha(s.raw.objects.get("originals/photo_heic")!.body)).toBe(sha(heic));
    expect(s.calls).toEqual(["image/jpeg"]);
  });

  it("serves the original as before when no copy applies", async () => {
    const s = await setup();
    expect(await viewingCopyResponse(new Request("https://example.test/m"), s.bucket, s.images, s.original)).toBeNull();
    expect(await viewingCopyResponse(new Request("https://example.test/m?display=jpeg"), s.bucket, undefined, s.original)).toBeNull();
    const png = await setup("image/png");
    expect(await viewingCopyResponse(new Request("https://example.test/m?display=jpeg"), png.bucket, png.images, png.original)).toBeNull();
    const failing: ViewingImagesBinding = { input: () => ({ output: async () => { throw new Error("transform failed"); } }) };
    expect(await viewingCopyResponse(new Request("https://example.test/m?display=jpeg"), s.bucket, failing, s.original)).toBeNull();
  });

  it("asks for a display copy only on the app's own media addresses", () => {
    expect(displayUrl("/resources/drafts/d/media/a")).toBe("/resources/drafts/d/media/a?display=jpeg");
    expect(displayUrl("/resources/x?y=1")).toBe("/resources/x?y=1&display=jpeg");
    expect(displayUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(displayUrl("blob:https://example.test/1")).toBe("blob:https://example.test/1");
  });
});
