/// <reference types="@cloudflare/workers-types" />
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { Miniflare } from "miniflare";
import ts from "typescript";
import {
  setupLegacyFixture,
  addSyntheticMemory,
} from "../helpers/legacy-fixture";
let runtime: Miniflare | undefined;
afterAll(async () => {
  await runtime?.dispose();
});
function modules() {
  const root = resolve("."),
    seen = new Set<string>(),
    result: { type: "ESModule"; path: string; contents: string }[] = [];
  function add(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    let contents = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    contents = contents.replace(
      /from\s+["'](\.[^"']+)["']/g,
      (_all, name: string) => {
        add(resolve(dirname(file), `${name}.ts`));
        return `from "${name}.js"`;
      },
    );
    result.push({
      type: "ESModule",
      path: relative(root, file).replace(/\.ts$/, ".js"),
      contents,
    });
  }
  add(resolve("worker/archive-routes.ts"));
  add(resolve("worker/people-routes.ts"));
  result.unshift({
    type: "ESModule",
    path: "family-runtime-test.js",
    contents:
      "import {handleArchiveRoute} from './worker/archive-routes.js'; import {handlePeopleRoute} from './worker/people-routes.js'; export default {async fetch(request,env){return await handlePeopleRoute(request,env)??await handleArchiveRoute(request,env);}};",
  });
  return result;
}
describe("private Chapter metadata on native workerd/D1/R2", () => {
  it("commits a bulk reference edit and receipt atomically, rejects stale edits, and never changes source objects", async () => {
    const fixture = await setupLegacyFixture();
    try {
      const second = await addSyntheticMemory(fixture),
        sql = fixture.db.database;
      const memoryIds = [fixture.memory, second];
      for (let index = 2; index < 120; index++)
        memoryIds.push(
          await addSyntheticMemory(
            fixture,
            `memory_native_bulk_${String(index).padStart(3, "0")}`,
          ),
        );
      runtime = new Miniflare({
        modules: modules(),
        modulesRoot: resolve("."),
        compatibilityDate: "2026-07-15",
        d1Databases: ["DB"],
        r2Buckets: ["MEDIA_BUCKET"],
        bindings: { SESSION_SECRET: fixture.env.SESSION_SECRET },
      });
      await runtime.ready;
      const db = await runtime.getD1Database("DB"),
        bucket = await runtime.getR2Bucket("MEDIA_BUCKET");
      const schema = sql
        .prepare(
          "SELECT type,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid",
        )
        .all() as { type: string; sql: string }[];
      for (const item of schema.filter((item) => item.type !== "trigger"))
        await db.prepare(item.sql).run();
      for (const { name } of sql
        .prepare(
          "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
        )
        .all() as { name: string }[]) {
        for (const row of sql.prepare(`SELECT * FROM ${name}`).all()) {
          const keys = Object.keys(row);
          await db
            .prepare(
              `INSERT INTO ${name}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
            )
            .bind(...Object.values(row))
            .run();
        }
      }
      for (const item of schema.filter((item) => item.type === "trigger"))
        await db.prepare(item.sql).run();
      for (const [key, value] of fixture.bucket.objects)
        await bucket.put(key, value.body);
      const before = (await bucket.list()).objects.map((object) => ({
        key: object.key,
        etag: object.etag,
      }));
      async function call(
        path = "",
        method = "GET",
        body?: unknown,
        key = `native_family_${crypto.randomUUID()}`,
      ) {
        return runtime!.dispatchFetch(
          `https://example.test/resources/family-archives${path}`,
          {
            method,
            headers: {
              Cookie: fixture.owner,
              "X-Memories-Request": "family-v1",
              "X-Idempotency-Key": key,
              ...(body ? { "Content-Type": "application/json" } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          },
        );
      }
      const a = (await (
        await call("/archives", "POST", { title: "Our family" })
      ).json()) as { id: string };
      const c = (await (
        await call("/chapters", "POST", {
          archiveId: a.id,
          title: "Grandmother's Kitchen",
        })
      ).json()) as { id: string };
      const body = { version: 1, memoryIds, coverMemoryId: second };
      expect(
        (
          await call(
            `/chapters/${c.id}`,
            "PATCH",
            body,
            "native_family_retry_001",
          )
        ).status,
      ).toBe(200);
      expect(
        await (
          await call(
            `/chapters/${c.id}`,
            "PATCH",
            body,
            "native_family_retry_001",
          )
        ).json(),
      ).toMatchObject({ version: 2, replayed: true });
      expect(
        (await call(`/chapters/${c.id}`, "PATCH", { ...body, title: "stale" }))
          .status,
      ).toBe(409);
      expect(
        (
          (await (await call(`/chapters/${c.id}`)).json()) as {
            chapter: { memoryIds: string[] };
          }
        ).chapter.memoryIds,
      ).toEqual(memoryIds);
      expect(
        (
          (await (await call()).json()) as {
            memories: { voiceAvailable: boolean }[];
          }
        ).memories.every((memory) => memory.voiceAvailable),
      ).toBe(true);
      expect(
        (await call(`/chapters/${c.id}`, "DELETE", { version: 2 })).status,
      ).toBe(200);
      const peopleUrl = `https://example.test/resources/family-people/person?archiveId=${a.id}`;
      const personBody = {
        document: {
          label: "Same-name relative",
          notes: "Human-entered",
          dateText: "around 1940",
          datePrecision: "approximate",
          memoryIds: [fixture.memory],
        },
      };
      const requestOptions = {
        method: "POST",
        headers: {
          Cookie: fixture.owner,
          "X-Memories-Request": "family-v1",
          "X-Idempotency-Key": "native_people_retry",
        },
        body: JSON.stringify(personBody),
      };
      const createdPerson = await runtime!.dispatchFetch(
        peopleUrl,
        requestOptions,
      );
      expect(createdPerson.status).toBe(201);
      const person = (await createdPerson.json()) as { id: string };
      expect(
        await (await runtime!.dispatchFetch(peopleUrl, requestOptions)).json(),
      ).toMatchObject({ id: person.id, replayed: true });
      const editUrl = `https://example.test/resources/family-people/person/${person.id}?archiveId=${a.id}`;
      const editOptions = {
        ...requestOptions,
        method: "PATCH",
        headers: {
          ...requestOptions.headers,
          "X-Idempotency-Key": "native_people_edit",
        },
        body: JSON.stringify({
          version: 1,
          document: { ...personBody.document, label: "Human correction" },
        }),
      };
      expect((await runtime!.dispatchFetch(editUrl, editOptions)).status).toBe(
        200,
      );
      expect(
        (
          await runtime!.dispatchFetch(editUrl, {
            ...editOptions,
            headers: {
              ...editOptions.headers,
              "X-Idempotency-Key": "native_people_stale",
            },
          })
        ).status,
      ).toBe(409);
      const history = await db
        .prepare(
          "SELECT version,document_json FROM family_people_history WHERE record_id=? ORDER BY version",
        )
        .bind(person.id)
        .all<{ version: number; document_json: string }>();
      expect(history.results).toHaveLength(2);
      expect(JSON.parse(history.results[0].document_json).label).toBe(
        "Same-name relative",
      );
      expect(JSON.parse(history.results[1].document_json).label).toBe(
        "Human correction",
      );
      expect(
        (await bucket.list()).objects.map((object) => ({
          key: object.key,
          etag: object.etag,
        })),
      ).toEqual(before);
      expect(
        await db
          .prepare(
            "SELECT count(*) AS n FROM memory_stories WHERE status='complete'",
          )
          .first(),
      ).toMatchObject({ n: 120 });
    } finally {
      fixture.db.close();
    }
  }, 30000);
});
