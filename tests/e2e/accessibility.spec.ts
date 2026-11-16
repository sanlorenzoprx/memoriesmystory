import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Automated WCAG 2.2 A/AA checks (lane L7) on the main screens, in English and
// Spanish, with stubbed data. Automated rules catch only part of WCAG; the
// screen-reader journeys in docs/EXECUTION/ACCEPTANCE_KIT_V1.md cover the rest.
const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";
const memory = "draft_axe_memory_001";

async function stub(page: Page) {
  await page.route("**/resources/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/archive/drafts"))
      return route.fulfill({ json: { drafts: [{ id: memory, status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] } });
    if (path.endsWith("/living-memory"))
      return route.fulfill({ json: {
        livingMemoryId: memory, status: "complete", completedAt: "2026-11-13T12:00:00Z",
        originals: { photo: { assetId: "photo_axe", mediaUrl: photo }, audio: { assetId: "audio_axe", mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF" } },
        transcript: null, musePrompt: null, context: [],
      } });
    if (path.includes("/family-access") && path.endsWith("/memberships"))
      return route.fulfill({ json: { memberships: [{ id: "grant_axe", role: "viewer", scopeKind: "memory", label: "Our family photograph" }], nextCursor: null } });
    if (path.endsWith("/family-archives") || path.includes("/family-archives"))
      return route.fulfill({ json: { archives: [], nextCursor: null } });
    if (path.endsWith("/share-agreement")) return route.fulfill({ json: { familyAndFriends: false, public: false, version: "share-agreement-2026-11-16" } });
    if (path.endsWith("/muse/memory"))
      return route.fulfill({ json: {
        leftOff: { draftId: "draft_axe_unfinished", updatedAt: "2026-11-15T00:00:00Z", unfinished: 2 },
        remembered: [
          { id: "ctx_axe_person", memoryId: memory, memoryTitle: "Navidad en Ponce", kind: "person", value: "Tío Luis", approximate: false, forgotten: false },
          { id: "ctx_axe_place", memoryId: memory, memoryTitle: null, kind: "place", value: "Ponce", approximate: true, forgotten: true },
        ],
      } });
    if (path.endsWith("/growth/events")) return route.fulfill({ status: 202, json: { recorded: true } });
    return route.fulfill({ json: {} });
  });
}

const pages: { name: string; path: string; open?: (page: Page) => Promise<void> }[] = [
  { name: "first screen", path: "/" },
  { name: "archive", path: "/archive" },
  { name: "family", path: "/family" },
  { name: "finished memory", path: `/memory/${memory}` },
  {
    name: "sharing agreement",
    path: `/memory/${memory}`,
    open: async (page) => {
      await page.locator("button.primary-action").first().click();
      await page.locator("#share-agreement-title").waitFor();
    },
  },
  {
    name: "archive panels open",
    path: "/archive",
    open: async (page) => {
      for (const summary of await page.locator("details > summary").all()) await summary.click();
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "capture",
    path: "/?start=import",
    open: async (page) => {
      await page.waitForURL(/\/capture\//);
      await page.waitForLoadState("networkidle");
    },
  },
];

for (const locale of ["en-US", "es-PR"] as const)
  for (const target of pages)
    test(`${locale}: ${target.name} has no automated WCAG 2.2 A/AA violations`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
      await stub(page);
      await page.goto(target.path);
      await page.waitForLoadState("networkidle");
      await target.open?.(page);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target.join(" "), help: v.help }));
      expect(summary).toEqual([]);
    });
