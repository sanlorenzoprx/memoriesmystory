import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { FamilyTimelineResponse } from "../../app/domain/family-timeline";

// Synthetic UI evidence with stubbed routes; ordering and privacy are proven
// against the Worker in tests/integration/family-timeline.test.ts.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: the timeline orders by the year the storyteller named and keeps approximate and unknown dates as such`, async ({
    page,
  }) => {
    const copy = (key: string, values?: Record<string, string | number>) =>
      translate(key, locale, values);
    let fail = true;
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({
        json: { drafts: [{ id: "memory_timeline_a", status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] },
      }),
    );
    await page.route("**/resources/family-archives**", (route) =>
      route.fulfill({ json: { archives: [], nextCursor: null } }),
    );
    await page.route("**/resources/family-timeline", (route) => {
      if (fail) {
        fail = false;
        return route.fulfill({ status: 503, json: { error: { code: "family_timeline_unavailable" } } });
      }
      const body: FamilyTimelineResponse = {
        truncated: false,
        entries: [
          { memoryId: "memory_timeline_c", title: "Boda de Lucía", when: { text: "junio de 1951", approximate: false }, orderingYear: 1951 },
          { memoryId: "memory_timeline_a", title: "La cocina de la tía María", when: { text: "verano de 1950, creo", approximate: true }, orderingYear: 1950 },
          { memoryId: "memory_timeline_b", title: "Una Navidad", when: { text: "una Navidad", approximate: false }, orderingYear: null },
          { memoryId: "memory_timeline_d", title: null, when: null, orderingYear: null },
        ],
      };
      return route.fulfill({ json: body });
    });
    await page.goto("/archive");
    await page.getByText(copy("Timeline"), { exact: true }).click();
    await page.getByRole("button", { name: copy("Open timeline"), exact: true }).click();
    const panel = page.locator("details", { hasText: copy("Open timeline") }).or(page.locator("details", { hasText: copy("Recheck timeline") }));
    await expect(panel.getByRole("alert")).toHaveText(copy("The timeline could not be opened. Please try again."));
    await panel.getByRole("button", { name: copy("Open timeline"), exact: true }).click();

    // Years appear in ascending order, taken from the storyteller's own words.
    await expect(panel.getByRole("heading", { level: 3 })).toHaveText([
      "1950",
      "1951",
      copy("Remembered without a year"),
      copy("Date not known"),
    ]);
    await expect(panel.getByText(copy("The storyteller said, approximately: {when}", { when: "verano de 1950, creo" }), { exact: true })).toBeVisible();
    await expect(panel.getByText(copy("The storyteller said: {when}", { when: "junio de 1951" }), { exact: true })).toBeVisible();
    // A memory without a year is kept under the storyteller's words, not placed on a date.
    const undated = panel.getByRole("region", { name: copy("Remembered without a year"), exact: true });
    await expect(undated.getByText(copy("The storyteller said: {when}", { when: "una Navidad" }), { exact: true })).toBeVisible();
    const unknown = panel.getByRole("region", { name: copy("Date not known"), exact: true });
    await expect(unknown.getByText(copy("No date is needed. These memories are complete as they are."), { exact: true })).toBeVisible();
    await expect(unknown.getByRole("link")).toHaveAttribute("href", "/memory/memory_timeline_d");
  });
