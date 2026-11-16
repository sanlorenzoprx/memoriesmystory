import { expect, test } from "@playwright/test";
import { translate } from "../../app/localization/messages";

const memoryId = "draft_share_ui_001";
const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";

for (const locale of ["en-US", "es-PR"] as const) {
const copy = (key: string) => translate(key, locale);
test(`${locale}: owner returns to a completed memory, cancels then confirms link revocation`, async ({ page }) => {
  let revokedAt: string | null = null;
  let deletes = 0;
  await page.route("**/resources/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/living-memory")) {
      await route.fulfill({ json: {
        livingMemoryId: memoryId, status: "complete", completedAt: "2026-11-13T12:00:00Z",
        originals: { photo: { assetId: "photo_ui_001", mediaUrl: photo }, audio: { assetId: "audio_ui_001", mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF" } },
        transcript: null, musePrompt: null, context: []
      } });
    } else if (path.endsWith("/shares")) {
      await route.fulfill({ json: { shares: [{ shareId: "share_ui_001", createdAt: "2026-11-13T12:01:00Z", revokedAt,
        visibility: "private_link", selection: { includePhoto: true, includeVoice: true, includeCaptions: false, includeNarratorAttribution: false, includeBrandAttribution: true } }], nextCursor: null } });
    } else if (path.endsWith("/shares/share_ui_001") && request.method() === "DELETE") {
      expect(request.headers()["x-memories-request"]).toBe("share-v1");
      deletes += 1;
      revokedAt = "2026-11-13T12:05:00Z";
      await route.fulfill({ json: { ok: true, shareId: "share_ui_001", revoked: true } });
    } else await route.fallback();
  });
  await page.goto(`/memory/${memoryId}`);
  await page.getByRole("combobox", { name: "Interface language" }).selectOption(locale);
  await page.reload();
  await page.getByRole("button", { name: copy("Manage family links"), exact: true }).click();
  await expect(page.getByText(copy("Active"), { exact: true })).toBeVisible();
  await expect(page.getByText(copy("Anyone with a family link can open it without signing in. Revoke a link to stop future access; copies already downloaded or shared elsewhere cannot be recalled."))).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: copy("Revoke family link"), exact: true }).click();
  expect(deletes).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: copy("Revoke family link"), exact: true }).click();
  await expect(page.getByText(copy("Revoked"), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: copy("Revoke family link"), exact: true })).toHaveCount(0);
  expect(deletes).toBe(1);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe(copy("Delete this Living Memory, including its photograph, voice, private shared conversations, speaker notes, transcript, Muse material and family links? This cannot be undone."));
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: copy("Delete this memory"), exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: copy("Manage family links"), exact: true }).click();
  await expect(page.getByText(copy("Revoked"), { exact: true })).toBeVisible();
});

test(`${locale}: a new family link can be handed to WhatsApp or Facebook, with its reach said plainly`, async ({ page }) => {
  const token = "a".repeat(43);
  await page.route("**/resources/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/living-memory")) {
      await route.fulfill({ json: {
        livingMemoryId: memoryId, status: "complete", completedAt: "2026-11-13T12:00:00Z",
        originals: { photo: { assetId: "photo_ui_001", mediaUrl: photo }, audio: { assetId: "audio_ui_001", mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF" } },
        transcript: null, musePrompt: null, context: []
      } });
    } else if (path.endsWith("/share-preview")) {
      await route.fulfill({ json: { preview: { captionTranscriptRevisionId: null, photo: true, voice: true, captions: null, narratorAttribution: null, brandAttribution: null, caption: null } } });
    } else if (path.endsWith("/shares") && request.method() === "POST") {
      await route.fulfill({ status: 201, json: { shareId: "share_ui_002", sharePath: `/shared/${token}`, revoked: false, replayed: false } });
    } else if (path.endsWith("/shares")) {
      await route.fulfill({ json: { shares: [], nextCursor: null } });
    } else await route.fallback();
  });
  await page.goto(`/memory/${memoryId}`);
  await page.getByRole("combobox", { name: "Interface language" }).selectOption(locale);
  await page.reload();
  await page.getByRole("button", { name: copy("Share with family"), exact: true }).click();
  await page.getByRole("button", { name: copy("Preview what family will see"), exact: true }).click();
  await page.getByRole("button", { name: copy("Create private family link"), exact: true }).click();
  await expect(page.getByText(copy("Anyone who receives this link can open it without signing in. On Facebook, everyone who can see your post can open it. You can revoke the link to stop future access, but copies people already saved cannot be recalled."), { exact: true })).toBeVisible();
  const shareUrl = new URL(`/shared/${token}?lang=${locale}`, page.url()).href;
  const whatsapp = new URL((await page.getByRole("link", { name: copy("Send on WhatsApp"), exact: true }).getAttribute("href"))!);
  expect(whatsapp.origin).toBe("https://wa.me");
  expect(whatsapp.searchParams.get("text")).toBe(`${copy("I wanted to share this memory with you.")} ${shareUrl}`);
  const facebook = new URL((await page.getByRole("link", { name: copy("Share on Facebook"), exact: true }).getAttribute("href"))!);
  expect(facebook.origin + facebook.pathname).toBe("https://www.facebook.com/sharer/sharer.php");
  expect(facebook.searchParams.get("u")).toBe(shareUrl);
  // Only the bounded share link leaves: never the memory's private address.
  expect(whatsapp.href).not.toContain(memoryId);
  expect(facebook.href).not.toContain(memoryId);
});

}
