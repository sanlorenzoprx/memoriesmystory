/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { handleMediaRoute } from "../../worker/media-routes";

type StoredObject = {
  body: Uint8Array;
  etag: string;
  contentType: string;
  customMetadata: Record<string, string>;
};

class TestD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    readonly query: string,
    readonly values: readonly SQLInputValue[] = []
  ) {}

  bind(...values: SQLInputValue[]): TestD1Statement {
    return new TestD1Statement(this.database, this.query, values);
  }

  private statement(): StatementSync {
    return this.database.prepare(this.query);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.statement().get(...this.values) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.statement().run(...this.values);
    return { success: true, results: [], meta: {} as D1Result<T>["meta"] };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return {
      success: true,
      results: this.statement().all(...this.values) as T[],
      meta: {} as D1Result<T>["meta"]
    };
  }
}

class TestD1 {
  readonly database = new DatabaseSync(":memory:");

  constructor() {
    this.database.exec(
      readFileSync(
        new URL("../../migrations/0001_phase_1_foundation.sql", import.meta.url),
        "utf8"
      )
    );
  }

  prepare(query: string): TestD1Statement {
    return new TestD1Statement(this.database, query);
  }

  async batch<T>(statements: readonly TestD1Statement[]): Promise<D1Result<T>[]> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results: D1Result<T>[] = [];
      for (const statement of statements) {
        results.push((await statement.run()) as D1Result<T>);
      }
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}

function r2Object(key: string, value: StoredObject, range?: R2Range): R2ObjectBody {
  let body = value.body;
  let normalizedRange: R2Range | undefined;
  if (range && "offset" in range && typeof range.offset === "number") {
    const length = range.length ?? body.length - range.offset;
    body = body.slice(range.offset, range.offset + length);
    normalizedRange = { offset: range.offset, length };
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    }
  });
  return {
    key,
    version: "1",
    size: value.body.length,
    etag: value.etag,
    httpEtag: `"${value.etag}"`,
    checksums: { toJSON: () => ({}) },
    uploaded: new Date("2026-07-16T00:00:00Z"),
    httpMetadata: { contentType: value.contentType },
    customMetadata: value.customMetadata,
    range: normalizedRange,
    storageClass: "Standard",
    writeHttpMetadata(headers) {
      headers.set("Content-Type", value.contentType);
    },
    body: stream,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
    bytes: () => Promise.resolve(body),
    text: () => Promise.resolve(new TextDecoder().decode(body)),
    json: <T>() => Promise.resolve(JSON.parse(new TextDecoder().decode(body)) as T),
    blob: () => Promise.resolve(
      new Blob(
        [body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer],
        { type: value.contentType }
      )
    )
  } as R2ObjectBody;
}

class TestR2 {
  readonly objects = new Map<string, StoredObject>();
  failNextPut = false;

  async head(key: string): Promise<R2Object | null> {
    const value = this.objects.get(key);
    return value ? r2Object(key, value) : null;
  }

  async put(
    key: string,
    body: ArrayBuffer,
    options?: R2PutOptions
  ): Promise<R2Object | null> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error("synthetic R2 interruption");
    }
    if (options?.onlyIf && this.objects.has(key)) return null;
    const bytes = new Uint8Array(body);
    const value: StoredObject = {
      body: bytes,
      etag: createHash("sha256").update(bytes).digest("hex").slice(0, 24),
      contentType: (options?.httpMetadata as R2HTTPMetadata | undefined)?.contentType ?? "application/octet-stream",
      customMetadata: options?.customMetadata ?? {}
    };
    this.objects.set(key, value);
    return r2Object(key, value);
  }

  async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
    const value = this.objects.get(key);
    if (!value) return null;
    let range: R2Range | undefined;
    if (options?.range instanceof Headers) {
      const header = options.range.get("Range");
      const match = header?.match(/^bytes=(\d+)-(\d*)$/);
      if (match) {
        const offset = Number(match[1]);
        range = {
          offset,
          length: match[2] ? Number(match[2]) - offset + 1 : undefined
        };
      }
    }
    return r2Object(key, value, range);
  }
}

const draftId = "draft_test_001";
const draftToken = "draft-secret-token-" + "a".repeat(48);
const photo = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 0, 0, 0, 0, 0
]);
const audio = Uint8Array.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01,
  0x42, 0xf7, 0x81, 0x01
]);

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function uploadRequest(input: {
  role: "photo" | "audio";
  body: Uint8Array;
  assetId: string;
  idempotencyKey: string;
  token?: string;
  checksum?: string;
}): Request {
  const contentType = input.role === "photo" ? "image/png" : "audio/webm";
  return new Request(`https://example.test/resources/drafts/${draftId}/${input.role}`, {
    method: "PUT",
    body: input.body.buffer.slice(
      input.body.byteOffset,
      input.body.byteOffset + input.body.byteLength
    ) as ArrayBuffer,
    headers: {
      "Content-Type": contentType,
      Origin: "https://example.test",
      "X-Asset-ID": input.assetId,
      "X-Content-Length": String(input.body.byteLength),
      "X-Content-SHA256": input.checksum ?? digest(input.body),
      "X-Draft-Token": input.token ?? draftToken,
      "X-Idempotency-Key": input.idempotencyKey,
      "X-Memories-Request": "media-v1",
      "X-UI-Locale": "en-US",
      ...(input.role === "audio" ? { "X-Audio-Duration-MS": "1200" } : {})
    }
  });
}

describe("private original media durability", () => {
  let d1: TestD1;
  let r2: TestR2;
  let env: { DB: D1Database; MEDIA_BUCKET: R2Bucket };

  beforeEach(() => {
    d1 = new TestD1();
    r2 = new TestR2();
    env = {
      DB: d1 as unknown as D1Database,
      MEDIA_BUCKET: r2 as unknown as R2Bucket
    };
  });

  it("stores one immutable photograph and replays the same durable receipt", async () => {
    const request = uploadRequest({
      role: "photo",
      body: photo,
      assetId: "asset_photo_001",
      idempotencyKey: "upload_photo_001"
    });
    const first = await handleMediaRoute(request, env);
    expect(first?.status).toBe(201);
    const firstBody = (await first?.json()) as { receipt: { r2Etag: string } };
    expect(firstBody.receipt.r2Etag).toBeTruthy();
    expect(r2.objects.size).toBe(1);

    const replay = await handleMediaRoute(
      uploadRequest({
        role: "photo",
        body: photo,
        assetId: "asset_photo_001",
        idempotencyKey: "upload_photo_001"
      }),
      env
    );
    expect(replay?.status).toBe(200);
    expect(((await replay?.json()) as { replayed: boolean }).replayed).toBe(true);
    expect(r2.objects.size).toBe(1);
  });

  it("rejects a changed retry, wrong draft secret, and mismatched signature", async () => {
    await handleMediaRoute(
      uploadRequest({ role: "photo", body: photo, assetId: "asset_photo_001", idempotencyKey: "upload_photo_001" }),
      env
    );

    const changed = Uint8Array.from([...photo, 1]);
    const conflict = await handleMediaRoute(
      uploadRequest({ role: "photo", body: changed, assetId: "asset_photo_001", idempotencyKey: "upload_photo_001" }),
      env
    );
    expect(conflict?.status).toBe(409);

    const wrongToken = await handleMediaRoute(
      uploadRequest({ role: "photo", body: photo, assetId: "asset_photo_002", idempotencyKey: "upload_photo_002", token: "wrong-" + "b".repeat(48) }),
      env
    );
    expect(wrongToken?.status).toBe(403);

    const disguised = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const badSignature = await handleMediaRoute(
      uploadRequest({ role: "photo", body: disguised, assetId: "asset_photo_003", idempotencyKey: "upload_photo_003" }),
      env
    );
    expect(badSignature?.status).toBe(415);
  });

  it("recovers the same photo upload after an R2 interruption", async () => {
    r2.failNextPut = true;
    const failed = await handleMediaRoute(
      uploadRequest({ role: "photo", body: photo, assetId: "asset_photo_001", idempotencyKey: "upload_photo_001" }),
      env
    );
    expect(failed?.status).toBe(503);
    expect(r2.objects.size).toBe(0);

    const recovered = await handleMediaRoute(
      uploadRequest({ role: "photo", body: photo, assetId: "asset_photo_001", idempotencyKey: "upload_photo_001" }),
      env
    );
    expect(recovered?.status).toBe(200);
    expect(r2.objects.size).toBe(1);
  });

  it("confirms both originals independently and streams only to the draft owner", async () => {
    await handleMediaRoute(
      uploadRequest({ role: "photo", body: photo, assetId: "asset_photo_001", idempotencyKey: "upload_photo_001" }),
      env
    );
    const audioResponse = await handleMediaRoute(
      uploadRequest({ role: "audio", body: audio, assetId: "asset_audio_001", idempotencyKey: "upload_audio_001" }),
      env
    );
    expect(audioResponse?.status).toBe(201);

    const status = await handleMediaRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/media-status`, {
        headers: { "X-Draft-Token": draftToken }
      }),
      env
    );
    const statusBody = (await status?.json()) as { originalsDurable: boolean; assets: unknown[] };
    expect(statusBody.originalsDurable).toBe(true);
    expect(statusBody.assets).toHaveLength(2);

    const forbidden = await handleMediaRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/media/asset_audio_001`, {
        headers: { "X-Draft-Token": "wrong-" + "c".repeat(48) }
      }),
      env
    );
    expect(forbidden?.status).toBe(403);

    const playback = await handleMediaRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/media/asset_audio_001`, {
        headers: { "X-Draft-Token": draftToken, Range: "bytes=0-3" }
      }),
      env
    );
    expect(playback?.status).toBe(206);
    expect(new Uint8Array(await playback!.arrayBuffer())).toEqual(audio.slice(0, 4));
    expect(playback?.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
