import { expect, test } from "@playwright/test";

test("the first screen expresses the approved memory-preservation promise", async ({
  page
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Old photographs fade. The voices behind them should not."
    })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Capture a photo. Tell its story. Preserve your voice for the people you love."
    )
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Capture Your Memories" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import a photo" })).toBeVisible();
  await expect(page.getByText(/Muse|truthful save status/i)).toHaveCount(0);
});

test("both first-screen actions preserve their intended capture path", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Capture Your Memories" }).click();
  await expect(page).toHaveURL(/\/first-memory\?start=camera$/);
  await expect(
    page.getByRole("heading", { name: "Bring the photograph into the light." })
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Import a photo" }).click();
  await expect(page).toHaveURL(/\/first-memory\?start=import$/);
  await expect(
    page.getByRole("heading", {
      name: "Choose the photograph that brings the story back."
    })
  ).toBeVisible();
});
