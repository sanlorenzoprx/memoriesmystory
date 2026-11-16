import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with stubbed routes; linking and isolation are proven
// against the Worker in tests/integration/family-people.test.ts.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: opening a named person shows the memories a human linked to them`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
    const photo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";
    const person = (id: string, memoryIds: string[]) => ({
      id, archiveId: "family_person_album_ui", kind: "person", active: true, version: 1, authorId: "owner",
      document: { label: "María", notes: "", dateText: "", datePrecision: "unknown", memoryIds },
    });
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({ json: { drafts: [{ id: "memory_person_album_a", status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] } }),
    );
    await page.route("**/resources/family-archives**", (route) =>
      route.fulfill({
        json: {
          archives: [{ id: "family_person_album_ui", title: "Our family", description: "", version: 1 }],
          archiveId: "family_person_album_ui", chapters: [], memories: [], nextMemoryCursor: null, nextChapterCursor: null,
        },
      }),
    );
    await page.route("**/resources/family-access/**", (route) => route.fulfill({ json: { grants: [], nextCursor: null } }));
    await page.route("**/resources/family-people**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/person/person_album_one/memories"))
        return route.fulfill({
          json: {
            person: { id: "person_album_one", label: "María", active: true },
            memories: [
              { id: "memory_person_album_a", title: "La boda", photoUrl: photo },
              { id: "memory_person_album_b", title: null, photoUrl: null },
            ],
          },
        });
      if (path.endsWith("/person/person_album_two/memories"))
        return route.fulfill({ json: { person: { id: "person_album_two", label: "María", active: true }, memories: [] } });
      return route.fulfill({ json: { records: [person("person_album_one", ["memory_person_album_a", "memory_person_album_b"]), person("person_album_two", [])], nextCursor: null } });
    });
    await page.goto("/archive");
    await page.getByText(copy("People and relationships"), { exact: true }).click();
    await page.getByRole("button", { name: copy("Open people"), exact: true }).click();
    const open = page.getByRole("button", { name: copy("Open this person's album"), exact: true });
    await expect(open).toHaveCount(2);
    await open.first().click();
    const album = page.getByRole("region", { name: copy("Album of {name}", { name: "María" }), exact: true });
    await expect(album.getByText(copy("These are the memories you linked to this person. Nothing is added by recognizing faces or voices."), { exact: true })).toBeVisible();
    await expect(album.getByRole("link", { name: /La boda/ })).toHaveAttribute("href", "/memory/memory_person_album_a");
    await expect(album.getByRole("link", { name: copy("Living Memory {number}", { number: 2 }) })).toHaveAttribute("href", "/memory/memory_person_album_b");
    // A second person with the same name is a separate album, here with nothing linked.
    await open.nth(1).click();
    await expect(page.getByText(copy("No memories are linked to this person yet."), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy("Close this album"), exact: true }).click();
    await expect(page.getByText(copy("No memories are linked to this person yet."), { exact: true })).toHaveCount(0);
  });
