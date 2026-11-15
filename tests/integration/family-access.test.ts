/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setupLegacyFixture,
  addSyntheticMemory,
} from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleArchiveRoute } from "../../worker/archive-routes";
import { handleFamilyAccessRoute } from "../../worker/family-access-routes";
import {
  activeFamilyGrant,
  grantAllowsMemory,
} from "../../worker/family-permissions";
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});
async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const now = new Date().toISOString();
  for (const user of ["family_intended_user", "family_wrong_user"])
    s.db.database
      .prepare(
        "INSERT INTO users(id,email,created_at,updated_at) VALUES(?,?,?,?)",
      )
      .run(user, `${user}@example.test`, now, now);
  const intended = (
      await createAppSession(s.env, "family_intended_user")
    ).cookie.split(";")[0],
    wrong = (await createAppSession(s.env, "family_wrong_user")).cookie.split(
      ";",
    )[0];
  const verify = vi.fn(
    async (_env: unknown, user: string, email: string) =>
      user === "family_intended_user" && email === "intended@example.test",
  );
  async function archiveCall(path: string, body: unknown, method = "POST") {
    return (await handleArchiveRoute(
      new Request(`https://example.test/resources/family-archives${path}`, {
        method,
        headers: {
          Cookie: s.owner,
          "X-Memories-Request": "family-v1",
          "X-Idempotency-Key": `archive_${crypto.randomUUID()}`,
        },
        body: JSON.stringify(body),
      }),
      s.env,
    ))!;
  }
  const archive = (await (
    await archiveCall("/archives", { title: "Family scope" })
  ).json()) as { id: string };
  async function call(
    path = "",
    method = "GET",
    body?: unknown,
    cookie = s.owner,
    key = `family_access_${crypto.randomUUID()}`,
    csrf = true,
  ) {
    return (await handleFamilyAccessRoute(
      new Request(`https://example.test/resources/family-access${path}`, {
        method,
        headers: {
          Cookie: cookie,
          "X-Idempotency-Key": key,
          ...(csrf ? { "X-Memories-Request": "family-v1" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      s.env,
      verify,
    ))!;
  }
  const body = {
    archiveId: archive.id,
    scopeKind: "memory",
    scopeId: s.memory,
    role: "viewer",
    targetEmail: "intended@example.test",
  };
  async function invite(overrides = {}) {
    const response = await call("/grants", "POST", { ...body, ...overrides });
    expect(response.status).toBe(201);
    return response.json() as Promise<{
      id: string;
      joinPath: string;
      version: number;
    }>;
  }
  const accept = (invite: { joinPath: string }, cookie = intended) =>
    call(
      `/invite/${invite.joinPath.split("/").at(-1)}/accept`,
      "POST",
      {},
      cookie,
    );
  return {
    ...s,
    archive,
    body,
    intended,
    wrong,
    verify,
    call,
    invite,
    accept,
    archiveCall,
  };
}
describe("least-privilege family invitations", () => {
  it("a copied invitation is only a preview until the intended verified account accepts", async () => {
    const s = await setup(),
      g = await s.invite(),
      token = g.joinPath.split("/").at(-1);
    expect(
      await (await s.call(`/invite/${token}`, "GET", undefined, "")).json(),
    ).toMatchObject({ role: "viewer", scopeKind: "memory" });
    expect((await s.accept(g, "")).status).toBe(401);
    expect((await s.accept(g, s.wrong)).status).toBe(403);
    expect(
      s.db.database
        .prepare("SELECT state FROM family_access_grants WHERE id=?")
        .get(g.id),
    ).toMatchObject({ state: "pending" });
    expect((await s.accept(g)).status).toBe(200);
    expect(await (await s.accept(g)).json()).toMatchObject({
      id: g.id,
      replayed: true,
    });
    expect((await s.accept(g, s.wrong)).status).toBe(403);
    expect(
      s.db.database
        .prepare(
          "SELECT accepted_by_user_id FROM family_access_grants WHERE id=?",
        )
        .get(g.id),
    ).toMatchObject({ accepted_by_user_id: "family_intended_user" });
  });
  it("selected-memory membership never grants the owners other personal memories", async () => {
    const s = await setup(),
      second = await addSyntheticMemory(s),
      g = await s.invite();
    await s.accept(g);
    const view = (await (
      await s.call(`/memberships/${g.id}/view`, "GET", undefined, s.intended)
    ).json()) as { memories: { id: string }[] };
    expect(view.memories.map((m) => m.id)).toEqual([s.memory]);
    const memberList = (await (
      await s.call("/memberships", "GET", undefined, s.intended)
    ).json()) as { memberships: { id: string }[] };
    expect(memberList.memberships.map((m) => m.id)).toEqual([g.id]);
    const secondAsset = s.db.database
      .prepare("SELECT primary_audio_asset_id FROM memory_stories WHERE id=?")
      .get(second) as { primary_audio_asset_id: string };
    expect(
      (
        await s.call(
          `/memberships/${g.id}/media/${secondAsset.primary_audio_asset_id}`,
          "GET",
          undefined,
          s.intended,
        )
      ).status,
    ).toBe(403);
    const grant = await activeFamilyGrant(s.env, "family_intended_user", g.id);
    expect(grant).not.toBeNull();
    expect(await grantAllowsMemory(s.env, grant!, second)).toBe(false);
    expect(
      await activeFamilyGrant(s.env, "family_intended_user", g.id, true),
    ).toBeNull();
    expect(
      (await s.call(`/memberships/${g.id}/view`, "GET", undefined, s.wrong))
        .status,
    ).toBe(403);
  });
  it("revocation denies a previously valid private media URL and leaves sources intact", async () => {
    const s = await setup(),
      g = await s.invite();
    await s.accept(g);
    const original = [...s.bucket.objects.keys()];
    const view = (await (
      await s.call(`/memberships/${g.id}/view`, "GET", undefined, s.intended)
    ).json()) as { memories: { photoUrl: string; audioUrl: string }[] };
    expect(view.memories[0].audioUrl).toBeTruthy();
    const suffix = view.memories[0].audioUrl.replace(
      "/resources/family-access",
      "",
    );
    expect((await s.call(suffix, "GET", undefined, s.intended)).status).toBe(
      200,
    );
    expect(
      (await s.call(`/grants/${g.id}/revoke`, "POST", { version: 2 })).status,
    ).toBe(200);
    expect((await s.call(suffix, "GET", undefined, s.intended)).status).toBe(
      403,
    );
    expect(
      (await s.call(`/memberships/${g.id}/view`, "GET", undefined, s.intended))
        .status,
    ).toBe(403);
    expect([...s.bucket.objects.keys()]).toEqual(original);
    expect(
      s.db.database
        .prepare(
          "SELECT action FROM family_access_events WHERE grant_id=? ORDER BY version",
        )
        .all(g.id)
        .map((r) => r.action),
    ).toEqual(["invited", "accepted", "revoked"]);
  });
  it("expiry blocks acceptance, and provider outage preserves the pending invitation", async () => {
    const s = await setup(),
      g = await s.invite();
    s.verify.mockRejectedValueOnce(new Error("PRIVATE_PROVIDER_CANARY"));
    const response = await s.accept(g);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_PROVIDER_CANARY");
    s.db.database
      .prepare(
        "UPDATE family_access_grants SET expires_at='2000-01-01T00:00:00Z' WHERE id=?",
      )
      .run(g.id);
    expect((await s.accept(g)).status).toBe(404);
    expect(
      s.db.database
        .prepare("SELECT state FROM family_access_grants WHERE id=?")
        .get(g.id),
    ).toMatchObject({ state: "pending" });
  });
  it("creation is idempotent without storing raw join links, and changed retries conflict", async () => {
    const s = await setup(),
      key = "invitation_same_retry";
    const first = (await (
      await s.call("/grants", "POST", s.body, undefined, key)
    ).json()) as { id: string; joinPath: string };
    expect(
      await (await s.call("/grants", "POST", s.body, undefined, key)).json(),
    ).toMatchObject({ ...first, replayed: true });
    expect(
      (
        await s.call(
          "/grants",
          "POST",
          { ...s.body, role: "contributor" },
          undefined,
          key,
        )
      ).status,
    ).toBe(409);
    const stored = s.db.database
      .prepare(
        "SELECT * FROM operation_receipts WHERE operation_kind='family_invite_create'",
      )
      .all();
    expect(JSON.stringify(stored)).not.toContain(
      first.joinPath.split("/").at(-1),
    );
    expect(
      (await s.call(`/grants/${first.id}/revoke`, "POST", { version: 1 }))
        .status,
    ).toBe(200);
    const revokedRetry = await s.call(
      "/grants",
      "POST",
      s.body,
      undefined,
      key,
    );
    expect(revokedRetry.status).toBe(409);
    expect(await revokedRetry.json()).toMatchObject({
      error: { code: "family_invitation_inactive" },
    });
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_access_grants")
        .get(),
    ).toMatchObject({ n: 1 });
  });
  it("Chapter/Archive access follows only current references and contributor authority stays scoped", async () => {
    const s = await setup(),
      second = await addSyntheticMemory(s);
    const c = (await (
      await s.archiveCall("/chapters", {
        archiveId: s.archive.id,
        title: "Chosen chapter",
      })
    ).json()) as { id: string };
    await s.archiveCall(
      `/chapters/${c.id}`,
      { version: 1, memoryIds: [s.memory] },
      "PATCH",
    );
    const g = await s.invite({
      scopeKind: "chapter",
      scopeId: c.id,
      role: "contributor",
    });
    await s.accept(g);
    const grant = await activeFamilyGrant(
      s.env,
      "family_intended_user",
      g.id,
      true,
    );
    expect(grant).not.toBeNull();
    expect(await grantAllowsMemory(s.env, grant!, s.memory)).toBe(true);
    expect(await grantAllowsMemory(s.env, grant!, second)).toBe(false);
    await s.archiveCall(
      `/chapters/${c.id}`,
      { version: 2, memoryIds: [] },
      "PATCH",
    );
    expect(await grantAllowsMemory(s.env, grant!, s.memory)).toBe(false);
    const view = (await (
      await s.call(`/memberships/${g.id}/view`, "GET", undefined, s.intended)
    ).json()) as { memories: unknown[] };
    expect(view.memories).toEqual([]);
    const a = await s.invite({ scopeKind: "archive", scopeId: s.archive.id });
    await s.accept(a);
    expect(
      await grantAllowsMemory(
        s.env,
        (await activeFamilyGrant(s.env, "family_intended_user", a.id))!,
        second,
      ),
    ).toBe(false);
  });
  it("owners alone can enumerate/revoke invitations and CSRF is enforced", async () => {
    const s = await setup(),
      g = await s.invite();
    expect(
      (
        await s.call(
          `/grants?archiveId=${s.archive.id}`,
          "GET",
          undefined,
          s.wrong,
        )
      ).status,
    ).toBe(404);
    expect(
      (await s.call(`/grants/${g.id}/revoke`, "POST", { version: 1 }, s.wrong))
        .status,
    ).toBe(404);
    expect(
      (await s.call("/grants", "POST", s.body, undefined, undefined, false))
        .status,
    ).toBe(403);
    const list = await (
      await s.call(`/grants?archiveId=${s.archive.id}`)
    ).text();
    expect(list).not.toContain("token_hash");
    expect(list).not.toContain(g.joinPath.split("/").at(-1));
  });
});
