import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { FamilySearchResponse } from "../../app/domain/family-search";

// Synthetic UI evidence with stubbed routes. Authorization and matching are
// proven against the Worker in tests/integration/family-search.test.ts.
for (const locale of ["en-US", "es-PR"] as const) {
  const copy = (key: string, values?: Record<string, string | number>) =>
    translate(key, locale, values);
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";

  test(`${locale}: the owner finds a memory by remembered words, with each source named and a failed search recoverable`, async ({
    page,
  }) => {
    const memory = "memory_search_owner_browser",
      asked: string[] = [];
    let fail = true;
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({
        json: { drafts: [{ id: memory, status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] },
      }),
    );
    await page.route("**/resources/family-archives**", (route) =>
      route.fulfill({ json: { archives: [], nextCursor: null } }),
    );
    await page.route("**/resources/family-search**", (route) => {
      const url = new URL(route.request().url()),
        q = url.searchParams.get("q")!;
      expect(url.searchParams.has("grantId")).toBe(false);
      asked.push(q);
      if (fail) {
        fail = false;
        return route.fulfill({ status: 503, json: { error: { code: "family_search_unavailable" } } });
      }
      const body: FamilySearchResponse =
        q === "nada"
          ? { query: q, results: [], truncated: false }
          : {
              query: q,
              truncated: true,
              results: [
                {
                  memoryId: memory,
                  title: "La cocina de la tía María",
                  matches: [
                    { kind: "context_place", text: "San Germán", attribution: null, approximate: true },
                    { kind: "recollection", text: "…Yo recuerdo el olor a sofrito en esa cocina…", attribution: "Prima Lucía", approximate: false },
                  ],
                },
              ],
            };
      return route.fulfill({ json: body });
    });
    await page.goto("/archive");
    const field = page.getByLabel(copy("Search by a name, place, date or words someone used"), { exact: true }),
      button = page.getByRole("button", { name: copy("Search"), exact: true });
    await expect(button).toBeDisabled();
    await field.fill("  tia   maria ");
    await button.click();
    await expect(page.getByRole("region", { name: copy("Find a memory"), exact: true }).getByRole("alert")).toHaveText(copy("The search could not be completed. Please try again."));
    await expect(field).toHaveValue("  tia   maria ");
    await button.click();
    expect(asked).toEqual(["tia maria", "tia maria"]);
    await expect(page.getByText(copy("Memories matching “{query}”: {count}", { query: "tia maria", count: 1 }), { exact: true })).toBeVisible();
    await expect(page.getByText(copy("More matched than can be shown. Add another word to narrow the search."), { exact: true })).toBeVisible();
    // Each match names its source; a recollection is attributed, not stated as fact.
    await expect(page.getByText(`${copy("Where the storyteller said it was")} · ${copy("approximately")}`, { exact: true })).toBeVisible();
    await expect(page.getByText(copy("{name} remembered", { name: "Prima Lucía" }), { exact: true })).toBeVisible();
    await expect(page.getByText("…Yo recuerdo el olor a sofrito en esa cocina…", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "La cocina de la tía María", exact: true })).toHaveAttribute("href", `/memory/${memory}`);

    await field.fill("nada");
    await button.click();
    await expect(page.getByText(copy("No memories matched “{query}”.", { query: "nada" }), { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "La cocina de la tía María", exact: true })).toHaveCount(0);
  });

  test(`${locale}: invited family searches only inside their invitation`, async ({ page }) => {
    const memory = "memory_search_member_browser",
      grant = "grant_search_member_browser",
      grants: (string | null)[] = [];
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/family-access**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/memberships")
          ? { memberships: [{ id: grant, role: "viewer", scopeKind: "memory", label: "Our family photograph" }], nextCursor: null }
          : {
              membership: { id: grant, role: "viewer", scopeKind: "memory" },
              memories: [{ id: memory, title: "Our family photograph", photoUrl: photo, audioUrl: null }],
              nextCursor: null,
            },
      }),
    );
    await page.route("**/resources/family-search**", (route) => {
      const url = new URL(route.request().url());
      grants.push(url.searchParams.get("grantId"));
      const body: FamilySearchResponse = {
        query: url.searchParams.get("q")!,
        truncated: false,
        results: [
          {
            memoryId: memory,
            title: "Our family photograph",
            matches: [{ kind: "written_words", text: "Dije que fue en mayo.", attribution: "Tía María", approximate: false }],
          },
        ],
      };
      return route.fulfill({ json: body });
    });
    await page.goto("/family");
    await page.getByRole("button", { name: "Our family photograph", exact: true }).click();
    await page.getByLabel(copy("Search by a name, place, date or words someone used"), { exact: true }).fill("mayo");
    await page.getByRole("button", { name: copy("Search"), exact: true }).click();
    await expect(page.getByText(copy("{name} wrote, for their recording", { name: "Tía María" }), { exact: true })).toBeVisible();
    await expect(page.getByText("Dije que fue en mayo.", { exact: true })).toBeVisible();
    // Every member search is bound to the invitation; results are not links into a private archive.
    expect(grants).toEqual([grant]);
    await expect(page.getByRole("link", { name: "Our family photograph", exact: true })).toHaveCount(0);
  });
}
