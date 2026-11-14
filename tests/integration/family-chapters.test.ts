/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import {
  setupLegacyFixture,
  addSyntheticMemory,
} from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleArchiveRoute } from "../../worker/archive-routes";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
});
async function setup() {
  const s = await setupLegacyFixture();
  cleanups.push(() => s.db.close());
  const now = new Date().toISOString();
  s.db.database
    .prepare(
      "INSERT INTO users(id,created_at,updated_at) VALUES('unrelated_family_user',?,?)",
    )
    .run(now, now);
  const outsider = (
    await createAppSession(s.env, "unrelated_family_user")
  ).cookie.split(";")[0]!;
  async function call(
    path = "",
    method = "GET",
    body?: unknown,
    key = `family_key_${crypto.randomUUID()}`,
    cookie = s.owner,
    csrf = true,
  ) {
    return (await handleArchiveRoute(
      new Request(`https://example.test/resources/family-archives${path}`, {
        method,
        headers: {
          Cookie: cookie,
          ...(csrf ? { "X-Memories-Request": "family-v1" } : {}),
          "X-Idempotency-Key": key,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      s.env,
    ))!;
  }
  async function archive(title = "Our family") {
    const response = await call("/archives", "POST", { title });
    expect(response.status).toBe(201);
    return (await response.json()) as { id: string; version: number };
  }
  async function chapter(archiveId: string, title = "Grandmother's Kitchen") {
    const response = await call("/chapters", "POST", { archiveId, title });
    expect(response.status).toBe(201);
    return (await response.json()) as { id: string; version: number };
  }
  return { ...s, outsider, call, archive, chapter };
}
describe("private Chapters reference existing original Living Memories", () => {
  it("requires owner authentication and CSRF, and unrelated families cannot enumerate or mutate", async () => {
    const s = await setup();
    expect((await s.call("", "GET", undefined, undefined, "")).status).toBe(
      401,
    );
    expect(
      (
        await s.call(
          "/archives",
          "POST",
          { title: "Family" },
          undefined,
          s.owner,
          false,
        )
      ).status,
    ).toBe(403);
    const a = await s.archive(),
      c = await s.chapter(a.id);
    const other = (await (
      await s.call("", "GET", undefined, undefined, s.outsider)
    ).json()) as {
      archives: unknown[];
      chapters: unknown[];
      memories: unknown[];
    };
    expect(other).toMatchObject({ archives: [], chapters: [], memories: [] });
    expect(
      (
        await s.call(
          `/chapters/${c.id}`,
          "GET",
          undefined,
          undefined,
          s.outsider,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await s.call(
          "/chapters",
          "POST",
          { archiveId: a.id, title: "Wrong family" },
          undefined,
          s.outsider,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await s.call(
          `/chapters/${c.id}`,
          "DELETE",
          { version: 1 },
          undefined,
          s.outsider,
        )
      ).status,
    ).toBe(404);
  });
  it("keeps one source in two Chapters without copying bytes and Chapter/archive removal never deletes the Living Memory", async () => {
    const s = await setup(),
      a = await s.archive(),
      one = await s.chapter(a.id),
      two = await s.chapter(a.id, "Family celebrations");
    const sourceBytes = [...s.bucket.objects.entries()].map(([key, value]) => [
      key,
      [...value.body],
    ]);
    for (const c of [one, two])
      expect(
        (
          await s.call(`/chapters/${c.id}`, "PATCH", {
            version: 1,
            memoryIds: [s.memory],
            coverMemoryId: s.memory,
          })
        ).status,
      ).toBe(200);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_chapter_memories")
        .get()!.n,
    ).toBe(2);
    expect(
      [...s.bucket.objects.entries()].map(([key, value]) => [
        key,
        [...value.body],
      ]),
    ).toEqual(sourceBytes);
    expect(
      (await s.call(`/chapters/${one.id}`, "DELETE", { version: 2 })).status,
    ).toBe(200);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM memory_stories WHERE id=?")
        .get(s.memory)!.n,
    ).toBe(1);
    expect(
      (await s.call(`/archives/${a.id}`, "DELETE", { version: 1 })).status,
    ).toBe(200);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_chapter_memories")
        .get()!.n,
    ).toBe(0);
    expect(
      s.db.database
        .prepare("SELECT status FROM memory_stories WHERE id=?")
        .get(s.memory)!.status,
    ).toBe("complete");
    expect(
      [...s.bucket.objects.entries()].map(([key, value]) => [
        key,
        [...value.body],
      ]),
    ).toEqual(sourceBytes);
  });
  it("replays identical creation and edits without duplicate Chapters or stale overwrite", async () => {
    const s = await setup(),
      a = await s.archive(),
      key = "chapter_creation_retry_001",
      body = { archiveId: a.id, title: "Grandmother's Kitchen" };
    const c = (await (await s.call("/chapters", "POST", body, key)).json()) as {
      id: string;
    };
    expect(
      await (await s.call("/chapters", "POST", body, key)).json(),
    ).toMatchObject({ id: c.id, replayed: true });
    expect(
      (
        await s.call(
          "/chapters",
          "POST",
          { ...body, title: "Changed request" },
          key,
        )
      ).status,
    ).toBe(409);
    const edit = {
      version: 1,
      title: "La cocina de abuela",
      memoryIds: [s.memory],
      coverMemoryId: s.memory,
    };
    expect(
      (
        await s.call(
          `/chapters/${c.id}`,
          "PATCH",
          edit,
          "chapter_edit_retry_001",
        )
      ).status,
    ).toBe(200);
    expect(
      await (
        await s.call(
          `/chapters/${c.id}`,
          "PATCH",
          edit,
          "chapter_edit_retry_001",
        )
      ).json(),
    ).toMatchObject({ replayed: true, version: 2 });
    expect(
      (
        await s.call(`/chapters/${c.id}`, "PATCH", {
          version: 1,
          title: "Stale edit",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        (await (await s.call(`/chapters/${c.id}`)).json()) as {
          chapter: { title: string; memoryIds: string[] };
        }
      ).chapter,
    ).toMatchObject({ title: "La cocina de abuela", memoryIds: [s.memory] });
  });
  it("moves organization between owned archives without moving or duplicating originals", async () => {
    const s = await setup(),
      a = await s.archive(),
      b = await s.archive("Another private archive"),
      c = await s.chapter(a.id);
    expect(
      (
        await s.call(`/chapters/${c.id}`, "PATCH", {
          version: 1,
          archiveId: b.id,
          memoryIds: [s.memory],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        (await (await s.call(`?archiveId=${b.id}`)).json()) as {
          chapters: { id: string }[];
        }
      ).chapters.map((value) => value.id),
    ).toEqual([c.id]);
    expect(
      (
        (await (await s.call(`?archiveId=${a.id}`)).json()) as {
          chapters: unknown[];
        }
      ).chapters,
    ).toEqual([]);
    expect(s.bucket.objects.size).toBe(2);
    expect(() =>
      s.db.database
        .prepare(
          "UPDATE family_archives SET owner_user_id='unrelated_family_user' WHERE id=?",
        )
        .run(b.id),
    ).toThrow(/immutable/);
  });
  it("does not promise voice/photo playback when their original objects are unavailable", async () => {
    const s = await setup();
    s.bucket.objects.clear();
    const response = await s.call();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const view = (await response.json()) as {
      memories: {
        id: string;
        photoUrl: string | null;
        voiceAvailable: boolean;
      }[];
    };
    expect(view.memories).toEqual([
      {
        id: s.memory,
        title: null,
        titleVersion: 0,
        photoUrl: null,
        voiceAvailable: false,
      },
    ]);
  });
  it("keeps a human-entered title separate from source bytes and rejects stale title changes", async () => {
    const s = await setup();
    expect(
      (
        await s.call(`/memories/${s.memory}`, "PATCH", {
          version: 0,
          title: "En casa de abuela",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await s.call(`/memories/${s.memory}`, "PATCH", {
          version: 0,
          title: "Stale",
        })
      ).status,
    ).toBe(409);
    const view = (await (await s.call()).json()) as {
      memories: { title: string; titleVersion: number }[];
    };
    expect(view.memories[0]).toMatchObject({
      title: "En casa de abuela",
      titleVersion: 1,
    });
    expect(
      s.db.database.prepare("SELECT count(*) AS n FROM media_assets").get()!.n,
    ).toBe(2);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM transcript_revisions")
        .get()!.n,
    ).toBe(0);
  });
  it("reorders two originals, chooses a cover and removes only references", async () => {
    const s = await setup(),
      second = await addSyntheticMemory(s),
      a = await s.archive(),
      c = await s.chapter(a.id);
    const sourceKeys = [...s.bucket.objects.keys()].sort();
    expect(
      (
        await s.call(`/chapters/${c.id}`, "PATCH", {
          version: 1,
          memoryIds: [s.memory, second],
          coverMemoryId: second,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await s.call(`/chapters/${c.id}`, "PATCH", {
          version: 2,
          memoryIds: [second, s.memory],
          coverMemoryId: second,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        (await (await s.call(`/chapters/${c.id}`)).json()) as {
          chapter: { memoryIds: string[]; coverMemoryId: string };
        }
      ).chapter,
    ).toMatchObject({ memoryIds: [second, s.memory], coverMemoryId: second });
    expect(
      (
        await s.call(`/chapters/${c.id}`, "PATCH", {
          version: 3,
          memoryIds: [s.memory],
          coverMemoryId: null,
        })
      ).status,
    ).toBe(200);
    expect([...s.bucket.objects.keys()].sort()).toEqual(sourceKeys);
    expect(
      s.db.database
        .prepare(
          "SELECT count(*) AS n FROM memory_stories WHERE status='complete'",
        )
        .get()!.n,
    ).toBe(2);
  });

  it("rejects another owner's existing memory and prevents ownership-changing moves at both boundaries", async () => {
    const s = await setup(),
      foreign = await addSyntheticMemory(
        s,
        "memory_unrelated_family",
        "unrelated_family_user",
      ),
      a = await s.archive(),
      c = await s.chapter(a.id);
    expect(
      (
        await s.call(`/chapters/${c.id}`, "PATCH", {
          version: 1,
          memoryIds: [foreign],
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await s.call(`/memories/${foreign}`, "PATCH", {
          version: 0,
          title: "Not my story",
        })
      ).status,
    ).toBe(404);
    expect(() =>
      s.db.database
        .prepare(
          "INSERT INTO family_chapter_memories(chapter_id,memory_story_id,added_by_user_id,position,created_at) VALUES(?,?,'owner_legacy_test',0,?)",
        )
        .run(c.id, foreign, new Date().toISOString()),
    ).toThrow(/owned complete/);
    const b = (await (
      await s.call(
        "/archives",
        "POST",
        { title: "Unrelated family" },
        undefined,
        s.outsider,
      )
    ).json()) as { id: string };
    expect(
      (
        await s.call(`/chapters/${c.id}`, "PATCH", {
          version: 1,
          archiveId: b.id,
        })
      ).status,
    ).toBe(404);
    expect(() =>
      s.db.database
        .prepare("UPDATE family_chapters SET archive_id=? WHERE id=?")
        .run(b.id, c.id),
    ).toThrow(/ownership/);
  });
});
