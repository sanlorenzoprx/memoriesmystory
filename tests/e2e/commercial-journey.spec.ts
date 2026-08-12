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
  await expect(page.getByRole("button", { name: "Secure payment connection coming next" })).toBeDisabled();
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
  await expect(page.getByRole("heading", { name: "Your family's next chapter starts with one story." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a Living Memory" })).toHaveAttribute("href", "/create");
});
