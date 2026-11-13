/// <reference types="@cloudflare/workers-types" />
import { describe, expect, it, afterEach } from "vitest";
import { TestD1, TestR2 } from "../helpers/legacy-runtime";
import { createAppSession } from "../../worker/auth-session";
import { handleLegacySessionRoute } from "../../worker/legacy-sessions";
import { handleDeletionRoute } from "../../worker/deletion";
import { legacyConsentVersion } from "../../app/domain/our-living-legacy";
const databases: TestD1[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
async function setup() {
  const db = new TestD1(),
    bucket = new TestR2();
  databases.push(db);
  const env = {
    DB: db as unknown as D1Database,
    MEDIA_BUCKET: bucket as unknown as R2Bucket,
    SESSION_SECRET: "synthetic-legacy-secret-".repeat(3),
  };
  const now = new Date().toISOString(),
    user = "owner_legacy_test",
    memory = "memory_legacy_test";
  db.database
    .prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)")
    .run(user, now, now);
  db.database
    .prepare("INSERT INTO story_entitlements(user_id,updated_at) VALUES(?,?)")
    .run(user, now);
  db.database
    .prepare(
      "INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,'complete','en-US',?,?,'2099-01-01T00:00:00Z')",
    )
    .run(memory, user, now, now);
  db.database
    .prepare(
      "INSERT INTO memory_stories(id,owner_user_id,status,created_at,updated_at) VALUES(?,?,'draft',?,?)",
    )
    .run(memory, user, now, now);
  for (const role of ["original_photo", "original_audio"]) {
    const id = `asset_legacy_${role}`;
    db.database
      .prepare(
        "INSERT INTO media_assets(id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,sha256,r2_etag,durability_status,created_at) VALUES(?,?,?,?,?,?,4,?,'etag','durable',?)",
      )
      .run(
        id,
        memory,
        memory,
        role,
        id,
        role === "original_photo" ? "image/png" : "audio/webm",
        "a".repeat(64),
        now,
      );
    await bucket.put(id, new Uint8Array([1, 2, 3, 4]).buffer);
  }
  db.database
    .prepare(
      "UPDATE memory_stories SET status='complete',completed_at=?,primary_photo_asset_id='asset_legacy_original_photo',primary_audio_asset_id='asset_legacy_original_audio' WHERE id=?",
    )
    .run(now, memory);
  const owner = (await createAppSession(env, user)).cookie.split(";")[0]!;
  async function call(
    path = "",
    method = "GET",
    body?: unknown,
    cookie = owner,
    key = "legacy_request_001",
  ) {
    return (await handleLegacySessionRoute(
      new Request(`https://example.test/resources/legacy-sessions${path}`, {
        method,
        headers: {
          Cookie: cookie,
          "X-Memories-Request": "legacy-v1",
          "X-Idempotency-Key": key,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    ))!;
  }
  async function create() {
    const response = await call("", "POST", {
      memoryId: memory,
      displayName: "Host",
      mode: "remote",
    });
    expect(response.status).toBe(201);
    return (await response.json()) as { sessionId: string; joinPath: string };
  }
  async function join(id: string, path: string, key = "legacy_guest_join_001") {
    return call(
      `/${id}/join`,
      "POST",
      { displayName: "Guest", inviteToken: path.split("#")[1] },
      "",
      key,
    );
  }
  return { db, bucket, env, owner, memory, call, create, join };
}
describe("private two-person Legacy sessions", () => {
  it("pins an owned preserved photo and returns the same invitation for an exact creation retry", async () => {
    const s = await setup(),
      created = await s.create();
    expect(await (await s.call(`?memoryId=${s.memory}`)).json()).toMatchObject({
      sessions: [{ id: created.sessionId }],
    });
    expect(
      (await s.call(`?memoryId=${s.memory}`, "GET", undefined, "")).status,
    ).toBe(401);
    const retry = await s.call("", "POST", {
      memoryId: s.memory,
      displayName: "Host",
      mode: "remote",
    });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ ...created, replayed: true });
    const changed = await s.call("", "POST", {
      memoryId: s.memory,
      displayName: "Different",
      mode: "remote",
    });
    expect(changed.status).toBe(409);
    expect(
      await (await s.call(`/${created.sessionId}/invitation`)).json(),
    ).toEqual({ joinPath: created.joinPath });
    expect(
      (await s.call(`/${created.sessionId}/photo`)).headers.get(
        "Cache-Control",
      ),
    ).toContain("no-store");
    expect(
      (await s.call(`/${created.sessionId}/photo`, "GET", undefined, ""))
        .status,
    ).toBe(403);
    expect(() =>
      s.db.database.exec(
        "UPDATE legacy_sessions SET photo_asset_id='other_photo'",
      ),
    ).toThrow(/immutable/);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS count FROM legacy_participants")
        .get(),
    ).toMatchObject({ count: 2 });
  });
  it("consumes a scoped invitation once while allowing a lost-response retry", async () => {
    const s = await setup(),
      c = await s.create(),
      joined = await s.join(c.sessionId, c.joinPath);
    expect(joined.status).toBe(200);
    const cookie = joined.headers.get("Set-Cookie")!.split(";")[0]!;
    expect(joined.headers.get("Set-Cookie")).toContain(
      "HttpOnly; Secure; SameSite=Strict",
    );
    const retry = await s.join(c.sessionId, c.joinPath);
    expect(retry.status).toBe(200);
    expect(retry.headers.get("Set-Cookie")!.split(";")[0]).toBe(cookie);
    expect(
      (await s.join(c.sessionId, c.joinPath, "another_join_request")).status,
    ).toBe(409);
    const view = (await (
      await s.call(`/${c.sessionId}?as=guest`, "GET", undefined, cookie)
    ).json()) as { actorRole: string; canRecord: boolean };
    expect(view).toMatchObject({ actorRole: "guest", canRecord: false });
    expect(
      (await s.call(`/${c.sessionId}/photo?as=guest`, "GET", undefined, cookie))
        .status,
    ).toBe(200);
    expect(await (await s.call(`/${c.sessionId}/invitation`)).json()).toEqual({
      joinPath: null,
    });
    expect(
      (
        await s.call(
          `/${c.sessionId}/invitation?as=guest`,
          "GET",
          undefined,
          cookie,
        )
      ).status,
    ).toBe(403);
  });
  it("requires each participant's own choice and removes guest pixels immediately on revocation", async () => {
    const s = await setup(),
      c = await s.create(),
      joined = await s.join(c.sessionId, c.joinPath),
      cookie = joined.headers.get("Set-Cookie")!.split(";")[0]!;
    const host = (await (await s.call(`/${c.sessionId}`)).json()) as {
      actorId: string;
      participants: { id: string; role: string }[];
    };
    const guest = host.participants.find((p) => p.role === "guest")!;
    expect(
      (
        await s.call(
          `/${c.sessionId}/consent?as=guest`,
          "POST",
          {
            agree: true,
            version: legacyConsentVersion,
            participantId: host.actorId,
          },
          cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await s.call(`/${c.sessionId}/consent`, "POST", {
          agree: true,
          version: legacyConsentVersion,
        })
      ).status,
    ).toBe(200);
    expect(await (await s.call(`/${c.sessionId}`)).json()).toMatchObject({
      canRecord: false,
    });
    expect(
      (
        await s.call(
          `/${c.sessionId}/consent?as=guest`,
          "POST",
          { agree: true, version: legacyConsentVersion },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(await (await s.call(`/${c.sessionId}`)).json()).toMatchObject({
      canRecord: true,
    });
    await s.call(
      `/${c.sessionId}/consent?as=guest`,
      "POST",
      { agree: true, version: legacyConsentVersion },
      cookie,
    );
    expect(
      s.db.database
        .prepare("SELECT count(*) AS count FROM legacy_consent_events")
        .get(),
    ).toMatchObject({ count: 2 });
    expect(() =>
      s.db.database.exec(
        "UPDATE legacy_consent_events SET decision='declined'",
      ),
    ).toThrow(/immutable/);
    expect(
      (
        await s.call(
          `/${c.sessionId}/revoke?as=guest`,
          "POST",
          { participantId: guest.id },
          cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await s.call(`/${c.sessionId}/revoke`, "POST", {
          participantId: guest.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (await s.call(`/${c.sessionId}/photo?as=guest`, "GET", undefined, cookie))
        .status,
    ).toBe(403);
    expect(
      (await s.call(`/${c.sessionId}?as=guest`, "GET", undefined, cookie))
        .status,
    ).toBe(403);
    expect(await (await s.call(`/${c.sessionId}`)).json()).toMatchObject({
      canRecord: false,
    });
  });
  it("expires unconsumed invitations and rejects foreign photo selection and foreign account creation", async () => {
    const s = await setup(),
      c = await s.create();
    s.db.database.exec(
      "UPDATE legacy_participants SET invite_expires_at='2000-01-01T00:00:00Z' WHERE role='guest'",
    );
    expect((await s.join(c.sessionId, c.joinPath)).status).toBe(403);
    expect(
      (
        await s.call(
          "",
          "POST",
          {
            memoryId: s.memory,
            displayName: "Host",
            mode: "remote",
            photoAssetId: "asset_legacy_original_audio",
          },
          s.owner,
          "legacy_invalid_photo",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await s.call(
          "",
          "POST",
          { memoryId: s.memory, displayName: "Host", mode: "remote" },
          "",
          "legacy_anonymous_create",
        )
      ).status,
    ).toBe(401);
  });
  it("withdraws consent and deletes the memory with its participant access and photo", async () => {
    const s = await setup(),
      c = await s.create(),
      joined = await s.join(c.sessionId, c.joinPath),
      cookie = joined.headers.get("Set-Cookie")!.split(";")[0]!;
    for (const actor of [s.owner, cookie])
      expect(
        (
          await s.call(
            `/${c.sessionId}/consent`,
            "POST",
            { agree: true, version: legacyConsentVersion },
            actor,
          )
        ).status,
      ).toBe(200);
    expect(await (await s.call(`/${c.sessionId}`)).json()).toMatchObject({
      canRecord: true,
    });
    await s.call(
      `/${c.sessionId}/consent`,
      "POST",
      { agree: false, version: legacyConsentVersion },
      cookie,
    );
    expect(await (await s.call(`/${c.sessionId}`)).json()).toMatchObject({
      canRecord: false,
    });
    const deleted = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(deleted!.status).toBe(200);
    expect(
      (await s.call(`/${c.sessionId}/photo`, "GET", undefined, cookie)).status,
    ).toBe(404);
    expect(s.bucket.objects.size).toBe(0);
  });
});
