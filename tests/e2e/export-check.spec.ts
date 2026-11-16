import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { buildStoredZip } from "../../app/domain/archive-export";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence: the export is built here with the app's own ZIP writer
// and checked entirely in the browser; nothing is sent to the server.
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function exportZip(tamper: boolean) {
  const photo = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
    path = "memories/m/original_photograph/p.png";
  const manifest = {
    format: "memoriesmystory-archive-export", formatVersion: 1, generatedAt: "2026-11-16T00:00:00.000Z",
    complete: true, notIncluded: [], chapters: [], people: [],
    memories: [{ id: "m", files: [{ path, sha256: sha(photo), byteSize: photo.length }] }],
  };
  return Buffer.concat(
    buildStoredZip([
      { path: "manifest.json", bytes: Buffer.from(JSON.stringify(manifest)) },
      { path, bytes: tamper ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 4]) : photo },
    ]),
  );
}

for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: an owner checks a saved export on the device and sees a changed file named`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values);
    const uploads: string[] = [];
    await page.addInitScript((value) => localStorage.setItem("memoriesmystory:ui-locale", value), locale);
    await page.route("**/resources/archive/drafts", (route) => route.fulfill({ json: { drafts: [] } }));
    page.on("request", (request) => {
      if (request.method() !== "GET") uploads.push(request.url());
    });
    await page.goto("/archive");
    await page.getByText(copy("Check an export"), { exact: true }).click();
    const input = page.getByLabel(copy("Export file (.zip)"), { exact: true });

    await input.setInputFiles({ name: "family-archive-export.zip", mimeType: "application/zip", buffer: exportZip(false) });
    await expect(page.getByText(copy("Every file in this export matches its list."), { exact: true })).toBeVisible();
    await expect(page.getByText(copy("Files that match: {matched} of {listed}", { matched: 1, listed: 1 }), { exact: true })).toBeVisible();

    await input.setInputFiles({ name: "changed.zip", mimeType: "application/zip", buffer: exportZip(true) });
    await expect(page.getByText(copy("Some files in this export do not match its list."), { exact: true })).toBeVisible();
    await expect(page.getByText(copy("Changed since the export was made: {count}", { count: 1 }), { exact: true })).toBeVisible();
    await expect(page.getByText("memories/m/original_photograph/p.png", { exact: true })).toBeVisible();

    await input.setInputFiles({ name: "notes.zip", mimeType: "application/zip", buffer: Buffer.from("not a zip file, only words here") });
    await expect(page.getByRole("alert")).toHaveText(copy("This file is not a ZIP export."));
    // The check never sends the export anywhere.
    expect(uploads).toEqual([]);
  });
