/// <reference types="@cloudflare/workers-types" />
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import ts from "typescript";

let runtime: Miniflare;
const checksum = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
function fixture(size: number, value = 37) {
  const bytes = new Uint8Array(size).fill(value);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  return bytes;
}
beforeAll(async () => {
  const source = ts.transpileModule(
    readFileSync(
      new URL("../../worker/original-source-storage.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;
  runtime = new Miniflare({
    modules: true,
    compatibilityDate: "2026-07-15",
    r2Buckets: ["MEDIA"],
    script:
      source +
      `
      export default {
        async fetch(request,env) {
          const url=new URL(request.url);let checks=0;
          const bucket=new Proxy(env.MEDIA,{
            get(target,key) {
              if(key==='get'&&url.searchParams.has('corrupt'))return async(...args)=>{
                const original=await target.get(...args);if(!original)return null;
                let first=true;
                return {body:original.body.pipeThrough(new TransformStream({
                  transform(chunk,controller){
                    if(first&&chunk.length){const modified=new Uint8Array(chunk);modified[0]^=1;first=false;controller.enqueue(modified);}
                    else controller.enqueue(chunk);
                  }
                }))};
              };
              const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
            }
          });
          try {
            const receipt=await storeOriginalSource(bucket,request.body,{
              sessionId:'legacy_stream_test',sourceId:'source_stream_test',contentType:'audio/webm',
              maximumBytes:Number(request.headers.get('X-Maximum')||33554432),
              expectedSha256:request.headers.get('X-Expected-SHA')||undefined,
              assertAuthorized:async()=>{checks++;if(Number(request.headers.get('X-Revoke-At')||99999)<=checks)throw new Error('source_consent_changed');}
            });
            return Response.json(receipt);
          }catch(error){return Response.json({error:error.message},{status:500});}
        }
      };
    `,
  });
  await runtime.ready;
}, 20000);
afterAll(async () => {
  await runtime?.dispose();
});

describe("original streaming storage on real workerd/R2 bindings", () => {
  it("preserves a multipart-sized source with independent read-back hash verification", async () => {
    const bytes = fixture(12 * 1024 * 1024),
      sha = checksum(bytes);
    const response = await runtime.dispatchFetch("https://archive.test/", {
      method: "POST",
      body: bytes,
      headers: { "X-Expected-SHA": sha },
    });
    const receipt = (await response.json()) as {
      r2Key: string;
      sha256: string;
      byteSize: number;
      etag: string;
    };
    expect(response.status).toBe(200);
    expect(receipt).toMatchObject({ sha256: sha, byteSize: bytes.length });
    expect(receipt.etag).toBeTruthy();
    const bucket = await runtime.getR2Bucket("MEDIA"),
      object = await bucket.get(receipt.r2Key);
    expect(checksum(new Uint8Array(await object!.arrayBuffer()))).toBe(sha);
    expect(object!.httpMetadata?.cacheControl).toBe("private, no-store");
  }, 20000);
  it("a retry uses a new key and cannot replace the earlier original", async () => {
    const receipts = [];
    for (const value of [42, 99]) {
      const response = await runtime.dispatchFetch("https://archive.test/", {
        method: "POST",
        body: fixture(1000, value),
      });
      expect(response.status).toBe(200);
      receipts.push(
        (await response.json()) as { r2Key: string; sha256: string },
      );
    }
    expect(receipts[0]!.r2Key).not.toBe(receipts[1]!.r2Key);
    const bucket = await runtime.getR2Bucket("MEDIA"),
      original = await bucket.get(receipts[0]!.r2Key);
    expect(checksum(new Uint8Array(await original!.arrayBuffer()))).toBe(
      receipts[0]!.sha256,
    );
    expect(receipts[0]!.sha256).not.toBe(receipts[1]!.sha256);
  });
  it("revoked consent, wrong hash and size overflow abort without publishing source objects", async () => {
    const bucket = await runtime.getR2Bucket("MEDIA"),
      before = (await bucket.list()).objects.length;
    for (const [headers, reason] of [
      [{ "X-Revoke-At": "2" }, "source_consent_changed"],
      [{ "X-Expected-SHA": "0".repeat(64) }, "source_checksum_mismatch"],
      [{ "X-Maximum": "1000" }, "source_too_large"],
    ] as const) {
      const response = await runtime.dispatchFetch("https://archive.test/", {
        method: "POST",
        body: fixture(9 * 1024 * 1024),
        headers,
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: reason });
    }
    expect((await bucket.list()).objects.length).toBe(before);
  }, 20000);
  it("does not confirm storage when read-back bytes differ from uploaded bytes", async () => {
    const response = await runtime.dispatchFetch(
      "https://archive.test/?corrupt=1",
      { method: "POST", body: fixture(1000) },
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe(
      JSON.stringify({ error: "source_readback_checksum_mismatch" }),
    );
  });
});
