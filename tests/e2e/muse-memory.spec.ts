import { test, expect, type Page } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with a stubbed server (Talk with Muse M2): the archive
// shows where the person left off and everything Muse remembers, and asking
// Muse to forget is confirmed by the server before the page shows it.
async function stub(page: Page) {
  const forgetRequests: { contextEntryId: string; forgotten: boolean }[] = [];
  let forgotten = false;
  const remembered = () => [
    { id: "ctx_luis", memoryId: "memory_navidad", memoryTitle: "Navidad en Ponce", kind: "person", value: "Tío Luis", approximate: false, forgotten },
    { id: "ctx_ponce", memoryId: "memory_navidad", memoryTitle: "Navidad en Ponce", kind: "place", value: "Ponce, 1975", approximate: true, forgotten: false },
  ];
  await page.addInitScript(() => localStorage.setItem("memoriesmystory:welcome-splash", "off"));
  await page.route("**/resources/archive/drafts**", (route) =>
    route.fulfill({
      json: {
        drafts: [
          { id: "memory_navidad", status: "complete", ui_locale: "en-US", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
          { id: "draft_unfinished", status: "photo_durable", ui_locale: "en-US", created_at: "2026-11-15T00:00:00Z", updated_at: "2026-11-15T00:00:00Z" },
        ],
      },
    }),
  );
  await page.route("**/resources/muse/memory", (route) =>
    route.fulfill({ json: { leftOff: { draftId: "draft_unfinished", updatedAt: "2026-11-15T00:00:00Z", unfinished: 1 }, remembered: remembered() } }),
  );
  await page.route("**/resources/muse/memory/forget", async (route) => {
    const body = route.request().postDataJSON() as { contextEntryId: string; forgotten: boolean };
    forgetRequests.push(body);
    expect(route.request().headers()["x-memories-request"]).toBe("muse-memory-v1");
    forgotten = body.forgotten;
    await route.fulfill({ json: { remembered: remembered() } });
  });
  return forgetRequests;
}

for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: the archive shows where the person left off and what Muse remembers, and Muse forgets on request`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    const requests = await stub(page);
    await page.goto("/archive");

    const resume = page.getByRole("link", { name: copy("Pick up where you left off"), exact: true });
    await expect(resume).toHaveAttribute("href", "/memory/draft_unfinished");
    await expect(page.getByText(copy("You have 1 memory you haven't finished."), { exact: true })).toBeVisible();

    await page.getByText(copy("What Muse remembers"), { exact: true }).click();
    await expect(page.getByRole("heading", { name: copy("People"), exact: true })).toBeVisible();
    await expect(page.getByText(copy("About: {value}", { value: "Ponce, 1975" }), { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: copy("from {title}", { title: "Navidad en Ponce" }), exact: true }).first()).toHaveAttribute("href", "/memory/memory_navidad");

    await page.getByRole("button", { name: copy("Ask Muse to forget {value}", { value: "Tío Luis" }), exact: true }).click();
    await expect(page.getByText(copy("Muse won't bring this up."), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy("Let Muse remember {value}", { value: "Tío Luis" }), exact: true }).click();
    await expect(page.getByText(copy("Muse won't bring this up."), { exact: true })).toHaveCount(0);
    expect(requests).toEqual([
      { contextEntryId: "ctx_luis", forgotten: true },
      { contextEntryId: "ctx_luis", forgotten: false },
    ]);
  });
