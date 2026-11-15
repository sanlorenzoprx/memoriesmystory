import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with stubbed routes: an album holds Chapters, and
// starter ideas only suggest a name — nothing is created until the person saves.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: album ideas suggest a name and create nothing until the person chooses`, async ({
    page,
  }) => {
    const copy = (key: string) => translate(key, locale);
    const archives = [{ id: "family_album_browser", title: copy("My family album"), description: "", version: 1 }],
      created: string[] = [];
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({ json: { drafts: [{ id: "memory_album_browser", status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] } }),
    );
    await page.route("**/resources/family-archives**", (route) => {
      const request = route.request();
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/archives")) {
        const title = request.postDataJSON().title as string;
        created.push(title);
        archives.push({ id: `family_album_browser_${created.length}`, title, description: "", version: 1 });
        return route.fulfill({ status: 201, json: { id: archives.at(-1)!.id, version: 1 } });
      }
      return route.fulfill({
        json: { archives, archiveId: archives[0]!.id, chapters: [], memories: [], nextMemoryCursor: null, nextChapterCursor: null },
      });
    });
    await page.goto("/archive");
    await expect(page.getByLabel(copy("Album"), { exact: true })).toBeVisible();
    await page.getByText(copy("Album settings"), { exact: true }).click();
    await expect(
      page.getByText(copy("An album holds Chapters. For example, an album “Family vacation” with a Chapter “Places we visited”."), { exact: true }),
    ).toBeVisible();
    const name = page.getByLabel(copy("New album name"), { exact: true }),
      create = page.getByRole("button", { name: copy("Create an album"), exact: true });
    await expect(create).toBeDisabled();
    await page.getByRole("button", { name: copy("Vacations"), exact: true }).click();
    await expect(name).toHaveValue(copy("Vacations"));
    // Choosing an idea only fills the name.
    expect(created).toEqual([]);
    await name.fill(`${copy("Vacations")} 1998`);
    await create.click();
    await expect.poll(() => created).toEqual([`${copy("Vacations")} 1998`]);
  });
