import { expect, test } from "@playwright/test";

test("the paid Chapter choice survives sign-in intent and opens the matching checkout locally", async ({
  page
}) => {
  await page.goto("/#pricing");

  await page.getByRole("link", { name: "Preserve a Chapter" }).click();
  await expect(page).toHaveURL(/\/auth\/protect\?intent=checkout&offer=chapter/);
  await expect(page.getByRole("heading", { name: "Continue with Chapter." })).toBeVisible();
  await expect(page.getByText("You chose Chapter. After sign-in, you go directly to the Chapter checkout page.")).toBeVisible();

  await page.getByRole("link", { name: "Continue in this local environment" }).click();
  await expect(page).toHaveURL(/\/checkout\/chapter$/);
  await expect(page.getByRole("heading", { level: 1, name: "Preserve a meaningful chapter." })).toBeVisible();
  await expect(page.getByText("$247").first()).toBeVisible();
  await expect(page.getByText("Secure payment is ready for Stripe staging configuration.")).toBeVisible();
  await expect(page.getByText("No card details are collected here.")).toBeVisible();
});

test("a thank-you URL alone never unlocks paid access", async ({ page }) => {
  await page.goto("/thank-you/life?session_id=cs_test_unverified_001");
  await expect(page.getByRole("heading", { name: "Your Life has not been activated yet." })).toBeVisible();
  await expect(page.getByText("Purchased access is never granted from the page address alone.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a Living Memory" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Return to secure checkout" })).toHaveAttribute("href", "/checkout/life");
});

test("a verified paid entitlement changes creation from free-first to purchased continuation", async ({ page }) => {
  await page.route("**/api/entitlements", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        entitlements: {
          grants: [],
          effective: {
            id: "grant_test_life",
            accountId: "user_test",
            sourceOrderId: "order_test_life",
            offerId: "life",
            livingMemoryLimit: 100,
            voiceSecondsPerMemory: 600,
            memoryCircleEnabled: true,
            familyArchiveLevel: "life",
            grantedAt: "2026-08-12T12:00:00.000Z",
            revokedAt: null
          }
        }
      })
    });
  });

  await page.goto("/create");
  await expect(page.getByText("Your Life is ready")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start the next Living Memory." })).toBeVisible();
  await expect(page.getByText("Your first Living Memory is free")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Capture Your Memories" })).toBeEnabled();
});

test("brand identity stays present across landing, creation, checkout, and thank-you routes", async ({
  page
}) => {
  for (const route of ["/", "/create", "/checkout/life", "/thank-you/life"]) {
    await page.goto(route);
    await expect(
      page.getByRole("banner", { name: "MemoriesMyStory" }).getByRole("link", { name: "MemoriesMyStory home" })
    ).toBeVisible();
    await expect(page.locator('link[rel="icon"][href="/favicon.svg"]')).toHaveCount(1);
  }

  await page.goto("/thank-you/life");
  await expect(page.getByRole("heading", { name: "Your Life has not been activated yet." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to secure checkout" })).toHaveAttribute("href", "/checkout/life");
});
