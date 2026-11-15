/// <reference types="@cloudflare/workers-types" />
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { handleArchiveExportRoute } from "../../worker/archive-export";
import { handleLegacyRecordingRoute } from "../../worker/legacy-recordings";
import { legacyConsentVersion } from "../../app/domain/our-living-legacy";
import type { ArchiveExportManifest } from "../../app/domain/archive-export";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
});
// Synthetic WAV header bytes; no real conversation is used.
const audio = Uint8Array.from([82, 73, 70, 70, 16, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32, 1, 2, 3, 4]);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("exporting an in-person shared conversation", () => {
  it("exports the exact preserved recording with the consent given before it and only self-identified speakers", async () => {
    const s = await setupLegacyFixture("in_person");
    cleanups.push(() => s.db.close());
    const session = await s.create(),
      id = session.sessionId,
      joined = await s.join(id, session.joinPath),
      guest = joined.headers.get("Set-Cookie")!.split(";")[0]!;
    for (const actor of [s.owner, guest])
      expect((await s.call(`/${id}/consent`, "POST", { agree: true, version: legacyConsentVersion }, actor)).status).toBe(200);
    const started = await s.call(`/${id}/recordings`, "POST", {}, s.owner, "export_recording_start_001");
    expect(started.status).toBe(201);
    const { recordingId } = (await started.json()) as { recordingId: string };
    const manifestOf = async () =>
      (await (await handleArchiveExportRoute(new Request("https://example.test/resources/archive-export/manifest", { headers: { Cookie: s.owner } }), s.env))!.json()) as ArchiveExportManifest;

    // Authorized but not yet preserved: counted as missing, never listed as a file.
    const before = await manifestOf();
    expect(before.complete).toBe(false);
    expect(before.notIncluded).toContainEqual({ code: "shared_recordings_not_preserved", count: 1 });
    expect(before.memories[0]!.files.some((file) => file.kind === "session-recording")).toBe(false);

    const upload = (await handleLegacyRecordingRoute(
      new Request(`https://example.test/resources/legacy-sessions/${id}/recordings/${recordingId}`, {
        method: "PUT",
        headers: { Cookie: s.owner, "X-Memories-Request": "legacy-v1", "Content-Type": "audio/wav", "X-Content-SHA256": sha(audio), "X-Audio-Duration-MS": "2000", "X-Recording-Interrupted": "0" },
        body: audio as BodyInit,
      }),
      s.env,
    ))!;
    expect(upload.status).toBeLessThan(300);

    const after = await manifestOf(),
      memory = after.memories[0]!,
      conversation = memory.sharedConversations![0]!,
      recording = conversation.recordings[0]!,
      file = memory.files.find((entry) => entry.kind === "session-recording")!;
    expect(after.notIncluded.some((item) => item.code === "shared_recordings_not_preserved")).toBe(false);
    expect(conversation).toMatchObject({ id, mode: "in_person" });
    expect(conversation.consentHistory.map((c) => [c.role, c.decision, c.consentVersion]).sort()).toEqual([
      ["guest", "accepted", legacyConsentVersion],
      ["host", "accepted", legacyConsentVersion],
    ]);
    expect(recording).toMatchObject({ id: recordingId, kind: "in_person", state: "preserved", interrupted: false, fileIds: [recordingId] });
    expect(recording.consentAtRecording.map((c) => c.role).sort()).toEqual(["guest", "host"]);
    // One microphone: nobody is named as a speaker unless they say so themselves.
    expect(recording.selfIdentifiedSpeakers).toEqual([]);
    expect(file).toMatchObject({ role: "shared_conversation_recording", original: true, sha256: sha(audio), byteSize: audio.byteLength, durationMs: 2000 });

    const download = (await handleArchiveExportRoute(new Request(`https://example.test/resources/archive-export/file/session-recording/${recordingId}`, { headers: { Cookie: s.owner } }), s.env))!;
    expect(download.status).toBe(200);
    const bytes = new Uint8Array(await download.arrayBuffer());
    expect(sha(bytes)).toBe(file.sha256);
    expect(download.headers.get("X-Content-SHA256")).toBe(file.sha256);
    // The conversation guest's invitation cookie is not an archive owner session.
    expect((await handleArchiveExportRoute(new Request(`https://example.test/resources/archive-export/file/session-recording/${recordingId}`, { headers: { Cookie: guest } }), s.env))!.status).toBe(401);
    const text = JSON.stringify(after);
    for (const secret of ["legacy/", "invite", "access_hash", "owner_legacy_test"]) expect(text).not.toContain(secret);
  });
});
