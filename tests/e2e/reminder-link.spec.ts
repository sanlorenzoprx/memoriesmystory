import { test, expect } from "@playwright/test";

// A reminder email's link opens straight into starting a new memory, exactly as
// tapping the first button would; nothing is sent to the server.
test("a reminder link opens straight into capture", async ({ page }) => {
  await page.goto("/?start=camera");
  await expect(page).toHaveURL(/\/capture\/[^/?]+\?start=camera$/);
  await page.goto("/?start=import");
  await expect(page).toHaveURL(/\/capture\/[^/?]+\?start=import$/);
  // Anything else leaves the start screen as it is.
  await page.goto("/?start=elsewhere");
  await expect(page).toHaveURL(/\/\?start=elsewhere$/);
});
