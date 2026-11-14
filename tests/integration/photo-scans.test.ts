/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from "node:sqlite";
import { describe, expect, it } from "vitest";

import { handlePhotoScanRoute } from "../../worker/photo-scans";
import { handleDeletionRoute } from "../../worker/deletion";
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
    readonly values: readonly SQLInputValue[] = [],
  ) {}

  bind(...values: SQLInputValue[]): TestD1Statement {
    return new TestD1Statement(this.database, this.query, values);
  }

  private statement(): StatementSync {
    return this.database.prepare(this.query);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.statement().get(...this.values) as
      | Record<string, unknown>
      | undefined;
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
      meta: {} as D1Result<T>["meta"],
    };
  }
}

class TestD1 {
  readonly database = new DatabaseSync(":memory:");

  constructor() {
    for (const name of [
      "0001_phase_1_foundation.sql",
      "0002_account_binding_recovery.sql",
      "0003_living_memory_proof.sql",
      "0004_configurable_story_entitlements.sql",
      "0005_memory_deletion.sql",
      "0006_muse_conversation.sql",
      "0007_muse_voice_replies.sql",
      "0008_storyteller_review.sql",
      "0009_archival_scans.sql",

      "0010_legacy_sessions.sql",
      "0011_legacy_recordings.sql",
    ])
      this.database.exec(
        readFileSync(
          new URL(`../../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
  }

  prepare(query: string): TestD1Statement {
    return new TestD1Statement(this.database, query);
  }

  async batch<T>(
    statements: readonly TestD1Statement[],
  ): Promise<D1Result<T>[]> {
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

function r2Object(
  key: string,
  value: StoredObject,
  range?: R2Range,
): R2ObjectBody {
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
    },
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
    arrayBuffer: () =>
      Promise.resolve(
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      ),
    bytes: () => Promise.resolve(body),
    text: () => Promise.resolve(new TextDecoder().decode(body)),
    json: <T>() =>
      Promise.resolve(JSON.parse(new TextDecoder().decode(body)) as T),
    blob: () =>
      Promise.resolve(
        new Blob(
          [
            body.buffer.slice(
              body.byteOffset,
              body.byteOffset + body.byteLength,
            ) as ArrayBuffer,
          ],
          { type: value.contentType },
        ),
      ),
  } as R2ObjectBody;
}

class TestR2 {
  readonly objects = new Map<string, StoredObject>();
  failNextPut = false;

  async delete(key: string) {
    this.objects.delete(key);
  }

  async head(key: string): Promise<R2Object | null> {
    const value = this.objects.get(key);
    return value ? r2Object(key, value) : null;
  }

  async put(
    key: string,
    body: ArrayBuffer,
    options?: R2PutOptions,
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
      contentType:
        (options?.httpMetadata as R2HTTPMetadata | undefined)?.contentType ??
        "application/octet-stream",
      customMetadata: options?.customMetadata ?? {},
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
          length: match[2] ? Number(match[2]) - offset + 1 : undefined,
        };
      }
    }
    return r2Object(key, value, range);
  }
}

const draftId = "draft_scan_test_001",
  token = "t".repeat(64),
  sourceId = "asset_scan_source_001";
const source = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const scan = Uint8Array.from([
  255, 216, 255, 192, 0, 11, 8, 0, 100, 0, 200, 1, 1, 17, 0, 255, 217,
]);
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const transform = {
  version: "perspective-v1",
  coordinateBasis: "browser_decoded",
  sourceWidth: 300,
  sourceHeight: 200,
  outputWidth: 200,
  outputHeight: 100,
  corners: [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ],
};
async function setup() {
  const db = new TestD1(),
    bucket = new TestR2();
  const env = {
    DB: db as unknown as D1Database,
    MEDIA_BUCKET: bucket as unknown as R2Bucket,
  };
  const request = new Request(
    `https://example.test/resources/drafts/${draftId}/photo`,
    {
      method: "PUT",
      headers: {
        "X-Memories-Request": "media-v1",
        "X-Draft-Token": token,
        "X-Asset-ID": sourceId,
        "X-Idempotency-Key": "upload_scan_source_001",
        "X-Content-SHA256": digest(source),
        "X-Content-Length": String(source.length),
        "Content-Type": "image/png",
      },
      body: source,
    },
  );
  expect((await handleMediaRoute(request, env))?.status).toBe(201);
  return { db, bucket, env };
}
function request(overrides: Record<string, string> = {}, body = scan) {
  return new Request(`https://example.test/resources/drafts/${draftId}/scans`, {
    method: "PUT",
    headers: {
      "X-Memories-Request": "scan-v1",
      "X-Draft-Token": token,
      "X-Asset-ID": "asset_scan_result_001",
      "X-Idempotency-Key": "upload_scan_result_001",
      "X-Source-Asset-ID": sourceId,
      "X-Source-SHA256": digest(source),
      "X-Content-SHA256": digest(body),
      "Content-Type": "image/jpeg",
      "X-Scan-Transform": JSON.stringify(transform),
      ...overrides,
    },
    body,
  });
}
describe("private separate scan preservation", () => {
  it("stores and replays a distinct derivative without changing original bytes or identity", async () => {
    const { db, bucket, env } = await setup();
    expect((await handlePhotoScanRoute(request(), env))?.status).toBe(201);
    expect((await handlePhotoScanRoute(request(), env))?.status).toBe(200);
    expect(bucket.objects.size).toBe(2);
    expect(
      db.database
        .prepare("SELECT sha256,role FROM media_assets WHERE id=?")
        .get(sourceId),
    ).toMatchObject({ sha256: digest(source), role: "original_photo" });
    expect(
      db.database
        .prepare(
          "SELECT source_asset_id,role FROM media_assets WHERE id='asset_scan_result_001'",
        )
        .get(),
    ).toMatchObject({ source_asset_id: sourceId, role: "enhanced_photo" });
    const listing = await handlePhotoScanRoute(
      new Request(`https://example.test/resources/drafts/${draftId}/scans`, {
        headers: { "X-Draft-Token": token },
      }),
      env,
    );
    expect(
      ((await listing!.json()) as { scans: unknown[] }).scans,
    ).toHaveLength(1);
    expect(() =>
      db.database.exec(
        "UPDATE archival_scan_provenance SET source_sha256='" +
          "b".repeat(64) +
          "'",
      ),
    ).toThrow(/immutable/);
    const deleted = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${draftId}`, {
        method: "DELETE",
        headers: {
          "X-Memories-Request": "deletion-v1",
          "X-Draft-Token": token,
        },
      }),
      env,
    );
    expect(deleted?.status).toBe(200);
    expect(bucket.objects.size).toBe(0);
    expect(
      db.database
        .prepare("SELECT COUNT(*) AS n FROM archival_scan_provenance")
        .get(),
    ).toMatchObject({ n: 0 });
  });
  it("recovers storage interruption with the same derivative and retry key", async () => {
    const { db, bucket, env } = await setup();
    bucket.failNextPut = true;
    expect((await handlePhotoScanRoute(request(), env))?.status).toBe(503);
    expect(
      db.database
        .prepare(
          "SELECT durability_status FROM media_assets WHERE id='asset_scan_result_001'",
        )
        .get(),
    ).toMatchObject({ durability_status: "pending" });
    expect((await handlePhotoScanRoute(request(), env))?.status).toBe(200);
    expect(bucket.objects.size).toBe(2);
    expect(
      (
        await handlePhotoScanRoute(
          request({ "X-Content-SHA256": "b".repeat(64) }),
          env,
        )
      )?.status,
    ).toBe(409);
  });
  it("rejects foreign sources, bad corner geometry, wrong dimensions, checksums and origins", async () => {
    const { env } = await setup();
    for (const [overrides, status] of [
      [{ "X-Source-Asset-ID": "asset_someone_else" }, 409],
      [
        {
          "X-Scan-Transform": JSON.stringify({
            ...transform,
            outputWidth: 201,
          }),
        },
        400,
      ],
      [
        {
          "X-Scan-Transform": JSON.stringify({
            ...transform,
            corners: [
              transform.corners[0],
              transform.corners[2],
              transform.corners[1],
              transform.corners[3],
            ],
          }),
        },
        400,
      ],
      [{ "X-Content-SHA256": "b".repeat(64) }, 400],
      [{ Origin: "https://unrelated.test" }, 403],
      [{ "X-Draft-Token": "wrong".repeat(12) }, 403],
    ] as [Record<string, string>, number][]) {
      expect(
        (await handlePhotoScanRoute(request(overrides), env))?.status,
      ).toBe(status);
    }
  });
  it("requires the claimed owner session for scan metadata and pixels", async () => {
    const { db, env } = await setup();
    expect((await handlePhotoScanRoute(request(), env))?.status).toBe(201);
    const now = "2026-11-13T12:00:00Z",
      user = "owner_scan_001",
      sessionToken = "session-scan-" + "x".repeat(40),
      secret = "s".repeat(40);
    db.database
      .prepare(
        "INSERT INTO users(id,email,created_at,updated_at) VALUES(?,?,?,?)",
      )
      .run(user, "owner@example.test", now, now);
    db.database
      .prepare("UPDATE memory_story_drafts SET owner_user_id=? WHERE id=?")
      .run(user, draftId);
    db.database
      .prepare(
        "INSERT INTO user_sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,'2099-01-01T00:00:00Z',?)",
      )
      .run(
        "session_scan_001",
        user,
        createHash("sha256").update(`${secret}:${sessionToken}`).digest("hex"),
        now,
      );
    const claimedEnv = { ...env, SESSION_SECRET: secret };
    expect(
      (
        await handlePhotoScanRoute(
          new Request(
            `https://example.test/resources/drafts/${draftId}/scans`,
            { headers: { "X-Draft-Token": token } },
          ),
          claimedEnv,
        )
      )?.status,
    ).toBe(403);
    expect(
      (
        await handleMediaRoute(
          new Request(
            `https://example.test/resources/drafts/${draftId}/media/asset_scan_result_001`,
            { headers: { "X-Draft-Token": token } },
          ),
          claimedEnv,
        )
      )?.status,
    ).toBe(403);
    const headers = { Cookie: `memories_session=${sessionToken}` };
    expect(
      (
        await handlePhotoScanRoute(
          new Request(
            `https://example.test/resources/drafts/${draftId}/scans`,
            { headers },
          ),
          claimedEnv,
        )
      )?.status,
    ).toBe(200);
    expect(
      (
        await handleMediaRoute(
          new Request(
            `https://example.test/resources/drafts/${draftId}/media/asset_scan_result_001`,
            { headers },
          ),
          claimedEnv,
        )
      )?.status,
    ).toBe(200);
  });
});
