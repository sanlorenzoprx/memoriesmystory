/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { addSyntheticMemory, setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleArchiveRoute } from "../../worker/archive-routes";
import { handleFamilyAccessRoute } from "../../worker/family-access-routes";
import type { FamilyArchiveIndex } from "../../app/domain/family-archive";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});

async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const db = s.db.database,
    now = "2026-11-15T00:00:00.000Z",
    owner = "owner_legacy_test",
    ownerAlbum = "family_owner_album",
    other = await addSyntheticMemory(s, "memory_album_outside");
  db.prepare("INSERT INTO family_archives(id,owner_user_id,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(ownerAlbum, owner, "Owner's album", "", now, now);
  const cookies: Record<string, string> = { owner: s.owner },
    grants: Record<string, string> = {};
  for (const [user, state] of [["relative_a", "accepted"], ["relative_b", "accepted"], ["relative_pending", "pending"], ["album_stranger", ""]] as const) {
    db.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run(user, now, now);
    cookies[user] = (await createAppSession(s.env, user)).cookie.split(";")[0];
    if (!state) continue;
    grants[user] = `grant_${user}`;
    db.prepare(
      "INSERT INTO family_access_grants(id,archive_id,owner_user_id,role,scope_kind,scope_id,target_email,token_hash,state,accepted_by_user_id,accepted_at,expires_at,created_at,updated_at) VALUES(?,?,?,'viewer','memory',?,?,?,?,?,?,'2099-01-01T00:00:00Z',?,?)",
    ).run(grants[user], ownerAlbum, owner, s.memory, `${user}@example.test`, `hash_${user}`, state, state === "accepted" ? user : null, state === "accepted" ? now : null, now, now);
  }
  async function albums(actor: string, path = "", method = "GET", body?: unknown, grant?: string) {
    return (await handleArchiveRoute(
      new Request(`https://example.test/resources/family-archives${path}${grant ? `${path.includes("?") ? "&" : "?"}grantId=${grant}` : ""}`, {
        method,
        headers: { Cookie: cookies[actor] ?? "", "X-Memories-Request": "family-v1", "X-Idempotency-Key": `album_key_${crypto.randomUUID()}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      s.env,
    ))!;
  }
  const permit = async (actor: string, grant: string, allow: boolean) =>
    (await handleFamilyAccessRoute(
      new Request(`https://example.test/resources/family-access/grants/${grant}/album-permission`, {
        method: "POST",
        headers: { Cookie: cookies[actor] ?? "", "X-Memories-Request": "family-v1" },
        body: JSON.stringify({ allow }),
      }),
      s.env,
    ))!;
  const index = async (actor: string, grant?: string) => (await (await albums(actor, "", "GET", undefined, grant)).json()) as FamilyArchiveIndex;
  return { ...s, db, other, ownerAlbum, grants, albums, permit, index };
}

describe("owner-granted permission for a relative to organize albums", () => {
  it("is off until the owner turns it on for that person, and only the owner can", async () => {
    const s = await setup(),
      grant = s.grants.relative_a;
    expect((await s.albums("relative_a", "", "GET", undefined, grant)).status).toBe(403);
    expect((await s.albums("relative_a", "/archives", "POST", { title: "Vacations" }, grant)).status).toBe(403);
    // Not the relative, not another relative, not a stranger.
    for (const actor of ["relative_a", "relative_b", "album_stranger"])
      expect((await s.permit(actor, grant, true)).status).toBe(404);
    // Not for an invitation nobody has accepted.
    expect((await s.permit("owner", s.grants.relative_pending, true)).status).toBe(409);
    const allowed = await s.permit("owner", grant, true);
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ canOrganizeAlbums: true });
    expect((await s.permit("owner", grant, true)).status).toBe(200);
    expect(s.db.prepare("SELECT action FROM family_album_permission_events ORDER BY recorded_at").all()).toEqual([{ action: "allowed" }]);
    expect((await s.albums("relative_a", "", "GET", undefined, grant)).status).toBe(200);
    // Another person's invitation cannot be borrowed.
    expect((await s.albums("album_stranger", "", "GET", undefined, grant)).status).toBe(403);
    expect((await s.albums("relative_b", "", "GET", undefined, grant)).status).toBe(403);
  });

  it("lets the relative make their own albums and Chapters from memories they were invited to, and nothing else", async () => {
    const s = await setup(),
      grant = s.grants.relative_a;
    await s.permit("owner", grant, true);
    const start = await s.index("relative_a", grant);
    // The owner's own albums are not listed or reachable; only invited memories are offered.
    expect(start.archives).toEqual([]);
    expect(start.memories.map((memory) => memory.id)).toEqual([s.memory]);
    expect(start.memories[0]!.photoUrl).toMatch(new RegExp(`^/resources/family-access/memberships/${grant}/media/`));

    const made = await s.albums("relative_a", "/archives", "POST", { title: "Family vacation" }, grant);
    expect(made.status).toBe(201);
    const albumId = ((await made.json()) as { id: string }).id;
    // The album belongs to the archive owner and is marked as made by family.
    expect(s.db.prepare("SELECT owner_user_id FROM family_archives WHERE id=?").get(albumId)).toEqual({ owner_user_id: "owner_legacy_test" });
    const ownerView = await s.index("owner");
    expect(ownerView.archives.find((album) => album.id === albumId)).toMatchObject({ title: "Family vacation", madeByFamily: true });
    expect(ownerView.archives.find((album) => album.id === s.ownerAlbum)).toMatchObject({ madeByFamily: false });
    expect((await s.index("relative_a", grant)).archives.map((album) => album.id)).toEqual([albumId]);

    const chapter = await s.albums("relative_a", "/chapters", "POST", { archiveId: albumId, title: "Places we visited" }, grant);
    expect(chapter.status).toBe(201);
    const chapterId = ((await chapter.json()) as { id: string }).id;
    expect((await s.albums("relative_a", `/chapters/${chapterId}`, "PATCH", { version: 1, memoryIds: [s.memory] }, grant)).status).toBe(200);
    // A memory outside the invitation cannot be arranged, even though the owner holds it.
    expect((await s.albums("relative_a", `/chapters/${chapterId}`, "PATCH", { version: 2, memoryIds: [s.memory, s.other] }, grant)).status).toBe(404);
    expect((await s.albums("relative_a", `/memories/${s.other}`, "GET", undefined, grant)).status).toBe(404);

    // The owner's album cannot be read, renamed, removed, added to, or used as a destination.
    expect((await s.albums("relative_a", `?archiveId=${s.ownerAlbum}`, "GET", undefined, grant)).status).toBe(404);
    expect((await s.albums("relative_a", `/archives/${s.ownerAlbum}`, "PATCH", { version: 1, title: "Taken over" }, grant)).status).toBe(404);
    expect((await s.albums("relative_a", `/archives/${s.ownerAlbum}`, "DELETE", { version: 1 }, grant)).status).toBe(404);
    expect((await s.albums("relative_a", "/chapters", "POST", { archiveId: s.ownerAlbum, title: "Intrusion" }, grant)).status).toBe(404);
    expect((await s.albums("relative_a", `/chapters/${chapterId}`, "PATCH", { version: 2, archiveId: s.ownerAlbum }, grant)).status).toBe(404);
    // Naming a memory stays with the owner.
    expect((await s.albums("relative_a", `/memories/${s.memory}`, "PATCH", { version: 0, title: "Renamed by a relative" }, grant)).status).toBe(403);
    expect(s.db.prepare("SELECT title FROM family_archives WHERE id=?").get(s.ownerAlbum)).toEqual({ title: "Owner's album" });

    // Another permitted relative cannot touch this relative's album.
    await s.permit("owner", s.grants.relative_b, true);
    expect((await s.albums("relative_b", `/archives/${albumId}`, "PATCH", { version: 1, title: "Not mine" }, s.grants.relative_b)).status).toBe(404);
    expect((await s.index("relative_b", s.grants.relative_b)).archives).toEqual([]);
    // The owner keeps full control of an album a relative made.
    expect((await s.albums("owner", `/archives/${albumId}`, "PATCH", { version: 1, title: "Family vacation 1998" })).status).toBe(200);
  });

  it("stops at once when the owner removes the permission or revokes the invitation, and the albums stay with the owner", async () => {
    const s = await setup(),
      grant = s.grants.relative_a;
    await s.permit("owner", grant, true);
    const albumId = ((await (await s.albums("relative_a", "/archives", "POST", { title: "Holidays" }, grant)).json()) as { id: string }).id;
    expect((await s.permit("owner", grant, false)).status).toBe(200);
    expect((await s.albums("relative_a", "", "GET", undefined, grant)).status).toBe(403);
    expect((await s.albums("relative_a", `/archives/${albumId}`, "PATCH", { version: 1, title: "After removal" }, grant)).status).toBe(403);
    expect((await s.index("owner")).archives.some((album) => album.id === albumId && album.title === "Holidays")).toBe(true);
    expect(s.db.prepare("SELECT action FROM family_album_permission_events ORDER BY rowid").all()).toEqual([{ action: "allowed" }, { action: "removed" }]);

    await s.permit("owner", grant, true);
    expect((await s.albums("relative_a", "", "GET", undefined, grant)).status).toBe(200);
    s.db.prepare("UPDATE family_access_grants SET state='revoked',version=version+1 WHERE id=?").run(grant);
    expect((await s.albums("relative_a", "", "GET", undefined, grant)).status).toBe(403);
    expect((await s.albums("relative_a", "/archives", "POST", { title: "After revocation" }, grant)).status).toBe(403);
    // The database itself refuses an album author without a live permission.
    expect(() =>
      s.db.prepare("INSERT INTO family_album_authors(archive_id,author_user_id,grant_id,created_at) VALUES(?,?,?,?)").run(s.ownerAlbum, "relative_a", grant, "2026-11-15T00:00:00Z"),
    ).toThrow(/family_album_author_scope/);
  });
});
