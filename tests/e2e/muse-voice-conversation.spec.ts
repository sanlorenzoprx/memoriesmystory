import { expect, test } from "@playwright/test";

const draftId = "draft_voice_ui_001";
const museTurnId = "muse_turn_voice_ui_001";
const voiceAssetId = "muse_voice_ui_001";

const snapshot = {
  livingMemoryId: draftId,
  status: "draft",
  completedAt: null,
  originals: {
    photo: {
      assetId: "asset_photo_voice_ui",
      mediaUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII="
    },
    audio: {
      assetId: "asset_audio_voice_ui",
      mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF"
    }
  },
  transcript: {
    revisionId: "transcript_voice_ui_001",
    text: "I remember everyone gathering around Abuela's table.",
    locale: "en-US"
  },
  musePrompt: null,
  context: []
};

const firstQuestion = {
  turnId: museTurnId,
  index: 0,
  speaker: "muse",
  content: "What detail from that gathering comes back most clearly?",
  focus: "detail",
  state: null,
  replyTo: null,
  voiceReplyAssetId: null,
  voiceReplyMediaUrl: null,
  createdAt: "2026-09-23T12:00:00.000Z"
};

test("storyteller can answer Muse by preserved voice and continue the conversation", async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (!constraints.audio) throw new Error("Synthetic microphone expected");
          const context = new AudioContext();
          await context.resume();
          const oscillator = context.createOscillator();
          const destination = context.createMediaStreamDestination();
          oscillator.frequency.value = 220;
          oscillator.connect(destination);
          oscillator.start();
          return destination.stream;
        }
      }
    });
  });

  let conversationPosts = 0;
  let sentConversationBody: Record<string, unknown> | null = null;

  await page.route("**/resources/drafts/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith("/living-memory") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot)
      });
      return;
    }

    if (path.endsWith("/process") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "ready",
          livingMemoryId: draftId,
          transcript: snapshot.transcript
        })
      });
      return;
    }

    if (path.endsWith("/muse-conversation") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          livingMemoryId: draftId,
          turns: [firstQuestion],
          context: [],
          unresolved: ["person", "place", "time", "event"],
          done: false,
          currentQuestion: firstQuestion
        })
      });
      return;
    }

    if (path.endsWith("/muse-conversation") && method === "POST") {
      conversationPosts += 1;
      sentConversationBody = JSON.parse(request.postData() ?? "{}") as Record<
        string,
        unknown
      >;
      const storytellerTurn = {
        turnId: "story_turn_voice_ui_001",
        index: 1,
        speaker: "storyteller",
        content: "I remember the bright red pot on the stove.",
        focus: "detail",
        state: "stated",
        replyTo: museTurnId,
        voiceReplyAssetId: voiceAssetId,
        voiceReplyMediaUrl: `/resources/drafts/${draftId}/muse-voice-replies/${voiceAssetId}/media`,
        createdAt: "2026-09-23T12:00:10.000Z"
      };
      const nextQuestion = {
        turnId: "muse_turn_voice_ui_002",
        index: 2,
        speaker: "muse",
        content: "Who do you remember being there with you?",
        focus: "person",
        state: null,
        replyTo: null,
        voiceReplyAssetId: null,
        voiceReplyMediaUrl: null,
        createdAt: "2026-09-23T12:00:11.000Z"
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          livingMemoryId: draftId,
          turns: [firstQuestion, storytellerTurn, nextQuestion],
          context: [],
          unresolved: ["person", "place", "time", "event"],
          done: false,
          currentQuestion: nextQuestion
        })
      });
      return;
    }

    if (path.includes("/muse-voice-replies/") && method === "PUT") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          state: "ready",
          replayed: false,
          voiceReply: {
            assetId: voiceAssetId,
            replyToTurnId: museTurnId,
            byteSize: 2048,
            durationMs: 900,
            sha256: "a".repeat(64),
            r2Etag: "etag-voice-ui",
            durabilityStatus: "durable",
            transcript: "I remember the red pot on the stove.",
            locale: "eng",
            storytellerText: null,
            storytellerConfirmedAt: null,
            transcribedAt: "2026-09-23T12:00:09.000Z",
            mediaUrl: `/resources/drafts/${draftId}/muse-voice-replies/${voiceAssetId}/media`
          }
        })
      });
      return;
    }

    if (path.endsWith("/muse-tts") && method === "POST") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "muse_tts_not_configured", message: "Voice unavailable." }
        })
      });
      return;
    }

    if (path.endsWith("/media") && path.includes("/muse-voice-replies/")) {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "audio/webm" },
        body: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00])
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/memory/${draftId}`);

  await expect(
    page.getByText("What detail from that gathering comes back most clearly?", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "Answer with voice" }).click();
  await expect(page.getByText("Answering Muse")).toBeVisible();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Stop" }).click();

  await expect(page.getByText("Listen before you send it")).toBeVisible();
  await page.getByRole("button", { name: "Use this voice reply" }).click();

  await expect(page.getByText("Muse heard:")).toBeVisible();
  const transcript = page.getByLabel("Review the transcript Muse heard");
  await expect(transcript).toHaveValue("I remember the red pot on the stove.");
  await transcript.fill("I remember the bright red pot on the stove.");

  await page.getByRole("button", { name: "Send voice reply to Muse" }).click();

  await expect(
    page.getByText("I remember the bright red pot on the stove.", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Who do you remember being there with you?", { exact: true })
  ).toBeVisible();
  await expect(page.locator(".storyteller-voice-reply-player")).toHaveCount(1);

  expect(conversationPosts).toBe(1);
  expect(sentConversationBody).toMatchObject({
    replyToTurnId: museTurnId,
    answer: "I remember the bright red pot on the stove.",
    state: "stated",
    voiceReplyAssetId: voiceAssetId
  });
});
