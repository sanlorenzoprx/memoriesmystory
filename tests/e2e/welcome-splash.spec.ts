import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with a stubbed server: the welcome splash appears only
// for a signed-in person who has finished Living Memories, shows one of their
// own photographs — with no words over it — for about three seconds, once per
// visit, and never for a new visitor or on a deep link.
const photo = readFileSync(new URL("../fixtures/synthetic-family-photo.png", import.meta.url));

async function stub(page: Page, options: { signedIn: boolean; complete: number }) {
  const photoRequests: string[] = [];
  await page.route("**/resources/archive/drafts**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!options.signedIn) return route.fulfill({ status: 401, json: { ok: false, error: { code: "session_required", message: "Sign in" } } });
    if (path.endsWith("/drafts"))
      return route.fulfill({ json: { drafts: Array.from({ length: options.complete }, (_, i) => ({ id: `memory_welcome_${i}`, status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" })) } });
    const id = path.split("/").pop()!;
    return route.fulfill({ json: { draft: { id, status: "complete" }, assets: [{ id: `${id}_photo`, role: "original_photo", contentType: "image/png", byteSize: photo.length, durationMs: null, sha256: "a".repeat(64), createdAt: "2026-11-14T00:00:00Z", mediaUrl: `/resources/drafts/${id}/media/${id}_photo` }] } });
  });
  await page.route("**/resources/drafts/*/media/*", (route) => {
    photoRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: "image/png", body: photo });
  });
  return photoRequests;
}

for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: a returning signed-in person sees one of their own photographs for about three seconds, once per visit`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    const photos = await stub(page, { signedIn: true, complete: 3 });
    await page.goto("/");
    const splash = page.locator(".welcome-splash");
    await expect(splash.getByRole("img", { name: copy("A photograph from one of your Living Memories"), exact: true })).toBeVisible();
    // The image is the whole message: no visible words and no buttons on the splash.
    expect((await splash.innerText()).trim()).toBe("");
    await expect(splash.getByRole("button")).toHaveCount(0);
    expect(photos[0]).toMatch(/^\/resources\/drafts\/memory_welcome_\d\/media\/memory_welcome_\d_photo$/);
    // It closes by itself after about three seconds.
    await expect(splash).toBeHidden({ timeout: 5000 });
    // Once per visit: a reload in the same visit does not show it again.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(splash).toHaveCount(0);
  });

test("a tap closes it at once, and the archive setting turns it off for good", async ({ page }) => {
  await stub(page, { signedIn: true, complete: 1 });
  await page.goto("/archive");
  const splash = page.locator(".welcome-splash");
  await expect(splash).toBeVisible();
  await splash.click();
  await expect(splash).toHaveCount(0);
  const setting = page.getByRole("checkbox", { name: "Show one of my photographs when I open the app", exact: true });
  await expect(setting).toBeChecked();
  await setting.uncheck();
  // A new visit (new tab session) respects the choice.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(splash).toHaveCount(0);
  // Turning it back on shows it again in the next visit.
  await page.goto("/archive");
  await page.getByRole("checkbox", { name: "Show one of my photographs when I open the app", exact: true }).check();
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/");
  await expect(splash).toBeVisible();
});

test("a new visitor, a person with no finished memory, and a deep link never see it", async ({ page }) => {
  await stub(page, { signedIn: false, complete: 0 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".welcome-splash")).toHaveCount(0);

  const other = await page.context().newPage();
  await stub(other, { signedIn: true, complete: 0 });
  await other.goto("/");
  await other.waitForLoadState("networkidle");
  await expect(other.locator(".welcome-splash")).toHaveCount(0);

  const deep = await page.context().newPage();
  await stub(deep, { signedIn: true, complete: 2 });
  await deep.goto("/?start=import");
  await deep.waitForURL(/\/capture\//);
  await expect(deep.locator(".welcome-splash")).toHaveCount(0);
});
