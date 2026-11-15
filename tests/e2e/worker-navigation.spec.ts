import { expect, test } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// A recipient opens a family link by navigating to it. Browser navigations are
// answered by the app shell unless the path is listed in run_worker_first, so
// these tests use real navigations and no route mocks.
const unknownToken = "a".repeat(43);

test("a family link opened in the browser is answered by the share page, not the app shell", async ({ page }) => {
  const response = await page.goto(`/shared/${unknownToken}`);
  expect(response).not.toBeNull();
  // An unknown or unconfigured link is refused by the Worker; the app shell would answer 200.
  expect([404, 503]).toContain(response!.status());
  expect(response!.headers()["content-security-policy"]).toContain("default-src 'none'");
  expect(response!.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("heading", {
    name: translate("This family link is unavailable. Ask its owner for a new link.", "en-US")
  })).toBeVisible();
  await expect(page.locator("#root")).toHaveCount(0);
});

test("shared media and resource addresses opened directly never fall back to the app shell", async ({ page }) => {
  for (const path of [`/shared/${unknownToken}/photo`, `/shared/${unknownToken}/voice`, "/resources/auth/me"]) {
    const response = await page.goto(path);
    expect(response!.status(), path).toBeGreaterThanOrEqual(400);
    expect(response!.headers()["content-type"], path).toContain("application/json");
  }
  const health = await page.goto("/health");
  expect(health!.status()).toBe(200);
  expect(health!.headers()["content-type"]).toContain("application/json");
});

test("application deep links still open the app after a direct navigation", async ({ page }) => {
  for (const path of ["/archive", "/family/join/example-invitation"]) {
    const response = await page.goto(path);
    expect(response!.status(), path).toBe(200);
    await expect(page.locator("#root"), path).toHaveCount(1);
  }
});
