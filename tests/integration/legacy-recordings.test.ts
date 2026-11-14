/// <reference types="@cloudflare/workers-types" />
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { handleLegacyRecordingRoute } from "../../worker/legacy-recordings";
import { handleDeletionRoute } from "../../worker/deletion";
import { legacyConsentVersion } from "../../app/domain/our-living-legacy";
import { phase1Config } from "../../config/phase-1";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
});
const audio = Uint8Array.from([
  82, 73, 70, 70, 16, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32, 1, 2, 3, 4,
]);
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function setup(mode: "in_person" | "remote" = "in_person") {
  const s = await setupLegacyFixture(mode);
  cleanups.push(() => s.db.close());
  const session = await s.create(),
    id = session.sessionId;
  const joined = await s.join(id, session.joinPath);
  expect(joined.status).toBe(200);
  const guest = joined.headers.get("Set-Cookie")!.split(";")[0]!;
  async function agree() {
    for (const actor of [s.owner, guest])
      expect(
        (
          await s.call(
            `/${id}/consent`,
            "POST",
            { agree: true, version: legacyConsentVersion },
            actor,
          )
        ).status,
      ).toBe(200);
  }
  async function start() {
    return s.call(
      `/${id}/recordings`,
      "POST",
      {},
      s.owner,
      "start_recording_test_001",
    );
  }
  async function upload(
    recordingId: string,
    options: {
      bytes?: Uint8Array;
      headers?: Record<string, string>;
      cookie?: string;
    } = {},
  ) {
    const bytes = options.bytes ?? audio;
    return (await handleLegacyRecordingRoute(
      new Request(
        `https://example.test/resources/legacy-sessions/${id}/recordings/${recordingId}`,
        {
          method: "PUT",
          headers: {
            Cookie: options.cookie ?? s.owner,
            "X-Memories-Request": "legacy-v1",
            "Content-Type": "audio/wav",
            "X-Content-SHA256": hash(bytes),
            "X-Audio-Duration-MS": "2000",
            "X-Recording-Interrupted": "0",
            ...options.headers,
          },
          body: bytes as BodyInit,
        },
      ),
      s.env,
    ))!;
  }
  return { ...s, id, guest, agree, start, upload };
}
describe("consented immutable shared original recordings", () => {
  it("requires both own consents before capture authorization, host capture and in-person mode", async () => {
    const s = await setup();
    expect((await s.start()).status).toBe(409);
    await s.agree();
    expect(
      (
        await s.call(
          `/${s.id}/recordings`,
          "POST",
          {},
          s.guest,
          "guest_recording_start",
        )
      ).status,
    ).toBe(403);
    const first = await s.start();
    expect(first.status).toBe(201);
    const source = (await first.json()) as {
      recordingId: string;
      consentEpoch: number;
    };
    expect(await (await s.start()).json()).toMatchObject({
      ...source,
      replayed: true,
    });
    const snapshot = s.db.database
      .prepare("SELECT consent_snapshot_json FROM legacy_recordings WHERE id=?")
      .get(source.recordingId) as { consent_snapshot_json: string };
    expect(JSON.parse(snapshot.consent_snapshot_json)).toHaveLength(2);
    expect(() =>
      s.db.database.exec("UPDATE legacy_recordings SET consent_epoch=99"),
    ).toThrow(/immutable/);
    const remote = await setup("remote");
    await remote.agree();
    expect((await remote.start()).status).toBe(409);
  });
  it("recovers an interrupted R2 write without changing the original and replays privately by range", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.start()).json()) as {
      recordingId: string;
    };
    s.bucket.failNextPut = true;
    expect((await s.upload(recordingId)).status).toBe(503);
    expect(
      (await s.call(`/${s.id}/recordings/${recordingId}/media`)).status,
    ).toBe(404);
    const saved = await s.upload(recordingId);
    expect(saved.status).toBe(200);
    const receipt = await saved.json();
    expect(receipt).toMatchObject({
      status: "durable",
      sha256: hash(audio),
      byteSize: audio.length,
      interrupted: false,
    });
    expect(await (await s.upload(recordingId)).json()).toEqual(receipt);
    expect(
      (await s.upload(recordingId, { bytes: new Uint8Array([...audio, 9]) }))
        .status,
    ).toBe(409);
    const full = await s.call(
      `/${s.id}/recordings/${recordingId}/media`,
      "GET",
      undefined,
      s.guest,
    );
    expect(full.status).toBe(200);
    expect(hash(new Uint8Array(await full.arrayBuffer()))).toBe(hash(audio));
    expect(full.headers.get("Cache-Control")).toContain("no-store");
    const ranged = await handleLegacyRecordingRoute(
      new Request(
        `https://example.test/resources/legacy-sessions/${s.id}/recordings/${recordingId}/media`,
        { headers: { Cookie: s.guest, Range: "bytes=0-3" } },
      ),
      s.env,
    );
    expect(ranged!.status).toBe(206);
    expect(new Uint8Array(await ranged!.arrayBuffer())).toEqual(
      audio.slice(0, 4),
    );
    expect(
      (
        await s.call(
          `/${s.id}/recordings/${recordingId}/media`,
          "GET",
          undefined,
          "",
        )
      ).status,
    ).toBe(403);
    expect(() =>
      s.db.database.exec(
        "UPDATE legacy_recording_media SET sha256='" + "b".repeat(64) + "'",
      ),
    ).toThrow(/immutable/);
  });
  it("rejects invalid bytes, checksum, duration and oversized bodies before backup confirmation", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.start()).json()) as {
      recordingId: string;
    };
    expect(
      (
        await s.upload(recordingId, {
          headers: { "X-Content-SHA256": "b".repeat(64) },
        })
      ).status,
    ).toBe(400);
    expect(
      (await s.upload(recordingId, { bytes: new Uint8Array([1, 2, 3, 4]) }))
        .status,
    ).toBe(415);
    expect(
      (
        await s.upload(recordingId, {
          headers: { "X-Audio-Duration-MS": "9999999" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await s.upload(recordingId, {
          bytes: new Uint8Array(phase1Config.media.maxAudioBytes + 1),
        })
      ).status,
    ).toBe(413);
    expect(s.bucket.objects.size).toBe(2);
  });
  it("does not confirm backup if consent changes during the object write; deletion cleans even unconfirmed objects", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.start()).json()) as {
      recordingId: string;
    };
    const original = s.bucket.put.bind(s.bucket);
    s.bucket.put = async (...args: Parameters<typeof original>) => {
      const object = await original(...args);
      await s.call(
        `/${s.id}/consent`,
        "POST",
        { agree: false, version: legacyConsentVersion },
        s.guest,
      );
      return object;
    };
    expect((await s.upload(recordingId)).status).toBe(409);
    expect(await (await s.call(`/${s.id}/recordings`)).json()).toEqual({
      recordings: [],
    });
    expect(
      (
        await s.call(
          `/${s.id}/recordings/${recordingId}/media`,
          "GET",
          undefined,
          s.guest,
        )
      ).status,
    ).toBe(404);
    expect(
      s.db.database
        .prepare("SELECT durability_status FROM legacy_recording_media")
        .get(),
    ).toMatchObject({ durability_status: "pending" });
    expect(() =>
      s.db.database.exec(
        "UPDATE legacy_recording_media SET durability_status='durable',r2_etag='synthetic',durable_at='2099-01-01T00:00:00Z'",
      ),
    ).toThrow(/consent changed/);
    const deletion = await handleDeletionRoute(
      new Request(`https://example.test/resources/drafts/${s.memory}`, {
        method: "DELETE",
        headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
      }),
      s.env,
    );
    expect(deletion!.status).toBe(200);
    expect(s.bucket.objects.size).toBe(0);
  });
  it("preserves a partial source with additive self-attribution and blocks all replay after guest revocation", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.start()).json()) as {
      recordingId: string;
    };
    expect(
      (
        await s.upload(recordingId, {
          headers: { "X-Recording-Interrupted": "1" },
        })
      ).status,
    ).toBe(201);
    const view = (await (
      await s.call(`/${s.id}?as=guest`, "GET", undefined, s.guest)
    ).json()) as {
      actorId: string;
      participants: { id: string; role: string }[];
    };
    expect(
      (
        await s.call(
          `/${s.id}/recordings/${recordingId}/claims`,
          "POST",
          {
            participantId: view.actorId,
            startMs: 0,
            endMs: 1000,
            note: "Host cannot claim guest words",
          },
          s.owner,
          "claim_wrong_actor",
        )
      ).status,
    ).toBe(403);
    const claim = {
      startMs: 0,
      endMs: 1000,
      note: "I remember the rain differently.",
    };
    expect(
      (
        await s.call(
          `/${s.id}/recordings/${recordingId}/claims`,
          "POST",
          claim,
          s.guest,
          "claim_guest_001",
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await s.call(
          `/${s.id}/recordings/${recordingId}/claims`,
          "POST",
          claim,
          s.guest,
          "claim_guest_001",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await s.call(
          `/${s.id}/recordings/${recordingId}/claims`,
          "POST",
          { ...claim, endMs: 3000 },
          s.guest,
          "claim_invalid_range",
        )
      ).status,
    ).toBe(400);
    const list = (await (
      await s.call(`/${s.id}/recordings`, "GET", undefined, s.guest)
    ).json()) as {
      recordings: {
        interrupted: boolean;
        attribution: string;
        claims: {
          participantId: string;
          note: string;
          attributionType: string;
        }[];
      }[];
    };
    expect(list.recordings[0]).toMatchObject({
      interrupted: true,
      attribution: "unconfirmed",
      claims: [
        {
          participantId: view.actorId,
          note: claim.note,
          attributionType: "self_identified",
        },
      ],
    });
    await s.call(`/${s.id}/revoke`, "POST", { participantId: view.actorId });
    expect(
      (await s.call(`/${s.id}/recordings`, "GET", undefined, s.guest)).status,
    ).toBe(403);
    expect(
      (
        await s.call(
          `/${s.id}/recordings/${recordingId}/media`,
          "GET",
          undefined,
          s.guest,
        )
      ).status,
    ).toBe(403);
  });
  it("removes a late object that arrives after whole-memory deletion", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.start()).json()) as {
      recordingId: string;
    };
    const put = s.bucket.put.bind(s.bucket);
    s.bucket.put = async (...args: Parameters<typeof put>) => {
      const deleted = await handleDeletionRoute(
        new Request(`https://example.test/resources/drafts/${s.memory}`, {
          method: "DELETE",
          headers: { Cookie: s.owner, "X-Memories-Request": "deletion-v1" },
        }),
        s.env,
      );
      expect(deleted!.status).toBe(200);
      return put(...args);
    };
    expect((await s.upload(recordingId)).status).toBe(404);
    expect(s.bucket.objects.size).toBe(0);
  });
  it("does not turn re-consent into permission to upload an old capture", async () => {
    const s = await setup();
    await s.agree();
    const { recordingId } = (await (await s.start()).json()) as {
      recordingId: string;
    };
    await s.call(
      `/${s.id}/consent`,
      "POST",
      { agree: false, version: legacyConsentVersion },
      s.guest,
    );
    await s.agree();
    expect((await s.upload(recordingId)).status).toBe(409);
    expect(s.bucket.objects.size).toBe(2);
  });
});
