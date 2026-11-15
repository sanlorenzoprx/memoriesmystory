/// <reference types="@cloudflare/workers-types" />
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleDeletionRoute } from "../../worker/deletion";
import { handleFamilyContributionRoute } from "../../worker/family-contributions";
import type { FamilyContribution } from "../../app/domain/family-contribution";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
const agreement = "family-contribution-review-v1";
// Synthetic WebM (EBML) bytes; no real voice is used in tests.
function syntheticVoice(seed: number) {
  return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, seed]);
}
// Synthetic JPEG header bytes; no real family photograph is used in tests.
function syntheticPhoto(seed: number) {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, seed]);
}
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const now = new Date().toISOString(),
    archive = "family_voice_archive";
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
    grants[user] = `grant_${user}`;
    s.db.database
      .prepare(
        "INSERT INTO family_access_grants(id,archive_id,owner_user_id,role,scope_kind,scope_id,target_email,token_hash,state,accepted_by_user_id,accepted_at,expires_at,created_at,updated_at) VALUES(?,?,?,?,'memory',?,?,?,'accepted',?,?,'2099-01-01T00:00:00Z',?,?)",
      )
      .run(
        grants[user],
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
  const url = (actor: string, path: string) =>
    `https://example.test/resources/family-contributions/${s.memory}${path}${grants[actor] ? `?grantId=${grants[actor]}` : ""}`;
  async function call(
    actor: string,
    path = "",
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    return (await handleFamilyContributionRoute(
      new Request(url(actor, path), {
        method,
        headers: {
          Cookie: cookies[actor] ?? "",
          "X-Idempotency-Key": `voice_test_key_${crypto.randomUUID()}`,
          "X-Memories-Request": "family-v1",
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      s.env,
    ))!;
  }
  async function record(
    actor: string,
    bytes = syntheticVoice(1),
    overrides: Record<string, string> = {},
  ) {
    return (await handleFamilyContributionRoute(
      new Request(url(actor, "/voice"), {
        method: "POST",
        headers: {
          Cookie: cookies[actor] ?? "",
          "Content-Type": "audio/webm;codecs=opus",
          "X-Memories-Request": "family-v1",
          "X-Idempotency-Key": `voice_test_key_${crypto.randomUUID()}`,
          "X-Content-SHA256": sha(bytes),
          "X-Audio-Duration-MS": "12000",
          "X-Contribution-Attribution": encodeURIComponent(`Tía ${actor}`),
          "X-Contribution-Agree": "true",
          "X-Agreement-Version": agreement,
          ...overrides,
        },
        body: bytes,
      }),
      s.env,
    ))!;
  }
  async function addPhoto(
    actor: string,
    bytes = syntheticPhoto(1),
    overrides: Record<string, string> = {},
  ) {
    return (await handleFamilyContributionRoute(
      new Request(url(actor, "/photo"), {
        method: "POST",
        headers: {
          Cookie: cookies[actor] ?? "",
          "Content-Type": "image/jpeg",
          "X-Memories-Request": "family-v1",
          "X-Idempotency-Key": `photo_test_key_${crypto.randomUUID()}`,
          "X-Content-SHA256": sha(bytes),
          "X-Contribution-Attribution": encodeURIComponent(`Tío ${actor}`),
          "X-Contribution-Agree": "true",
          "X-Agreement-Version": agreement,
          ...overrides,
        },
        body: bytes,
      }),
      s.env,
    ))!;
  }
  async function list(actor = "owner") {
    const response = await call(actor);
    expect(response.status).toBe(200);
    return ((await response.json()) as { contributions: FamilyContribution[] })
      .contributions;
  }
  const voiceKeys = () =>
    [...s.bucket.objects.keys()].filter((key) =>
      key.startsWith("contributions/"),
    );
  return { ...s, grants, call, record, addPhoto, list, voiceKeys };
}

describe("independently attributed family voice recollections", () => {
  it("preserves a relative's exact voice bytes and keeps it private until the owner includes it", async () => {
    const s = await setup(),
      bytes = syntheticVoice(7),
      created = await s.record("contributor_a", bytes);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(s.voiceKeys()).toHaveLength(1);
    expect([...s.bucket.objects.get(s.voiceKeys()[0])!.body]).toEqual([
      ...bytes,
    ]);

    const [pending] = await s.list();
    expect(pending.revision).toMatchObject({
      sourceKind: "human_voice",
      attribution: "Tía contributor_a",
      text: "",
    });
    expect(pending.voice).toEqual({
      durationMs: 12000,
      contentType: "audio/webm",
    });
    // Not family-visible, and not playable by family, before explicit owner review.
    expect(await s.list("viewer_family")).toEqual([]);
    expect((await s.call("viewer_family", `/${id}/voice`)).status).toBe(403);
    expect((await s.call("contributor_b", `/${id}/voice`)).status).toBe(403);

    const own = await s.call("contributor_a", `/${id}/voice`);
    expect(own.status).toBe(200);
    expect(own.headers.get("X-Content-SHA256")).toBe(sha(bytes));
    expect(own.headers.get("Cache-Control")).toBe("private, no-store");
    expect([...new Uint8Array(await own.arrayBuffer())]).toEqual([...bytes]);

    expect(
      (
        await s.call("owner", `/${id}/assembly`, "POST", {
          version: pending.version,
          include: true,
          revisionId: pending.revision.id,
        })
      ).status,
    ).toBe(200);
    const [shared] = await s.list("viewer_family");
    expect(shared.voice?.durationMs).toBe(12000);
    const heard = await s.call("viewer_family", `/${id}/voice`);
    expect(heard.status).toBe(200);
    expect([...new Uint8Array(await heard.arrayBuffer())]).toEqual([...bytes]);
    const ranged = await s.call("viewer_family", `/${id}/voice`, "GET", undefined, {
      Range: "bytes=4-7",
    });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("Content-Range")).toBe("bytes 4-7/12");
  });

  it("keeps a written and a spoken account of the same photograph separate", async () => {
    const s = await setup();
    expect((await s.record("contributor_a")).status).toBe(201);
    expect(
      (
        await s.call("contributor_b", "", "POST", {
          attribution: "contributor_b",
          text: "I remember June 1951",
          agree: true,
          agreementVersion: agreement,
        })
      ).status,
    ).toBe(201);
    const kinds = (await s.list()).map((c) => c.revision.sourceKind).sort();
    expect(kinds).toEqual(["human_text", "human_voice"]);
  });

  it("replays the same request without storing a second original and rejects a changed retry", async () => {
    const s = await setup(),
      key = "voice_retry_key_0001",
      first = await s.record("contributor_a", syntheticVoice(1), {
        "X-Idempotency-Key": key,
      }),
      again = await s.record("contributor_a", syntheticVoice(1), {
        "X-Idempotency-Key": key,
      });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(((await again.json()) as { replayed: boolean }).replayed).toBe(true);
    expect(s.voiceKeys()).toHaveLength(1);
    expect(
      (
        await s.record("contributor_a", syntheticVoice(2), {
          "X-Idempotency-Key": key,
        })
      ).status,
    ).toBe(409);
    expect(s.voiceKeys()).toHaveLength(1);
    expect(await s.list()).toHaveLength(1);
  });

  it("stores nothing for viewers, missing consent, wrong checksums, unsupported audio, long recordings or forged requests", async () => {
    const s = await setup(),
      bytes = syntheticVoice(3);
    const refused: [Response, number][] = [
      [await s.record("viewer_family"), 403],
      [await s.record("contributor_a", bytes, { "X-Contribution-Agree": "false" }), 400],
      [await s.record("contributor_a", bytes, { "X-Agreement-Version": "older" }), 400],
      [await s.record("contributor_a", bytes, { "X-Content-SHA256": "0".repeat(64) }), 400],
      [await s.record("contributor_a", bytes, { "Content-Type": "video/webm" }), 415],
      [await s.record("contributor_a", new Uint8Array(12).fill(9), { "X-Content-SHA256": sha(new Uint8Array(12).fill(9)) }), 415],
      [await s.record("contributor_a", bytes, { "X-Audio-Duration-MS": "45000" }), 400],
      [await s.record("contributor_a", bytes, { "X-Contribution-Attribution": "" }), 400],
      [await s.record("contributor_a", bytes, { "X-Memories-Request": "other" }), 403],
      [await s.record("contributor_a", bytes, { Cookie: "" }), 401],
    ];
    for (const [response, status] of refused)
      expect(response.status).toBe(status);
    expect(s.voiceKeys()).toEqual([]);
    expect(await s.list()).toEqual([]);
  });

  it("leaves no stored voice when storage fails or access ended, and never reports it saved", async () => {
    const s = await setup();
    s.bucket.failNextPut = true;
    const interrupted = await s.record("contributor_a");
    expect(interrupted.status).toBe(503);
    expect(s.voiceKeys()).toEqual([]);
    s.db.database
      .prepare("UPDATE family_access_grants SET state='revoked',version=version+1 WHERE id=?")
      .run(s.grants.contributor_a);
    expect((await s.record("contributor_a")).status).toBe(403);
    expect(s.voiceKeys()).toEqual([]);
    expect(await s.list()).toEqual([]);
  });

  it("a voice original cannot be revised or rewritten; withdrawal and revocation hide it from family only", async () => {
    const s = await setup(),
      { id } = (await (await s.record("contributor_a")).json()) as { id: string },
      [item] = await s.list();
    expect(
      (
        await s.call("contributor_a", `/${id}/revise`, "POST", {
          version: item.version,
          attribution: "contributor_a",
          text: "Typed over my voice",
          agree: true,
          agreementVersion: agreement,
        })
      ).status,
    ).toBe(409);
    expect(() =>
      s.db.database.exec(
        "UPDATE family_contribution_voice_sources SET attribution='Changed'",
      ),
    ).toThrow(/family_contribution_source_immutable/);
    expect(() =>
      s.db.database
        .prepare(
          "INSERT INTO family_contribution_revisions(id,contribution_id,author_user_id,source_grant_id,attribution,human_text,agreement_version,created_at) VALUES('revision_mixed_kind',?,'contributor_a',?,'A','text',?,?)",
        )
        .run(id, s.grants.contributor_a, agreement, new Date().toISOString()),
    ).toThrow(/family_contribution_source_kind/);

    await s.call("owner", `/${id}/assembly`, "POST", {
      version: item.version,
      include: true,
      revisionId: item.revision.id,
    });
    expect((await s.call("viewer_family", `/${id}/voice`)).status).toBe(200);
    s.db.database
      .prepare("UPDATE family_access_grants SET state='revoked',version=version+1 WHERE id=?")
      .run(s.grants.contributor_a);
    expect((await s.call("viewer_family", `/${id}/voice`)).status).toBe(403);
    expect(await s.list("viewer_family")).toEqual([]);
    // The owner keeps the preserved source; the author can still hear and withdraw their own.
    expect((await s.call("owner", `/${id}/voice`)).status).toBe(200);
    expect((await s.call("contributor_a", `/${id}/voice`)).status).toBe(200);
    expect(
      (
        await s.call("contributor_a", `/${id}/withdraw`, "POST", {
          version: item.version + 1,
        })
      ).status,
    ).toBe(200);
    expect(s.voiceKeys()).toHaveLength(1);
  });

  it("whole-memory deletion removes every family voice object, including unreferenced attempts", async () => {
    const s = await setup();
    expect((await s.record("contributor_a")).status).toBe(201);
    expect((await s.record("owner", syntheticVoice(5))).status).toBe(201);
    await s.bucket.put(
      `contributions/${s.memory}/abandoned_attempt/original.webm`,
      syntheticVoice(9).buffer,
    );
    expect(s.voiceKeys()).toHaveLength(3);
    const deletion = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(deletion!.status).toBe(200);
    expect(s.voiceKeys()).toEqual([]);
    expect(
      s.db.database
        .prepare("SELECT count(*) AS n FROM family_contribution_voice_sources")
        .get(),
    ).toEqual({ n: 0 });
  });
});

describe("independently attributed supplementary family photographs", () => {
  it("preserves the exact photograph privately until the owner includes it, without touching the memory's own original", async () => {
    const s = await setup(),
      before = JSON.stringify(
        [...s.bucket.objects].filter(([key]) => !key.startsWith("contributions/")),
      ),
      bytes = syntheticPhoto(4),
      created = await s.addPhoto("contributor_a", bytes);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect([...s.bucket.objects.get(s.voiceKeys()[0])!.body]).toEqual([...bytes]);
    const [pending] = await s.list();
    expect(pending.revision).toMatchObject({
      sourceKind: "human_photo",
      attribution: "Tío contributor_a",
      text: "",
    });
    expect(pending.photo).toEqual({ contentType: "image/jpeg" });
    expect(pending.voice).toBeNull();
    expect(await s.list("viewer_family")).toEqual([]);
    expect((await s.call("viewer_family", `/${id}/photo`)).status).toBe(403);
    // A photograph is not reachable through the voice address, or the reverse.
    expect((await s.call("contributor_a", `/${id}/voice`)).status).toBe(404);
    const own = await s.call("contributor_a", `/${id}/photo`);
    expect(own.status).toBe(200);
    expect(own.headers.get("Content-Type")).toBe("image/jpeg");
    expect(own.headers.get("X-Content-SHA256")).toBe(sha(bytes));
    await s.call("owner", `/${id}/assembly`, "POST", {
      version: pending.version,
      include: true,
      revisionId: pending.revision.id,
    });
    const seen = await s.call("viewer_family", `/${id}/photo`);
    expect(seen.status).toBe(200);
    expect([...new Uint8Array(await seen.arrayBuffer())]).toEqual([...bytes]);
    expect(
      JSON.stringify(
        [...s.bucket.objects].filter(([key]) => !key.startsWith("contributions/")),
      ),
    ).toBe(before);
  });

  it("stores nothing for viewers, missing consent, wrong checksums, non-images or forged requests, and replays retries", async () => {
    const s = await setup(),
      bytes = syntheticPhoto(2);
    const refused: [Response, number][] = [
      [await s.addPhoto("viewer_family"), 403],
      [await s.addPhoto("contributor_a", bytes, { "X-Contribution-Agree": "false" }), 400],
      [await s.addPhoto("contributor_a", bytes, { "X-Content-SHA256": "0".repeat(64) }), 400],
      [await s.addPhoto("contributor_a", bytes, { "Content-Type": "audio/webm" }), 415],
      [await s.addPhoto("contributor_a", syntheticVoice(1), { "X-Content-SHA256": sha(syntheticVoice(1)) }), 415],
      [await s.addPhoto("contributor_a", bytes, { "X-Memories-Request": "other" }), 403],
      [await s.addPhoto("contributor_a", bytes, { Cookie: "" }), 401],
    ];
    for (const [response, status] of refused)
      expect(response.status).toBe(status);
    expect(s.voiceKeys()).toEqual([]);
    const key = "photo_retry_key_0001";
    expect((await s.addPhoto("contributor_a", bytes, { "X-Idempotency-Key": key })).status).toBe(201);
    expect((await s.addPhoto("contributor_a", bytes, { "X-Idempotency-Key": key })).status).toBe(200);
    expect((await s.addPhoto("contributor_a", syntheticPhoto(3), { "X-Idempotency-Key": key })).status).toBe(409);
    expect(s.voiceKeys()).toHaveLength(1);
  });

  it("cannot be revised or rewritten, hides on revocation, and is removed with the memory", async () => {
    const s = await setup(),
      { id } = (await (await s.addPhoto("contributor_a")).json()) as { id: string },
      [item] = await s.list();
    expect(
      (
        await s.call("contributor_a", `/${id}/revise`, "POST", {
          version: item.version,
          attribution: "contributor_a",
          text: "Typed over my photograph",
          agree: true,
          agreementVersion: agreement,
        })
      ).status,
    ).toBe(409);
    expect(() =>
      s.db.database.exec("UPDATE family_contribution_photo_sources SET attribution='Changed'"),
    ).toThrow(/family_contribution_source_immutable/);
    await s.call("owner", `/${id}/assembly`, "POST", {
      version: item.version,
      include: true,
      revisionId: item.revision.id,
    });
    expect((await s.call("viewer_family", `/${id}/photo`)).status).toBe(200);
    s.db.database
      .prepare("UPDATE family_access_grants SET state='revoked',version=version+1 WHERE id=?")
      .run(s.grants.contributor_a);
    expect((await s.call("viewer_family", `/${id}/photo`)).status).toBe(403);
    expect((await s.call("owner", `/${id}/photo`)).status).toBe(200);
    const deletion = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(deletion!.status).toBe(200);
    expect(s.voiceKeys()).toEqual([]);
  });
});

describe("the speaker's own written words for a voice recollection", () => {
  type Words = { id: string; text: string } | null;
  type WithWords = FamilyContribution & {
    writtenWords: { latest: Words; included: Words } | null;
  };
  async function started() {
    const s = await setup(),
      { id } = (await (await s.record("contributor_a")).json()) as { id: string };
    const item = async (actor = "owner") =>
      ((await s.list(actor)) as WithWords[]).find((c) => c.id === id);
    const write = (actor: string, version: number, text: string, extra = {}) =>
      s.call(actor, `/${id}/transcript`, "POST", {
        version,
        text,
        agree: true,
        agreementVersion: agreement,
        ...extra,
      });
    return { s, id, item, write };
  }

  it("only the speaker writes them; every version is kept; family sees only the owner-pinned version beside an included voice", async () => {
    const { s, id, item, write } = await started();
    expect((await write("owner", 1, "Owner's words for her voice")).status).toBe(403);
    expect((await write("contributor_b", 1, "Someone else's words")).status).toBe(403);
    expect((await write("contributor_a", 1, "First I said it was May.", { agree: false })).status).toBe(400);
    expect((await write("contributor_a", 1, "First I said it was May.")).status).toBe(200);
    expect((await write("contributor_a", 1, "Stale write")).status).toBe(409);

    const first = (await item())!;
    expect(first.writtenWords).toMatchObject({
      latest: { text: "First I said it was May." },
      included: null,
    });
    // Words cannot enter family view before the voice itself is included.
    expect(
      (
        await s.call("owner", `/${id}/transcript-assembly`, "POST", {
          version: first.version,
          include: true,
          transcriptId: first.writtenWords!.latest!.id,
        })
      ).status,
    ).toBe(409);
    await s.call("owner", `/${id}/assembly`, "POST", {
      version: first.version,
      include: true,
      revisionId: first.revision.id,
    });
    expect((await item("viewer_family"))!.writtenWords).toEqual({
      latest: null,
      included: null,
    });
    const included = (await item())!;
    expect(
      (
        await s.call("contributor_a", `/${id}/transcript-assembly`, "POST", {
          version: included.version,
          include: true,
          transcriptId: first.writtenWords!.latest!.id,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await s.call("owner", `/${id}/transcript-assembly`, "POST", {
          version: included.version,
          include: true,
          transcriptId: first.writtenWords!.latest!.id,
        })
      ).status,
    ).toBe(200);
    expect((await item("viewer_family"))!.writtenWords!.included!.text).toBe(
      "First I said it was May.",
    );

    // A later version stays private until the owner reviews it.
    const pinned = (await item())!;
    expect((await write("contributor_a", pinned.version, "It may have been June.")).status).toBe(200);
    expect((await item("viewer_family"))!.writtenWords!.included!.text).toBe(
      "First I said it was May.",
    );
    expect((await item("contributor_a"))!.writtenWords).toMatchObject({
      latest: { text: "It may have been June." },
      included: { text: "First I said it was May." },
    });
    const history = await s.call("contributor_a", `/${id}/transcript`);
    expect(
      ((await history.json()) as { transcripts: { text: string }[] }).transcripts.map((t) => t.text),
    ).toEqual(["First I said it was May.", "It may have been June."]);
    expect((await s.call("viewer_family", `/${id}/transcript`)).status).toBe(403);
    expect((await s.call("contributor_b", `/${id}/transcript`)).status).toBe(403);
    expect(() =>
      s.db.database.exec("UPDATE family_contribution_voice_transcripts SET written_text='Changed'"),
    ).toThrow(/family_contribution_source_immutable/);
    // The recording itself is untouched by any written words.
    expect(s.voiceKeys()).toHaveLength(1);
  });

  it("excluding or withdrawing the voice removes its written words from family view until a fresh owner choice", async () => {
    const { s, id, item, write } = await started();
    await write("contributor_a", 1, "What I said that day.");
    let now = (await item())!;
    await s.call("owner", `/${id}/assembly`, "POST", { version: now.version, include: true, revisionId: now.revision.id });
    now = (await item())!;
    await s.call("owner", `/${id}/transcript-assembly`, "POST", {
      version: now.version,
      include: true,
      transcriptId: now.writtenWords!.latest!.id,
    });
    expect((await item("viewer_family"))!.writtenWords!.included).not.toBeNull();
    now = (await item())!;
    await s.call("owner", `/${id}/assembly`, "POST", { version: now.version, include: false });
    expect(await item("viewer_family")).toBeUndefined();
    now = (await item())!;
    await s.call("owner", `/${id}/assembly`, "POST", { version: now.version, include: true, revisionId: now.revision.id });
    expect((await item("viewer_family"))!.writtenWords).toEqual({ latest: null, included: null });
    expect((await item())!.writtenWords!.latest!.text).toBe("What I said that day.");

    now = (await item())!;
    const replayKey = { "X-Idempotency-Key": "written_words_retry_0001" };
    const body = { version: now.version, text: "Said again.", agree: true, agreementVersion: agreement };
    expect((await s.call("contributor_a", `/${id}/transcript`, "POST", body, replayKey)).status).toBe(200);
    const replay = await s.call("contributor_a", `/${id}/transcript`, "POST", body, replayKey);
    expect(((await replay.json()) as { replayed?: boolean }).replayed).toBe(true);
    expect(
      s.db.database.prepare("SELECT count(*) AS n FROM family_contribution_voice_transcripts").get(),
    ).toEqual({ n: 2 });
    now = (await item())!;
    await s.call("contributor_a", `/${id}/withdraw`, "POST", { version: now.version });
    expect((await write("contributor_a", now.version + 1, "After withdrawal")).status).toBe(409);
  });

  it("written and photographed contributions cannot carry speaker words, and they are deleted with the memory", async () => {
    const s = await setup(),
      photo = (await (await s.addPhoto("contributor_a")).json()) as { id: string },
      voice = (await (await s.record("contributor_a")).json()) as { id: string };
    expect(
      (
        await s.call("contributor_a", `/${photo.id}/transcript`, "POST", {
          version: 1,
          text: "Words for a photograph",
          agree: true,
          agreementVersion: agreement,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await s.call("contributor_a", `/${voice.id}/transcript`, "POST", {
          version: 1,
          text: "Words for my voice",
          agree: true,
          agreementVersion: agreement,
        })
      ).status,
    ).toBe(200);
    const deletion = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(deletion!.status).toBe(200);
    expect(
      s.db.database.prepare("SELECT count(*) AS n FROM family_contribution_voice_transcripts").get(),
    ).toEqual({ n: 0 });
  });
});

