import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with stubbed routes. Authorization is proven against the
// Worker in tests/integration/family-album-permission.test.ts.
for (const locale of ["en-US", "es-PR"] as const) {
  const copy = (key: string) => translate(key, locale);
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";

  test(`${locale}: a relative makes an album only when the owner allowed it, without owner-only controls`, async ({ page }) => {
    const memory = "memory_album_permission_ui",
      grant = "grant_album_permission_ui";
    let allowed = false;
    const albums: { id: string; title: string; description: string; version: number }[] = [],
      grantIds: (string | null)[] = [];
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/family-access**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/memberships")
          ? { memberships: [{ id: grant, role: "viewer", scopeKind: "memory", label: "Our family photograph", canOrganizeAlbums: allowed }], nextCursor: null }
          : {
              membership: { id: grant, role: "viewer", scopeKind: "memory", canOrganizeAlbums: allowed },
              memories: [{ id: memory, title: "Our family photograph", photoUrl: photo, audioUrl: null }],
              nextCursor: null,
            },
      }),
    );
    await page.route("**/resources/family-contributions/**", (route) =>
      route.fulfill({ json: { canContribute: false, draftScope: "7".repeat(64), nextCursor: null, contributions: [] } }),
    );
    await page.route("**/resources/family-archives**", (route) => {
      const request = route.request(),
        url = new URL(request.url());
      grantIds.push(url.searchParams.get("grantId"));
      if (request.method() === "POST" && url.pathname.endsWith("/archives")) {
        albums.push({ id: `family_album_relative_${albums.length}`, title: request.postDataJSON().title, description: "", version: 1 });
        return route.fulfill({ status: 201, json: { id: albums.at(-1)!.id, version: 1 } });
      }
      if (request.method() === "POST" && url.pathname.endsWith("/chapters"))
        return route.fulfill({ status: 201, json: { id: "family_chapter_relative_ui", version: 1 } });
      return route.fulfill({
        json: {
          archives: albums,
          archiveId: albums[0]?.id ?? null,
          chapters: [],
          memories: [{ id: memory, title: "Our family photograph", titleVersion: 1, photoUrl: photo, voiceAvailable: false }],
          nextMemoryCursor: null,
          nextChapterCursor: null,
        },
      });
    });

    await page.goto("/family");
    await page.getByRole("button", { name: "Our family photograph", exact: true }).click();
    // Without the owner's permission there is no album section at all.
    await expect(page.getByRole("heading", { name: copy("Albums you can make"), exact: true })).toHaveCount(0);
    expect(grantIds).toEqual([]);

    allowed = true;
    await page.reload();
    await page.getByRole("button", { name: "Our family photograph", exact: true }).click();
    const section = page.getByRole("region", { name: copy("Albums you can make"), exact: true });
    await expect(section).toBeVisible();
    await expect(section.getByText(copy("The archive owner lets you make albums from the memories shared with you. Your albums stay in their family archive, and they can change or remove them."), { exact: true })).toBeVisible();
    // Owner-only controls are not offered to a relative.
    await expect(section.getByText(copy("Invite family"), { exact: true })).toHaveCount(0);
    await section.getByLabel(copy("Chapter name"), { exact: true }).fill("Places we visited");
    await section.getByRole("button", { name: copy("Create a private Chapter"), exact: true }).click();
    await expect.poll(() => albums.length).toBe(1);
    // Every album request from a relative is bound to their invitation.
    expect(grantIds.length).toBeGreaterThan(0);
    expect(grantIds.every((value) => value === grant)).toBe(true);
  });

  test(`${locale}: the owner turns album making on and off for one accepted person`, async ({ page }) => {
    let canOrganize = false;
    const sent: boolean[] = [];
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({ json: { drafts: [{ id: "memory_album_owner_ui", status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] } }),
    );
    await page.route("**/resources/family-archives**", (route) =>
      route.fulfill({
        json: {
          archives: [{ id: "family_album_owner_ui", title: copy("My family album"), description: "", version: 1 }],
          archiveId: "family_album_owner_ui",
          chapters: [],
          memories: [],
          nextMemoryCursor: null,
          nextChapterCursor: null,
        },
      }),
    );
    await page.route("**/resources/family-people**", (route) => route.fulfill({ json: { records: [], nextCursor: null } }));
    await page.route("**/resources/family-access/**", (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        expect(new URL(request.url()).pathname).toBe("/resources/family-access/grants/grant_album_owner_ui/album-permission");
        canOrganize = request.postDataJSON().allow;
        sent.push(canOrganize);
        return route.fulfill({ json: { id: "grant_album_owner_ui", version: 2, canOrganizeAlbums: canOrganize } });
      }
      return route.fulfill({
        json: {
          grants: [{ id: "grant_album_owner_ui", archiveId: "family_album_owner_ui", role: "viewer", scopeKind: "archive", scopeId: "family_album_owner_ui", targetEmail: "relative@example.test", state: "accepted", version: 2, expiresAt: "2099-01-01T00:00:00Z", canOrganizeAlbums: canOrganize }],
          nextCursor: null,
        },
      });
    });
    await page.goto("/archive");
    await page.getByText(copy("Invite family"), { exact: true }).click();
    await page.getByRole("button", { name: copy("Review family access"), exact: true }).click();
    await expect(page.getByText(copy("This person can look, but cannot make albums."), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy("Let this person make albums"), exact: true }).click();
    await expect(page.getByText(copy("This person can make their own albums from the memories you shared with them."), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy("Stop letting this person make albums"), exact: true }).click();
    await expect(page.getByText(copy("This person can look, but cannot make albums."), { exact: true })).toBeVisible();
    expect(sent).toEqual([true, false]);
  });
}
