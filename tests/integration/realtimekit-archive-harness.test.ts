import { afterEach, expect, it, vi } from "vitest";
import { createFetchMock } from "miniflare";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// @ts-expect-error Trusted operator module is shared with manual Actions.
import { createNativeArchiveProof } from "../../scripts/realtimekit-archive-runtime.mjs";
let dispose: (() => Promise<void>) | undefined, temporary: string | undefined;
afterEach(async () => {
  await dispose?.();
  if (temporary) await rm(temporary, { recursive: true, force: true });
});
it("exercises actual consent/start/guest stop/private source routes through automatically scheduled native alarms", async () => {
  const mock = createFetchMock();
  mock.disableNetConnect();
  const records = new Map<
    string,
    { id: string; meeting_id: string; status: string; download_url: unknown }
  >();
  const downloads: Record<string, { download_url: string }> = {};
  const grants = [
    { role: "host", participantId: "provider_host_probe" },
    { role: "guest", participantId: "provider_guest_probe" },
  ];
  const audio = new Uint8Array(1000).fill(39);
  audio.set([0x1a, 0x45, 0xdf, 0xa3]);
  for (const grant of grants) {
    const name = `capture_${grant.participantId}_segment.webm`;
    downloads[name] = {
      download_url: `https://archive.cloudflarestorage.com/${name}`,
    };
    mock
      .get("https://archive.cloudflarestorage.com")
      .intercept({ path: `/${name}`, method: "GET" })
      .reply(200, Buffer.from(audio))
      .persist();
  }
  const video = new Uint8Array(1000).fill(42);
  video.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);
  mock
    .get("https://archive.cloudflarestorage.com")
    .intercept({ path: "/composite.mp4", method: "GET" })
    .reply(200, Buffer.from(video))
    .persist();
  const api = mock.get("https://api.cloudflare.com");
  let allocations = 0;
  const payloads: Promise<{ max_seconds?: number; meeting_id: string }>[] = [];
  api
    .intercept({ path: /.*/, method: "POST" })
    .reply((options) => {
      allocations++;
      const track = String(options.path).endsWith("/track"),
        id = track ? "track-proof-test" : "composite-proof-test";
      payloads.push(
        new Response(options.body as ReadableStream<Uint8Array>).json(),
      );
      records.set(id, {
        id,
        meeting_id: "meeting-proof-test",
        status: "RECORDING",
        download_url: track
          ? { opaque: [{ download_urls: downloads }] }
          : "https://archive.cloudflarestorage.com/composite.mp4",
      });
      return {
        statusCode: 200,
        data: JSON.stringify({
          success: true,
          data: track ? { recording: { id } } : { id },
        }),
      };
    })
    .persist();
  api
    .intercept({ path: /.*/, method: "GET" })
    .reply((options) => ({
      statusCode: 200,
      data: JSON.stringify({
        success: true,
        data: records.get(String(options.path).split("/").pop()!),
      }),
    }))
    .persist();
  api
    .intercept({ path: /.*/, method: "PUT" })
    .reply((options) => {
      records.get(String(options.path).split("/").pop()!)!.status = "UPLOADED";
      return {
        statusCode: 200,
        data: JSON.stringify({ success: true, data: {} }),
      };
    })
    .persist();
  temporary = await mkdtemp(join(tmpdir(), "native-archive-harness-test-"));
  const cleanup = vi.fn();
  const proof = await createNativeArchiveProof({
    candidate: resolve("."),
    directory: temporary,
    credentials: {
      REALTIMEKIT_ACCOUNT_ID: "account_test",
      REALTIMEKIT_API_TOKEN: "synthetic",
    },
    context: {
      grants,
      appId: "app_test",
      presetId: "preset_test",
      meetingId: "meeting-proof-test",
      recording: { requireSyntheticMeetingCleanup: cleanup },
    },
    fetchMock: mock,
  });
  dispose = proof.dispose;
  async function until(phase: string) {
    for (let i = 0; i < 100; i++) {
      if ((await proof.state())?.phase === phase) return;
      await new Promise((done) => setTimeout(done, 200));
    }
    throw new Error(
      JSON.stringify({
        expected: phase,
        observed: await proof.state(),
        allocations,
      }),
    );
  }
  expect(
    await proof.db
      .prepare(
        "SELECT max_duration_seconds FROM legacy_remote_recordings WHERE id=?",
      )
      .bind(proof.recordingId)
      .first(),
  ).toMatchObject({ max_duration_seconds: 60 });
  await until("recording");
  expect(
    (await Promise.all(payloads)).find((body) => body.max_seconds)?.max_seconds,
  ).toBe(60);
  expect(allocations).toBe(2);
  expect(cleanup).toHaveBeenCalledWith(true);
  expect(
    (
      await proof.request(
        `/remote-recordings/${proof.recordingId}/stop`,
        "POST",
        proof.guest,
        {},
      )
    ).status,
  ).toBe(202);
  await until("preserved");
  const originals = await proof.verifyOriginals();
  expect(originals).toHaveLength(3);
  expect(
    originals.filter(
      (source: { kind: string }) => source.kind === "participant_audio",
    ),
  ).toHaveLength(2);
  expect(allocations).toBe(2);
}, 60000);
