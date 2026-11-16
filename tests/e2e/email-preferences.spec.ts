import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with a stubbed server: optional emails start off, a
// failed save is said plainly, and a saved choice is shown only after the
// server confirms it.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: optional emails start off and a choice is shown saved only after confirmation`, async ({ page }) => {
    const copy = (key: string) => translate(key, locale);
    let stored = { family_updates: false, owner_reminders: false, reminderCadence: "weekly", version: 0 },
      failNext = true;
    const puts: unknown[] = [];
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) => route.fulfill({ json: { drafts: [] } }));
    await page.route("**/resources/email/preferences", (route) => {
      const request = route.request();
      if (request.method() === "GET") return route.fulfill({ json: stored });
      expect(request.headers()["x-memories-request"]).toBe("email-v1");
      puts.push(request.postDataJSON());
      if (failNext) {
        failNext = false;
        return route.fulfill({ status: 503, json: { error: { code: "unavailable" } } });
      }
      stored = { ...request.postDataJSON(), version: stored.version + 1 };
      return route.fulfill({ json: stored });
    });
    await page.goto("/archive");
    await page.getByText(copy("Email choices"), { exact: true }).click();
    const reminder = page.getByLabel(copy("Email me an occasional reminder to add a memory"), { exact: true });
    await expect(reminder).not.toBeChecked();
    await expect(page.getByLabel(copy("Email me when something new is shared with me"), { exact: true })).not.toBeChecked();

    await reminder.click();
    await expect(page.getByRole("alert")).toHaveText(copy("Something went wrong. Please try again."));
    await expect(page.getByText(copy("Your email choices are saved."), { exact: true })).toHaveCount(0);
    await expect(reminder).not.toBeChecked();

    await reminder.click();
    await expect(page.getByText(copy("Your email choices are saved."), { exact: true })).toBeVisible();
    await expect(reminder).toBeChecked();
    expect(puts.at(-1)).toEqual({ family_updates: false, owner_reminders: true, reminderCadence: "weekly", version: 0 });
    // Once reminders are on, the person chooses how often; weekly is preselected.
    const often = page.getByLabel(copy("How often"), { exact: true });
    await expect(often).toHaveValue("weekly");
    await often.selectOption("biweekly");
    await expect(often).toHaveValue("biweekly");
    expect(puts.at(-1)).toEqual({ family_updates: false, owner_reminders: true, reminderCadence: "biweekly", version: 1 });
  });
