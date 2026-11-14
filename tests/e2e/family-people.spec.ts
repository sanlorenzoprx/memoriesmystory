import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type {
  PeopleRecord,
  PersonReference,
} from "../../app/domain/family-people";
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: people keep human uncertainty, separate identities and retry edits`, async ({
    page,
  }) => {
    const copy = (key: string) => translate(key, locale),
      records: PeopleRecord[] = [],
      keys: string[] = [];
    let fail = true;
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({
        json: {
          drafts: [
            {
              id: "memory_people_browser",
              status: "complete",
              ui_locale: "en-US",
              created_at: "2026-11-14T00:00:00Z",
              updated_at: "2026-11-14T00:00:00Z",
            },
          ],
        },
      }),
    );
    await page.route("**/resources/family-archives**", (route) =>
      route.fulfill({
        json: {
          archives: [
            {
              id: "family_people_browser",
              title: "Our family",
              description: "",
              version: 1,
            },
          ],
          archiveId: "family_people_browser",
          chapters: [],
          memories: [
            {
              id: "memory_people_browser",
              title: "Our photograph",
              titleVersion: 1,
              photoUrl: null,
              voiceAvailable: false,
            },
          ],
          nextMemoryCursor: null,
          nextChapterCursor: null,
        },
      }),
    );
    await page.route("**/resources/family-people**", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        id = url.pathname.split("/")[4];
      if (request.method() === "GET")
        return route.fulfill({
          json: id
            ? { record: records.find((p) => p.id === id), history: [] }
            : { records, nextCursor: null },
        });
      const body = request.postDataJSON();
      keys.push(request.headers()["x-idempotency-key"]);
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 503,
          json: { error: { code: "family_archive_unavailable" } },
        });
      }
      if (request.method() === "POST") {
        const record: PeopleRecord = {
          id: `person_browser_${records.length + 1}`,
          archiveId: "family_people_browser",
          kind: "person",
          document: body.document,
          active: true,
          version: 1,
          authorId: "synthetic_owner",
        };
        records.push(record);
        return route.fulfill({
          status: 201,
          json: { id: record.id, version: 1 },
        });
      }
      return route.fulfill({
        status: 500,
        json: { error: { code: "unexpected_test_mutation" } },
      });
    });
    await page.goto("/archive");
    await page
      .getByText(copy("People and relationships"), { exact: true })
      .click();
    await page
      .getByRole("button", { name: copy("Open people"), exact: true })
      .click();
    await page
      .getByLabel(copy("Name or description (optional)"), { exact: true })
      .fill("María");
    await page
      .getByLabel(copy("Your notes (optional)"), { exact: true })
      .fill("Creo que era mi tía, no estoy segura.");
    await page
      .getByLabel(copy("How do you remember the date?"), { exact: true })
      .selectOption("approximate");
    await page
      .getByLabel(copy("Date in your own words"), { exact: true })
      .fill("alrededor de 1940");
    await page.getByLabel("Our photograph", { exact: true }).check();
    await page
      .getByRole("button", { name: copy("Save person reference"), exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByText(copy("Your people references are saved."), {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel(copy("Your notes (optional)"), { exact: true }),
    ).toHaveValue("Creo que era mi tía, no estoy segura.");
    await page
      .getByRole("button", { name: copy("Save person reference"), exact: true })
      .click();
    await expect(
      page.getByText(copy("Your people references are saved."), {
        exact: true,
      }),
    ).toBeVisible();
    expect(keys[0]).toBe(keys[1]);
    expect(records[0].document).toMatchObject({
      label: "María",
      datePrecision: "approximate",
      dateText: "alrededor de 1940",
      memoryIds: ["memory_people_browser"],
    });
    await page
      .getByRole("button", { name: copy("Add another person"), exact: true })
      .click();
    await page
      .getByLabel(copy("Name or description (optional)"), { exact: true })
      .fill("María");
    await page
      .getByRole("button", { name: copy("Save person reference"), exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: copy("Edit person"), exact: true }),
    ).toHaveCount(2);
    expect(records[0].id).not.toBe(records[1].id);
    expect((records[1].document as PersonReference).dateText).toBe("");
    expect((records[1].document as PersonReference).datePrecision).toBe(
      "unknown",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
