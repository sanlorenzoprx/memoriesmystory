import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence with a stubbed server: an archive too large for the
// device is offered as a server-prepared export, shows honest progress, and
// then offers each part to save.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: a too-large archive is prepared on the server and saved in parts`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
    let job: unknown = null,
      polls = 0;
    const posts: unknown[] = [];
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({ json: { drafts: [{ id: "memory_big", status: "complete", ui_locale: "en-US", created_at: "2026-11-14T00:00:00Z", updated_at: "2026-11-14T00:00:00Z" }] } }),
    );
    await page.route("**/resources/family-archives**", (route) => route.fulfill({ json: { archives: [], nextCursor: null } }));
    await page.route("**/resources/archive-export/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.endsWith("/manifest"))
        return route.fulfill({ json: {
          format: "memoriesmystory-archive-export", formatVersion: 1, generatedAt: "2026-11-16T12:00:00.000Z", complete: true, notIncluded: [], chapters: [], people: [],
          memories: [{ id: "memory_big", title: "A long recording", completedAt: null, transcripts: [], storytellerContext: [], museConversation: [], voiceReplies: [], familyContributions: [],
            files: [{ path: "memories/memory_big/original_voice/v.webm", kind: "asset", id: "asset_big", role: "original_voice", original: true, derivedFromId: null, contentType: "audio/webm", byteSize: 2_000_000_000, sha256: "a".repeat(64), durationMs: null, attribution: null, createdAt: "2026-11-15T00:00:00Z" }] }],
        } });
      if (path.endsWith("/jobs") && request.method() === "POST") {
        expect(request.headers()["x-memories-request"]).toBe("export-v1");
        posts.push(request.postDataJSON());
        job = { id: "export_abc12345", state: "building", checked: 0, files: 2, expiresAt: "2026-11-23T12:00:00.000Z", parts: [] };
        return route.fulfill({ status: 202, json: { id: "export_abc12345" } });
      }
      if (path.endsWith("/jobs/latest")) {
        if (job && (job as { state: string }).state === "building" && ++polls > 1)
          job = { id: "export_abc12345", state: "ready", checked: 2, files: 2, expiresAt: "2026-11-23T12:00:00.000Z",
            parts: [{ part: 1, files: 1, unverified: 0, name: "family-archive-export-2026-11-16-part-1-of-2.zip" }, { part: 2, files: 1, unverified: 0, name: "family-archive-export-2026-11-16-part-2-of-2.zip" }] };
        return route.fulfill({ json: { job } });
      }
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto("/archive");
    await page.getByText(copy("Export my archive"), { exact: true }).click();
    await page.getByRole("button", { name: copy("Prepare my archive export"), exact: true }).click();
    await page.getByRole("button", { name: copy("Prepare it on our server"), exact: true }).click();
    expect(posts).toEqual([{ locale }]);
    await expect(page.getByText(copy("Checked {done} of {total} files", { done: 0, total: 2 }), { exact: true })).toBeVisible();
    await expect(page.getByText(copy("Your export is ready in {count} parts.", { count: 2 }), { exact: true })).toBeVisible({ timeout: 15_000 });
    for (const part of [1, 2])
      await expect(page.getByRole("link", { name: copy("Save part {part} of {parts}", { part, parts: 2 }), exact: true })).toHaveAttribute(
        "href",
        `/resources/archive-export/jobs/export_abc12345/parts/${part}`,
      );
  });
