import { expect, test } from "@playwright/test";

const draftId = "draft_recovery_001";
const snapshot = {
  livingMemoryId: draftId, status: "draft", completedAt: null,
  originals: {
    photo: { assetId: "photo_recovery_001", mediaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=" },
    audio: { assetId: "audio_recovery_001", mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF" }
  }, transcript: { revisionId: "transcript_recovery_001", text: "We gathered around the table.", locale: "en-US" },
  musePrompt: null, context: []
};
const question = { turnId: "turn_recovery_001", index: 0, speaker: "muse", content: "What comes back when you look at this photograph?", focus: "detail", state: null, replyTo: null, voiceReplyAssetId: null, voiceReplyMediaUrl: null, createdAt: "2026-11-13T12:00:00Z" };
const conversation = { livingMemoryId: draftId, turns: [question], context: [], unresolved: ["person", "place", "time", "event"], done: false, currentQuestion: question };

test("a failed transcript resumes polling after retry without a reload", async ({ page }) => {
  let polls = 0;
  let retries = 0;
  await page.route("**/resources/drafts/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/living-memory")) await route.fulfill({ json: snapshot });
    else if (path.endsWith("/process")) {
      if (request.method() === "POST") {
        retries += 1;
        await route.fulfill({ json: { state: "queued", livingMemoryId: draftId, transcript: null } });
      } else {
        polls += 1;
        await route.fulfill({ json: { state: retries ? "ready" : polls === 1 ? "queued" : "failed", livingMemoryId: draftId, transcript: retries ? snapshot.transcript : null } });
      }
    } else if (path.endsWith("/muse-conversation")) await route.fulfill({ json: conversation });
    else await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Voice unavailable." } } });
  });
  await page.goto(`/memory/${draftId}`);
  await page.getByRole("button", { name: "Try transcript again" }).click();
  await expect(page.getByText(question.content, { exact: true })).toBeVisible();
  expect(retries).toBe(1);
  expect(polls).toBeGreaterThan(2);
});

test("Muse can be stopped and replayed; original text stays visible when playback is rejected", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { plays: 0, pauses: 0, reject: false, created: 0, revoked: 0 };
    Object.assign(window, { speechTest: state });
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { state.created += 1; return create(blob); };
    URL.revokeObjectURL = (url) => { state.revoked += 1; revoke(url); };
    window.Audio = class extends EventTarget {
      async play() { state.plays += 1; if (state.reject) throw new Error("Playback needs a gesture"); }
      pause() { state.pauses += 1; }
    } as unknown as typeof Audio;
  });
  let ttsCalls = 0;
  await page.route("**/resources/drafts/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/living-memory")) await route.fulfill({ json: snapshot });
    else if (path.endsWith("/process")) await route.fulfill({ json: { state: "ready", livingMemoryId: draftId, transcript: snapshot.transcript } });
    else if (path.endsWith("/muse-conversation")) await route.fulfill({ json: conversation });
    else if (path.endsWith("/muse-tts")) {
      ttsCalls += 1;
      await route.fulfill({ contentType: "audio/mpeg", body: Buffer.from([1, 2, 3, 4]) });
    } else await route.fallback();
  });
  await page.goto(`/memory/${draftId}`);
  const stop = page.getByRole("button", { name: "Stop Muse", exact: true });
  await expect(stop).toContainText("Stop Muse");
  await stop.click();
  expect(ttsCalls).toBe(1);
  await page.getByRole("button", { name: "Hear Muse", exact: true }).click();
  await expect(stop).toContainText("Stop Muse");
  await stop.click();
  expect(ttsCalls).toBe(2);
  await page.evaluate(() => { (window as unknown as { speechTest: { reject: boolean } }).speechTest.reject = true; });
  await page.getByRole("button", { name: "Hear Muse", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hear Muse", exact: true })).toContainText("Try Muse voice again");
  await expect(page.getByText(question.content, { exact: true })).toBeVisible();
  const state = await page.evaluate(() => (window as unknown as { speechTest: { created: number; revoked: number } }).speechTest);
  expect(state.created).toBe(3);
  expect(state.revoked).toBe(state.created);
});
