/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import {
  setupLegacyFixture,
  addSyntheticMemory,
} from "../helpers/legacy-fixture";
import { handleArchiveRoute } from "../../worker/archive-routes";
import { handlePeopleRoute } from "../../worker/people-routes";
import { createAppSession } from "../../worker/auth-session";
import type {
  PeopleRecord,
  PersonReference,
  RelationshipReference,
} from "../../app/domain/family-people";
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});
async function setup() {
  const fixture = await setupLegacyFixture();
  cleanup.push(() => fixture.db.close());
  const response = await handleArchiveRoute(
    new Request("https://example.test/resources/family-archives/archives", {
      method: "POST",
      headers: {
        Cookie: fixture.owner,
        "X-Memories-Request": "family-v1",
        "X-Idempotency-Key": "people_archive_fixture",
      },
      body: JSON.stringify({ title: "Private family" }),
    }),
    fixture.env,
  );
  expect(response?.status).toBe(201);
  const archive = (await response!.json()) as { id: string };
  async function call(
    path = "",
    method = "GET",
    body?: unknown,
    key = `people_key_${crypto.randomUUID()}`,
    cookie = fixture.owner,
    csrf = true,
  ) {
    return (await handlePeopleRoute(
      new Request(
        `https://example.test/resources/family-people${path}?archiveId=${archive.id}`,
        {
          method,
          headers: {
            Cookie: cookie,
            "X-Idempotency-Key": key,
            ...(csrf ? { "X-Memories-Request": "family-v1" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      ),
      fixture.env,
    ))!;
  }
  const document: PersonReference = {
    label: "María",
    notes: "My recollection, not an identity guess",
    dateText: "around the 1940s",
    datePrecision: "approximate",
    memoryIds: [fixture.memory],
  };
  async function person(value = document) {
    const response = await call("/person", "POST", { document: value });
    expect(response.status).toBe(201);
    return response.json() as Promise<{ id: string; version: number }>;
  }
  return { ...fixture, archive, call, document, person };
}
describe("human-entered private people references", () => {
  it("keeps identical names separate, uncertainty literal and originals untouched", async () => {
    const s = await setup(),
      before = JSON.stringify([...s.bucket.objects]);
    const a = await s.person(),
      b = await s.person();
    expect(a.id).not.toBe(b.id);
    const index = (await (await s.call()).json()) as {
      records: PeopleRecord[];
    };
    expect(index.records).toHaveLength(2);
    expect(
      index.records.every(
        (r) => (r.document as PersonReference).datePrecision === "approximate",
      ),
    ).toBe(true);
    expect(JSON.stringify([...s.bucket.objects])).toBe(before);
  });
  it("preserves attributed revisions and requires explicit restore after removal", async () => {
    const s = await setup(),
      p = await s.person();
    expect(
      (
        await s.call(`/person/${p.id}`, "PATCH", {
          version: 1,
          document: { ...s.document, label: "Aunt María" },
        })
      ).status,
    ).toBe(200);
    expect(
      (await s.call(`/person/${p.id}`, "DELETE", { version: 2 })).status,
    ).toBe(200);
    let result = (await (await s.call(`/person/${p.id}`)).json()) as {
      record: PeopleRecord;
      history: {
        version: number;
        active: boolean;
        document: PersonReference;
      }[];
    };
    expect(result.record.active).toBe(false);
    expect(result.history.map((h) => h.version)).toEqual([3, 2, 1]);
    expect(result.history[2].document.label).toBe("María");
    expect(result.record.authorId).toBe("owner_legacy_test");
    expect(
      (
        await s.call(`/person/${p.id}`, "PATCH", {
          version: 3,
          document: s.document,
          active: true,
        })
      ).status,
    ).toBe(200);
    result = (await (await s.call(`/person/${p.id}`)).json()) as typeof result;
    expect(result.record.active).toBe(true);
    expect(result.history).toHaveLength(4);
    expect(
      s.db.database
        .prepare("SELECT status FROM memory_stories WHERE id=?")
        .get(s.memory),
    ).toMatchObject({ status: "complete" });
  });
  it("replays retries without duplicate history and rejects stale or changed requests", async () => {
    const s = await setup(),
      key = "people_retry_create",
      body = { document: s.document };
    const first = (await (
      await s.call("/person", "POST", body, key)
    ).json()) as { id: string };
    expect(
      await (await s.call("/person", "POST", body, key)).json(),
    ).toMatchObject({ id: first.id, replayed: true });
    expect(
      (
        await s.call(
          "/person",
          "POST",
          { document: { ...s.document, label: "Other" } },
          key,
        )
      ).status,
    ).toBe(409);
    const edit = { version: 1, document: { ...s.document, label: "Changed" } };
    expect(
      (await s.call(`/person/${first.id}`, "PATCH", edit, "people_retry_edit"))
        .status,
    ).toBe(200);
    expect(
      await (
        await s.call(`/person/${first.id}`, "PATCH", edit, "people_retry_edit")
      ).json(),
    ).toMatchObject({ replayed: true, version: 2 });
    expect((await s.call(`/person/${first.id}`, "PATCH", edit)).status).toBe(
      409,
    );
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_people_history")
        .get(),
    ).toMatchObject({ n: 2 });
  });
  it("requires owner session and CSRF; unrelated accounts cannot read history or relations", async () => {
    const s = await setup(),
      p = await s.person();
    const now = new Date().toISOString();
    s.db.database
      .prepare(
        "INSERT INTO users(id,created_at,updated_at) VALUES('other_people_owner',?,?)",
      )
      .run(now, now);
    const outsider = (
      await createAppSession(s.env, "other_people_owner")
    ).cookie.split(";")[0];
    expect((await s.call("", "GET", undefined, undefined, "")).status).toBe(
      401,
    );
    expect(
      (await s.call("", "GET", undefined, undefined, outsider)).status,
    ).toBe(404);
    expect(
      (await s.call(`/person/${p.id}`, "GET", undefined, undefined, outsider))
        .status,
    ).toBe(404);
    expect(
      (
        await s.call(
          "/person",
          "POST",
          { document: s.document },
          undefined,
          s.owner,
          false,
        )
      ).status,
    ).toBe(403);
    const foreign = await addSyntheticMemory(
      s,
      "memory_people_foreign",
      "other_people_owner",
    );
    expect(
      (
        await s.call("/person", "POST", {
          document: { ...s.document, memoryIds: [foreign] },
        })
      ).status,
    ).toBe(404);
  });
  it("keeps uncertain relationships and reversible manual links separately attributed", async () => {
    const s = await setup(),
      a = await s.person(),
      b = await s.person();
    const document: RelationshipReference = {
      fromId: a.id,
      toId: b.id,
      label: "maybe my aunt",
      certainty: "uncertain",
      type: "relationship",
    };
    const relation = (await (
      await s.call("/relationship", "POST", { document })
    ).json()) as { id: string };
    let view = (await (
      await s.call(`/relationship/${relation.id}`)
    ).json()) as { record: PeopleRecord };
    expect(view.record.document).toEqual(document);
    const link = (await (
      await s.call("/relationship", "POST", {
        document: {
          ...document,
          label: "",
          type: "same_person",
          certainty: "stated",
        },
      })
    ).json()) as { id: string };
    expect(
      (await s.call(`/relationship/${link.id}`, "DELETE", { version: 1 }))
        .status,
    ).toBe(200);
    view = (await (
      await s.call(`/relationship/${link.id}`)
    ).json()) as typeof view;
    expect(view.record.active).toBe(false);
    expect(
      s.db.database
        .prepare(
          "SELECT count(*) AS n FROM family_people_records WHERE kind='person' AND active=1",
        )
        .get(),
    ).toMatchObject({ n: 2 });
    expect(
      (
        await s.call("/relationship", "POST", {
          document: { ...document, toId: a.id },
        })
      ).status,
    ).toBe(400);
  });
  it("allows unnamed/unknown references without inventing a date or identity", async () => {
    const s = await setup(),
      p = await s.person({
        ...s.document,
        label: "",
        dateText: "",
        datePrecision: "unknown",
      });
    const result = (await (await s.call(`/person/${p.id}`)).json()) as {
      record: PeopleRecord;
    };
    expect(result.record.document).toMatchObject({
      label: "",
      dateText: "",
      datePrecision: "unknown",
    });
    expect(
      (
        await s.call("/person", "POST", {
          document: { ...s.document, datePrecision: "unknown" },
        })
      ).status,
    ).toBe(400);
  });
});
