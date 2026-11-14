import { Buffer } from "node:buffer";
import { appendFile, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runStagingProof } from "./realtimekit-staging-proof.mjs";
import { createNativeArchiveProof } from "./realtimekit-archive-runtime.mjs";

const cloudMode = process.env.ARCHIVE_STORAGE_MODE === "isolated-cloud";
const candidate = resolve("call-candidate"),
  origin = "http://127.0.0.1:4173",
  directory = await mkdtemp(join(tmpdir(), "memoriesmystory-native-archive-"));
const cleanEnv = { ...process.env };
delete cleanEnv.REALTIMEKIT_API_TOKEN;
delete cleanEnv.CLOUDFLARE_API_TOKEN;
let browser,
  server,
  archive,
  stage = "prepare",
  failureCode,
  failureHttpStatus,
  failureProviderCodes;
let nativeCleanupConfirmed = false;
const checks = [],
  mediaMetadata = [];
const wait = (ms) => new Promise((done) => globalThis.setTimeout(done, ms));
function tone() {
  const count = 48000 * 10,
    bytes = Buffer.alloc(44 + count * 2);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(96000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    bytes.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / 48000) * 6000),
      44 + i * 2,
    );
  return bytes;
}
async function exercise(context) {
  try {
    const { chromium } = await import(
      pathToFileURL(join(candidate, "node_modules/@playwright/test/index.mjs"))
        .href
    );
    const sound = join(directory, "synthetic.wav");
    await writeFile(sound, tone(), { mode: 0o600 });
    server = spawn(
      process.execPath,
      [
        join(candidate, "node_modules/vite/bin/vite.js"),
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4173",
        "--strictPort",
      ],
      { cwd: candidate, stdio: "ignore", env: cleanEnv },
    );
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error("archive_fixture_failed");
      if (
        await globalThis
          .fetch(origin)
          .then((response) => response.ok)
          .catch(() => false)
      )
        break;
      await wait(100);
      if (i === 99) throw new Error("archive_fixture_failed");
    }
    browser = await chromium.launch({
      headless: true,
      env: cleanEnv,
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-audio-capture=${sound}`,
      ],
    });
    const sdk = await readFile(
      join(candidate, "node_modules/@cloudflare/realtimekit/dist/browser.js"),
      "utf8",
    );
    for (const grant of context.grants) {
      stage = `join_generated_${grant.role}`;
      const page = await (
        await browser.newContext({ permissions: ["microphone", "camera"] })
      ).newPage();
      await page.route("**/archive-probe", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><html lang='en'><title>Synthetic archive recording probe</title><body>Generated audio and video only. Recording and private archive verification.</body></html>",
        }),
      );
      await page.goto(`${origin}/archive-probe`);
      await page.addScriptTag({ content: sdk });
      await page.evaluate(async (authToken) => {
        globalThis.__syntheticArchiveClient =
          await globalThis.RealtimeKitClient.init({
            authToken,
            defaults: { audio: true, video: true },
          });
        await globalThis.__syntheticArchiveClient.join();
      }, grant.authToken);
    }
    stage = cloudMode
      ? "cloud_resources_and_consent"
      : "native_consent_and_start";
    const runtimeFactory = cloudMode
      ? async (options) => {
          const { createCloudArchiveRuntime } = await import(
            "./realtimekit-cloud-archive-runtime.mjs"
          );
          return createCloudArchiveRuntime(options, process.env);
        }
      : undefined;
    archive = await createNativeArchiveProof({
      candidate,
      directory,
      context,
      credentials: process.env,
      runtimeFactory,
      includeFamilyArchive: process.env.ARCHIVE_VERIFY_CHAPTERS === "true",
    });
    checks.push(
      "actual_routes_require_two_consents_and_replay_start_idempotently",
    );
    async function until(phases, attempts = 120) {
      for (let i = 0; i < attempts; i++) {
        const state = await archive.state();
        if (phases.includes(state?.phase)) return state;
        if (
          ["failed", "discarded", "needs_review", "partial_preserved"].includes(
            state?.phase,
          )
        )
          throw new Error("archive_processing_failed");
        await wait(2000);
      }
      throw new Error("archive_processing_timeout");
    }
    stage = cloudMode
      ? "wait_for_cloud_recorders"
      : "wait_for_native_recorders";
    await until(["recording"], 45);
    checks.push("persistent_alarms_started_both_real_provider_recorders");
    await wait(10000);
    stage = "guest_stop";
    const stop = await archive.request(
      `/remote-recordings/${archive.recordingId}/stop`,
      "POST",
      archive.guest,
      {},
    );
    if (stop.status !== 202) throw new Error("archive_route_check_failed");
    stage = cloudMode ? "cloud_preservation" : "native_preservation";
    await until(["preserved"]);
    checks.push("guest_stop_confirmed_before_private_source_preservation");
    stage = "private_playback_and_integrity";
    let originals = await archive.verifyOriginals();
    if (process.env.ARCHIVE_VERIFY_CHAPTERS === "true") {
      await archive.verifyChapters();
      originals = await archive.verifyOriginals();
      checks.push(
        "private_chapter_retry_and_removal_preserve_all_recording_originals",
      );
    }
    if (cloudMode) {
      await archive.restart();
      originals = await archive.verifyOriginals();
      checks.push("cloud_originals_and_receipts_survive_worker_redeployment");
    }
    for (let i = 0; i < originals.length; i++) {
      const source = originals[i],
        file = join(directory, `private-source-${i}.media`);
      await writeFile(file, source.bytes, { mode: 0o600 });
      const { stdout } = await promisify(execFile)(
        "ffprobe",
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-count_frames",
          "-show_entries",
          "stream=codec_type,nb_read_frames:format=duration",
          "-of",
          "json",
          file,
        ],
        { timeout: 30000, maxBuffer: 65536, env: cleanEnv },
      );
      const info = JSON.parse(stdout),
        types =
          info.streams
            ?.filter((stream) => Number(stream.nb_read_frames) > 0)
            .map((stream) => stream.codec_type) ?? [];
      if (
        !types.includes("audio") ||
        (source.kind === "composite_video" && !types.includes("video")) ||
        (source.kind === "participant_audio" && types.includes("video")) ||
        !(Number(info.format?.duration) > 0)
      )
        throw new Error("archive_media_decode_failed");
      const decoded = await promisify(execFile)(
        "ffmpeg",
        [
          "-nostdin",
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-i",
          file,
          "-map",
          "0:a:0",
          "-t",
          "60",
          "-f",
          "s16le",
          "-ac",
          "1",
          "-ar",
          "8000",
          "pipe:1",
        ],
        {
          timeout: 30000,
          maxBuffer: 2 * 1024 * 1024,
          encoding: "buffer",
          env: cleanEnv,
        },
      );
      const pcm = decoded.stdout;
      let energy = 0,
        samples = 0;
      for (let offset = 0; offset + 1 < pcm.length; offset += 2) {
        const sample = pcm.readInt16LE(offset);
        energy += sample * sample;
        samples++;
      }
      if (!samples || energy / samples <= 64)
        throw new Error("archive_audio_signal_missing");
      mediaMetadata.push({
        kind: source.kind,
        audioDecoded: true,
        audioHasSignal: true,
        videoDecoded: types.includes("video"),
        durationKnown: true,
      });
    }
    checks.push(
      "all_private_playback_bytes_match_immutable_d1_hash_and_independent_r2_readback",
      "unauthorized_source_playback_denied",
      "full_and_ranged_private_playback_verified",
      "two_distinct_participant_microphone_sources_and_composite_decoded",
    );
    stage = "complete";
  } finally {
    // Provider cleanup runs in the enclosing staging operator even if native state failed.
    await browser?.close().catch(() => {});
    server?.kill();
    if (archive) {
      await archive.dispose();
      nativeCleanupConfirmed = true;
    }
  }
}
let result;
try {
  result = await runStagingProof(
    process.env,
    globalThis.fetch,
    async (context) => {
      try {
        await exercise(context);
      } catch (error) {
        const allowed = new Set([
          "archive_fixture_invalid",
          "archive_fixture_failed",
          "archive_route_check_failed",
          "archive_idempotence_failed",
          "archive_processing_failed",
          "archive_processing_timeout",
          "archive_sources_missing",
          "archive_private_playback_failed",
          "archive_integrity_failed",
          "archive_attribution_failed",
          "archive_media_decode_failed",
          "archive_audio_signal_missing",
          "archive_cloud_configuration_missing",
          "archive_cloud_subdomain_unavailable",
          "archive_cloud_bucket_privacy_unconfirmed",
          "archive_cloud_request_failed",
          "archive_cloud_response_invalid",
          "archive_cloud_query_unconfirmed",
          "archive_cloud_object_unconfirmed",
          "archive_cloud_module_path_invalid",
          "archive_cloud_worker_unavailable",
          "archive_cloud_route_invalid",
          "archive_cloud_cleanup_unconfirmed",
        ]);
        failureCode = allowed.has(error?.message)
          ? error.message
          : "archive_probe_execution_failed";
        if (
          Number.isInteger(error?.httpStatus) &&
          error.httpStatus >= 100 &&
          error.httpStatus <= 599
        )
          failureHttpStatus = error.httpStatus;
        if (Array.isArray(error?.providerCodes))
          failureProviderCodes = error.providerCodes
            .filter((code) => Number.isSafeInteger(code) && code >= 0)
            .slice(0, 8);
        throw error;
      }
    },
  );
} finally {
  await browser?.close().catch(() => {});
  server?.kill();
  await rm(directory, { recursive: true, force: true });
}
const report = {
  ...result,
  archiveProbeStage: stage,
  archiveChecks: checks,
  mediaMetadata,
  storageCleanupConfirmed: nativeCleanupConfirmed,
  ...(!cloudMode ? { nativeCleanupConfirmed } : {}),
  syntheticMaximumSeconds: 60,
  storageScope: cloudMode
    ? "isolated_cloud_worker_d1_private_r2"
    : "ephemeral_native_workerd_r2_d1",
  ...(failureCode ? { failureCode } : {}),
  ...(failureHttpStatus ? { failureHttpStatus } : {}),
  ...(failureProviderCodes?.length ? { failureProviderCodes } : {}),
};
console.log(JSON.stringify(report));
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Generated-media recording to private native archive\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\nReal Cloudflare recording and generated sources; actual application consent/start/stop/replay routes and persistent alarms. Storage scope is recorded above; isolated cloud mode additionally checks persistence across Worker redeployment. This is not production, long-term retention, physical-device, human consent or Clerk acceptance. No participant JWT, provider download URL, credential, media, source body or private filename is exported. All native storage and media files are removed.\n`,
  );
if (!result.ok) process.exitCode = 1;
