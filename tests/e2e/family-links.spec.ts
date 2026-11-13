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
    expect(dialog.message()).toBe(copy("Delete this Living Memory, including its preserved photograph, voice, transcript, Muse material and family links? This cannot be undone."));
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: copy("Delete this memory"), exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: copy("Manage family links"), exact: true }).click();
  await expect(page.getByText(copy("Revoked"), { exact: true })).toBeVisible();
});

}
