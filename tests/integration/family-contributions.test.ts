/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setupLegacyFixture,
  addSyntheticMemory,
} from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleFamilyContributionRoute } from "../../worker/family-contributions";
import type { FamilyContribution } from "../../app/domain/family-contribution";
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const now = new Date().toISOString(),
    archive = "family_contribution_archive";
  s.db.database
    .prepare(
      "INSERT INTO family_archives(id,owner_user_id,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    )
    .run(archive, "owner_legacy_test", "Synthetic family", "", now, now);
  const cookies: Record<string, string> = { owner: s.owner },
    grants: Record<string, string> = {};
  for (const user of ["contributor_a", "contributor_b", "viewer_family"]) {
    s.db.database
      .prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)")
      .run(user, now, now);
    cookies[user] = (await createAppSession(s.env, user)).cookie.split(";")[0];
    const grant = `grant_${user}`;
    grants[user] = grant;
    s.db.database
      .prepare(
        "INSERT INTO family_access_grants(id,archive_id,owner_user_id,role,scope_kind,scope_id,target_email,token_hash,state,accepted_by_user_id,accepted_at,expires_at,created_at,updated_at) VALUES(?,?,?,?,'memory',?,?,?,'accepted',?,?,'2099-01-01T00:00:00Z',?,?)",
      )
      .run(
        grant,
        archive,
        "owner_legacy_test",
        user === "viewer_family" ? "viewer" : "contributor",
        s.memory,
        `${user}@example.test`,
        `hash_${user}`,
        user,
        now,
        now,
        now,
      );
  }
  async function call(
    actor = "owner",
    path = "",
    method = "GET",
    body?: unknown,
    key = `contribution_key_${crypto.randomUUID()}`,
    csrf = true,
    memoryId = s.memory,
  ) {
    return (await handleFamilyContributionRoute(
      new Request(
        `https://example.test/resources/family-contributions/${memoryId}${path}${grants[actor] ? `${path.includes("?") ? "&" : "?"}grantId=${grants[actor]}` : ""}`,
        {
          method,
          headers: {
            Cookie: cookies[actor] ?? "",
            "X-Idempotency-Key": key,
            ...(csrf ? { "X-Memories-Request": "family-v1" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      ),
      s.env,
    ))!;
  }
  async function list(actor = "owner") {
    const response = await call(actor);
    expect(response.status).toBe(200);
    return ((await response.json()) as { contributions: FamilyContribution[] })
      .contributions;
  }
  async function submit(
    actor = "contributor_a",
    text = "I remember May 1950",
    key?: string,
  ) {
    const response = await call(
      actor,
      "",
      "POST",
      {
        attribution: actor,
        text,
        agree: true,
        agreementVersion: "family-contribution-review-v1",
      },
      key,
    );
    expect(response.status).toBe(201);
    return response.json() as Promise<{ id: string; version: number }>;
  }
  async function include(id: string, version: number, revisionId: string) {
    return call("owner", `/${id}/assembly`, "POST", {
      version,
      include: true,
      revisionId,
    });
  }
  return {
    ...s,
    fixture: s,
    cookies,
    grants,
    archive,
    call,
    list,
    submit,
    include,
  };
}
describe("independent family recollections", () => {
  it("preserves different human accounts side by side after explicit owner inclusion", async () => {
    const s = await setup(),
      before = JSON.stringify([...s.bucket.objects]);
    await s.submit("contributor_a", "I remember May 1950");
    await s.submit("contributor_b", "I remember June 1951");
    expect(await s.list("viewer_family")).toEqual([]);
    const pending = await s.list();
    expect(pending).toHaveLength(2);
    for (const item of pending)
      expect(
        (await s.include(item.id, item.version, item.revision.id)).status,
      ).toBe(200);
    const assembled = await s.list("viewer_family");
    expect(assembled.map((c) => c.revision.text).sort()).toEqual([
      "I remember June 1951",
      "I remember May 1950",
    ]);
    expect(assembled.map((c) => c.revision.attribution).sort()).toEqual([
      "contributor_a",
      "contributor_b",
    ]);
    expect(JSON.stringify([...s.bucket.objects])).toBe(before);
  });
  it("only the author can revise; an included version stays pinned until owner review", async () => {
    const s = await setup(),
      created = await s.submit(),
      first = (await s.list())[0];
    await s.include(created.id, 1, first.revision.id);
    expect(
      (
        await s.call("owner", `/${created.id}/revise`, "POST", {
          version: 2,
          attribution: "Owner",
          text: "Replaced by owner",
          agree: true,
          agreementVersion: "family-contribution-review-v1",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await s.call("contributor_b", `/${created.id}/revise`, "POST", {
          version: 2,
          attribution: "Other",
          text: "Other replacement",
          agree: true,
          agreementVersion: "family-contribution-review-v1",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await s.call("contributor_a", `/${created.id}/revise`, "POST", {
          version: 2,
          attribution: "My own name",
          text: "I now remember around 1951",
          agree: true,
          agreementVersion: "family-contribution-review-v1",
        })
      ).status,
    ).toBe(200);
    expect((await s.list("viewer_family"))[0].revision.text).toBe(
      "I remember May 1950",
    );
    const latest = (await s.list())[0];
    expect(latest.revision.text).toBe("I now remember around 1951");
    await s.include(created.id, 3, latest.revision.id);
    expect((await s.list("viewer_family"))[0].revision.text).toBe(
      "I now remember around 1951",
    );
    const history = (await (
      await s.call("contributor_a", `/${created.id}/history`)
    ).json()) as { revisions: { text: string }[] };
    expect(history.revisions.map((r) => r.text).sort()).toEqual(
      ["I now remember around 1951", "I remember May 1950"].sort(),
    );
    expect(
      s.db.database
        .prepare(
          "SELECT human_text FROM family_contribution_revisions WHERE id=?",
        )
        .get(first.revision.id),
    ).toMatchObject({ human_text: "I remember May 1950" });
  });
  it("denies viewers, unrelated scopes, absent consent, missing sessions and CSRF", async () => {
    const s = await setup(),
      body = {
        attribution: "Viewer",
        text: "A recollection",
        agree: true,
        agreementVersion: "family-contribution-review-v1",
      };
    expect((await s.call("viewer_family", "", "POST", body)).status).toBe(403);
    expect((await s.call("missing")).status).toBe(401);
    expect(
      (await s.call("contributor_a", "", "POST", { ...body, agree: false }))
        .status,
    ).toBe(400);
    expect(
      (await s.call("contributor_a", "", "POST", body, undefined, false))
        .status,
    ).toBe(403);
    expect(
      (
        await s.call("contributor_a", "", "POST", {
          ...body,
          agreementVersion: "retired-choice-v0",
        })
      ).status,
    ).toBe(400);
    const second = await addSyntheticMemory(s.fixture);
    expect(
      (await s.call("contributor_a", "", "POST", body, undefined, true, second))
        .status,
    ).toBe(403);
  });
  it("replays submission/revision without duplicating sources and rejects changed or stale retries", async () => {
    const s = await setup(),
      key = "contribution_same_key";
    const a = await s.submit("contributor_a", "Uncertain memory", key);
    expect(
      await (
        await s.call(
          "contributor_a",
          "",
          "POST",
          {
            attribution: "contributor_a",
            text: "Uncertain memory",
            agree: true,
            agreementVersion: "family-contribution-review-v1",
          },
          key,
        )
      ).json(),
    ).toMatchObject({ id: a.id, replayed: true });
    expect(
      (
        await s.call(
          "contributor_a",
          "",
          "POST",
          {
            attribution: "contributor_a",
            text: "Different",
            agree: true,
            agreementVersion: "family-contribution-review-v1",
          },
          key,
        )
      ).status,
    ).toBe(409);
    const body = {
      version: 1,
      attribution: "My name",
      text: "My revised recollection",
      agree: true,
      agreementVersion: "family-contribution-review-v1",
    };
    expect(
      (
        await s.call(
          "contributor_a",
          `/${a.id}/revise`,
          "POST",
          body,
          "contribution_revision_retry",
        )
      ).status,
    ).toBe(200);
    expect(
      await (
        await s.call(
          "contributor_a",
          `/${a.id}/revise`,
          "POST",
          body,
          "contribution_revision_retry",
        )
      ).json(),
    ).toMatchObject({ replayed: true, version: 2 });
    expect(
      (await s.call("contributor_a", `/${a.id}/revise`, "POST", body)).status,
    ).toBe(409);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_contribution_revisions")
        .get(),
    ).toMatchObject({ n: 2 });
  });
  it("withdrawal hides the family assembly and keeps attributable source history", async () => {
    const s = await setup(),
      a = await s.submit(),
      first = (await s.list())[0];
    await s.include(a.id, 1, first.revision.id);
    expect(
      (
        await s.call("contributor_b", `/${a.id}/withdraw`, "POST", {
          version: 2,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await s.call("contributor_a", `/${a.id}/withdraw`, "POST", {
          version: 2,
        })
      ).status,
    ).toBe(200);
    expect(await s.list("viewer_family")).toEqual([]);
    expect((await s.list())[0]).toMatchObject({
      authorState: "withdrawn",
      includedRevisionId: null,
    });
    expect((await s.include(a.id, 3, first.revision.id)).status).toBe(409);
  });
  it("revocation hides a contribution from family without deleting owner-preserved history", async () => {
    const s = await setup(),
      a = await s.submit(),
      first = (await s.list())[0];
    await s.include(a.id, 1, first.revision.id);
    s.db.database
      .prepare(
        "UPDATE family_access_grants SET state='revoked',version=version+1 WHERE id=?",
      )
      .run(s.grants.contributor_a);
    expect((await s.call("contributor_a")).status).toBe(403);
    expect(await s.list("viewer_family")).toEqual([]);
    expect((await s.list())[0].revision.text).toBe(first.revision.text);
    expect(
      (
        await s.call("contributor_a", `/${a.id}/withdraw`, "POST", {
          version: 2,
        })
      ).status,
    ).toBe(200);
  });
  it("owner exclusion never rewrites testimony and private history is not a family side channel", async () => {
    const s = await setup(),
      a = await s.submit(),
      first = (await s.list())[0];
    await s.include(a.id, 1, first.revision.id);
    expect((await s.call("viewer_family", `/${a.id}/history`)).status).toBe(
      403,
    );
    expect(
      (
        await s.call("owner", `/${a.id}/assembly`, "POST", {
          version: 2,
          include: false,
        })
      ).status,
    ).toBe(200);
    expect(await s.list("viewer_family")).toEqual([]);
    expect((await s.list())[0].revision.text).toBe(first.revision.text);
  });
  it("checks revocation inside the batch before any source/receipt is created", async () => {
    const s = await setup(),
      execute = s.db.batch.bind(s.db);
    vi.spyOn(s.db, "batch").mockImplementation(async (statements) => {
      s.db.database
        .prepare("UPDATE family_access_grants SET state='revoked' WHERE id=?")
        .run(s.grants.contributor_a);
      return execute(statements);
    });
    expect(
      (
        await s.call("contributor_a", "", "POST", {
          attribution: "My name",
          text: "Unsent after access changed",
          agree: true,
          agreementVersion: "family-contribution-review-v1",
        })
      ).status,
    ).toBe(403);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_contribution_revisions")
        .get(),
    ).toMatchObject({ n: 0 });
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_contribution_events")
        .get(),
    ).toMatchObject({ n: 0 });
  });
  it("keeps original human text, author identity and revision lineage immutable", async () => {
    const s = await setup(),
      a = await s.submit();
    const initial = (await s.list())[0];
    expect(
      s.db.database
        .prepare(
          "SELECT agreement_version FROM family_contribution_revisions WHERE id=?",
        )
        .get(initial.revision.id),
    ).toMatchObject({ agreement_version: "family-contribution-review-v1" });

    expect(() =>
      s.db.database
        .prepare(
          "UPDATE family_contribution_revisions SET human_text=? WHERE id=?",
        )
        .run("Replaced text", initial.revision.id),
    ).toThrow();
    expect(() =>
      s.db.database
        .prepare("UPDATE family_contributions SET author_user_id=? WHERE id=?")
        .run("contributor_b", a.id),
    ).toThrow();
    expect(
      (
        await s.call("contributor_a", `/${a.id}/revise`, "POST", {
          version: 1,
          attribution: "My name",
          text: "A new recollection",
          agree: true,
          agreementVersion: "family-contribution-review-v1",
        })
      ).status,
    ).toBe(200);
    const history = (await (
      await s.call("contributor_a", `/${a.id}/history`)
    ).json()) as {
      revisions: { id: string; previousRevisionId: string | null }[];
    };
    expect(
      history.revisions.find((v) => v.id !== initial.revision.id)
        ?.previousRevisionId,
    ).toBe(initial.revision.id);
  });
  it("paginates preserved revisions without omitting the original source", async () => {
    const s = await setup(),
      source = await s.submit();
    for (let version = 1; version <= 12; version++)
      expect(
        (
          await s.call("contributor_a", `/${source.id}/revise`, "POST", {
            version,
            attribution: "My name",
            text: `My recollection revision ${version}`,
            agree: true,
            agreementVersion: "family-contribution-review-v1",
          })
        ).status,
      ).toBe(200);
    const texts: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await s.call(
        "contributor_a",
        `/${source.id}/history${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
      );
      expect(response.status).toBe(200);
      const page = (await response.json()) as {
        revisions: { text: string }[];
        nextCursor: string | null;
      };
      texts.push(...page.revisions.map((v) => v.text));
      cursor = page.nextCursor;
    } while (cursor);
    expect(texts).toHaveLength(13);
    expect(new Set(texts).size).toBe(13);
    expect(texts).toContain("I remember May 1950");
  });
});
