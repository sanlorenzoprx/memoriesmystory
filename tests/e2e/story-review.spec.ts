import { expect, test, type Page } from "@playwright/test";

const draftId = "draft_review_ui_001";
const originalText = "We gathered around the table.";
const question = "What detail comes back when you look at this photograph?";

type Context = { kind: "person" | "place" | "time" | "event"; state: "stated" | "approximate" | "unknown" | "omitted"; value: string | null };
async function install(page: Page, initialStatus: "draft" | "complete" = "draft", withTranscript = true) {
  const state = { status: initialStatus, version: 1, text: originalText, context: [] as Context[],
    corrected: false, edits: [] as { body: { expectedVersion: number; transcriptText: string; context: Context[] }; key: string }[],
    completions: [] as Record<string, unknown>[], failNext: false, conversationPosts: 0 };
  await page.route("**/resources/drafts/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/living-memory")) {
      if (request.method() === "POST") {
        state.completions.push(request.postDataJSON());
        state.status = "complete";
        state.version += 1;
        await route.fulfill({ json: { livingMemoryId: draftId, completedAt: "2026-11-13T12:00:00Z", activationRecorded: true, replayed: false } });
      } else await route.fulfill({ json: {
        livingMemoryId: draftId, status: state.status, version: state.version,
        completedAt: state.status === "complete" ? "2026-11-13T12:00:00Z" : null,
        originals: {
          photo: { assetId: "photo_review_ui_001", mediaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=" },
          audio: { assetId: "audio_review_ui_001", mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF" }
        }, transcript: withTranscript ? { revisionId: state.corrected ? "transcript_corrected_ui" : "transcript_machine_ui", text: state.text, locale: "es-PR", revisionKind: state.corrected ? "corrected_transcript" : "machine_transcript" } : null,
        context: state.context.map((entry) => ({ ...entry, id: `context_ui_${entry.kind}`, livingMemoryId: draftId, createdByUserId: "owner_ui_001", createdAt: "2026-11-13T12:00:00Z", updatedAt: "2026-11-13T12:00:00Z", sourceRef: null })), musePrompt: null
      } });
    } else if (path.endsWith("/process")) {
      await route.fulfill({ json: { state: withTranscript ? "ready" : "failed", livingMemoryId: draftId, transcript: withTranscript ? { revisionId: "transcript_machine_ui", text: originalText, locale: "es-PR" } : null } });
    } else if (path.endsWith("/muse-conversation")) {
      if (request.method() === "POST") state.conversationPosts += 1;
      const turn = { turnId: "turn_review_ui_001", index: 0, speaker: "muse", content: question, focus: "detail", state: null, replyTo: null, voiceReplyAssetId: null, voiceReplyMediaUrl: null, createdAt: "2026-11-13T12:00:00Z" };
      await route.fulfill({ json: { livingMemoryId: draftId, turns: [turn], context: [], unresolved: ["person", "place", "time", "event"], done: false, currentQuestion: turn } });
    } else if (path.endsWith("/review")) {
      if (request.method() === "PUT") {
        state.edits.push({ body: request.postDataJSON(), key: request.headers()["x-idempotency-key"]! });
        if (state.failNext) {
          state.failNext = false;
          await route.fulfill({ status: 503, json: { error: { code: "retry", message: "The save needs another try." } } });
        } else {
          state.text = request.postDataJSON().transcriptText;
          state.context = request.postDataJSON().context;
          state.corrected = true;
          state.version += 1;
          await route.fulfill({ status: 201, json: { reviewId: "review_saved_ui_001", replayed: false } });
        }
      } else await route.fulfill({ json: {
        originalTranscript: { id: "transcript_machine_ui", text: originalText, locale: "es-PR", created_at: "2026-11-13T12:00:00Z" },
        revisions: state.corrected ? [{ reviewId: "review_saved_ui_001", kind: "edit", baseVersion: 1, authorId: "owner_ui_001", createdAt: "2026-11-13T12:00:00Z", photoAssetId: "photo_review_ui_001", audioAssetId: "audio_review_ui_001", transcriptRevisionId: "transcript_corrected_ui", transcriptText: state.text, locale: "es-PR", context: state.context }] : [], nextCursor: null
      } });
    } else await route.fulfill({ status: 503, json: { error: { code: "voice_unavailable", message: "Voice is unavailable; text remains available." } } });
  });
  return state;
}

test("finish after the first Muse question without answering optional anchors", async ({ page }) => {
  const state = await install(page);
  await page.goto(`/memory/${draftId}`);
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish for now" }).click();
  const preserve = page.getByRole("button", { name: "Preserve this Living Memory" });
  await expect(preserve).toBeDisabled();
  await page.getByRole("checkbox", { name: "I want to preserve this photograph and my original voice." }).check();
  await preserve.click();
  await expect(page.getByRole("heading", { name: "This memory is now part of your family's history." })).toBeVisible();
  expect(state.conversationPosts).toBe(0);
  expect(state.completions).toEqual([{ confirmOriginals: true, expectedVersion: 1 }]);
});

test("preserve originals while transcription is unavailable", async ({ page }) => {
  const state = await install(page, "draft", false);
  await page.goto(`/memory/${draftId}`);
  await page.getByRole("button", { name: "Finish for now" }).click();
  await expect(page.getByRole("button", { name: "Edit details" })).toBeVisible();
  await page.getByRole("checkbox", { name: "I want to preserve this photograph and my original voice." }).check();
  await page.getByRole("button", { name: "Preserve this Living Memory" }).click();
  await expect(page.getByRole("heading", { name: "This memory is now part of your family's history." })).toBeVisible();
  expect(state.completions).toHaveLength(1);
  expect(state.conversationPosts).toBe(0);
});

test("edit completed testimony, recover a failed save, and reopen original and revised text", async ({ page }) => {
  const state = await install(page, "complete");
  await page.goto(`/memory/${draftId}`);
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByRole("textbox", { name: "Edit transcript", exact: true }).fill("I remember the blue tablecloth.");
  await page.getByLabel("When certainty").selectOption("approximate");
  await page.getByLabel("When details").fill("Around 1985");
  state.failNext = true;
  await page.getByRole("button", { name: "Save my changes" }).click();
  await expect(page.getByRole("alert")).toContainText("unsaved words remain");
  await expect(page.getByRole("textbox", { name: "Edit transcript", exact: true })).toHaveValue("I remember the blue tablecloth.");
  await page.getByRole("button", { name: "Save my changes" }).click();
  await expect(page.getByText("Your revised transcript", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit details", exact: true })).toBeFocused();
  expect(state.edits[0]!.key).toBe(state.edits[1]!.key);
  expect(state.edits[1]!.body.expectedVersion).toBe(1);
  expect(state.edits[1]!.body.context.find((entry) => entry.kind === "time")).toMatchObject({ state: "approximate", value: "Around 1985" });
  expect(state.completions).toHaveLength(0);
  await page.reload();
  await expect(page.getByText("I remember the blue tablecloth.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revision history" }).click();
  await page.getByText("Original machine transcript", { exact: true }).click();
  await expect(page.getByText(originalText, { exact: true })).toBeVisible();
});

test("an unsent reply requires a deliberate discard choice before finishing", async ({ page }) => {
  await install(page);
  await page.goto(`/memory/${draftId}`);
  await page.getByPlaceholder("Tell Muse what comes back to you").fill("My unsent recollection.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Finish for now" }).click();
  await expect(page.getByPlaceholder("Tell Muse what comes back to you")).toHaveValue("My unsent recollection.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish for now" }).click();
  await expect(page.getByRole("button", { name: "Preserve this Living Memory" })).toBeVisible();
});


test("Spanish review keeps testimony and unsaved edits unchanged across language switches", async ({ page }) => {
  const state = await install(page, "complete");
  await page.goto(`/memory/${draftId}`);
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("es-PR");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-PR");
  await expect(page.getByText(originalText, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar detalles", exact: true }).click();
  const edited = "Your story stays with you.";
  const editor = page.getByRole("textbox", { name: "Editar transcripción", exact: true });
  await editor.fill(edited);
  await page.getByRole("combobox", { name: "Idioma de la interfaz" }).selectOption("en-US");
  await expect(page.getByRole("textbox", { name: "Edit transcript", exact: true })).toHaveValue(edited);
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("es-US");
  await expect(editor).toHaveValue(edited);
  state.failNext = true;
  await page.getByRole("button", { name: "Guardar mis cambios", exact: true }).click();
  await expect(page.getByRole("alert")).not.toContainText("The save needs another try.");
  await expect(page.getByRole("alert")).toContainText("sin guardar");
  await expect(editor).toHaveValue(edited);
  await page.getByRole("button", { name: "Guardar mis cambios", exact: true }).click();
  await expect(page.getByText(edited, { exact: true })).toBeVisible();
  expect(state.text).toBe(edited);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-US");
  await expect(page.getByText(edited, { exact: true })).toBeVisible();
});

test("Spanish finish confirms originals without requiring optional details", async ({ page }) => {
  const state = await install(page);
  await page.goto(`/memory/${draftId}`);
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("es-PR");
  await page.getByRole("button", { name: "Terminar por ahora", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Conservar este Recuerdo Vivo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Este recuerdo ya forma parte de la historia de tu familia." })).toBeVisible();
  expect(state.completions).toEqual([{ confirmOriginals: true, expectedVersion: 1 }]);
  expect(state.conversationPosts).toBe(0);
});
