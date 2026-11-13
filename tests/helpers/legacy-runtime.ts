/// <reference types="@cloudflare/workers-types" />

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from "node:sqlite";

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
      Record<string, unknown> | undefined;
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

export class TestD1 {
  readonly database = new DatabaseSync(":memory:");

  constructor() {
    for (const name of readdirSync(
      new URL("../../migrations/", import.meta.url),
    )
      .filter((name) => name.endsWith(".sql"))
      .sort())
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

export class TestR2 {
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
