import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { FamilyContribution } from "../../app/domain/family-contribution";

const fixture = new URL("../fixtures/synthetic-family-photo.png", import.meta.url);
const fixtureSha = createHash("sha256").update(readFileSync(fixture)).digest("hex");

// Synthetic UI evidence with stubbed contribution routes and a synthetic image.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: a relative's added photograph is sent untouched and saved only after confirmation`, async ({
    page,
  }) => {
    const copy = (key: string, values?: Record<string, string | number>) =>
        translate(key, locale, values),
      memory = "memory_photo_contribution_browser",
      grant = "grant_photo_contribution_browser",
      photo =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";
    const records: FamilyContribution[] = [],
      sends: { key: string; sha: string; bodySha: string; type: string }[] = [];
    let fail = true;
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/family-access**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/memberships")
          ? {
              memberships: [
                { id: grant, role: "contributor", scopeKind: "memory", label: "Our family photograph" },
              ],
              nextCursor: null,
            }
          : {
              membership: { id: grant, role: "contributor", scopeKind: "memory" },
              memories: [
                { id: memory, title: "Our family photograph", photoUrl: photo, audioUrl: null },
              ],
              nextCursor: null,
            },
      }),
    );
    await page.route("**/resources/family-contributions/**", async (route) => {
      const request = route.request(),
        parts = new URL(request.url()).pathname.split("/"),
        id = parts[4],
        action = parts[5];
      if (request.method() === "GET") {
        if (action === "photo")
          return route.fulfill({ status: 200, contentType: "image/png", body: readFileSync(fixture) });
        if (id)
          return route.fulfill({ json: { contribution: records.find((c) => c.id === id) } });
        return route.fulfill({
          json: { canContribute: true, draftScope: "4".repeat(64), nextCursor: null, contributions: records },
        });
      }
      expect(id).toBe("photo");
      const headers = request.headers(),
        body = request.postDataBuffer()!;
      expect(headers["x-contribution-agree"]).toBe("true");
      expect(headers["x-audio-duration-ms"]).toBeUndefined();
      sends.push({
        key: headers["x-idempotency-key"],
        sha: headers["x-content-sha256"],
        bodySha: createHash("sha256").update(body).digest("hex"),
        type: headers["content-type"],
      });
      if (fail) {
        fail = false;
        return route.fulfill({ status: 503, json: { error: { code: "family_contribution_photo_unconfirmed" } } });
      }
      records.push({
        id: "contribution_photo_browser",
        memoryId: memory,
        version: 1,
        authorState: "submitted",
        own: true,
        canAssemble: false,
        canInclude: false,
        familyVisible: false,
        latestRevisionId: "contribution_photo_source_browser",
        includedRevisionId: null,
        revision: {
          id: "contribution_photo_source_browser",
          attribution: decodeURIComponent(headers["x-contribution-attribution"]),
          text: "",
          sourceKind: "human_photo",
          createdAt: "2026-11-15T00:00:01Z",
        },
        voice: null,
        photo: { contentType: "image/png" },
      });
      return route.fulfill({ status: 201, json: { id: "contribution_photo_browser", version: 1 } });
    });

    await page.goto("/family");
    await page.getByRole("button", { name: "Our family photograph", exact: true }).click();
    await page.getByText(copy("Family recollections"), { exact: true }).click();
    await page.getByRole("button", { name: copy("Open recollections"), exact: true }).click();

    await page.getByLabel(copy("Choose a photograph to add"), { exact: true }).setInputFiles(fixture.pathname);
    await expect(page.getByAltText(copy("Photograph you chose to add"), { exact: true })).toBeVisible();
    const submit = page.getByRole("button", { name: copy("Submit my photograph for review"), exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel(copy("How would you like to be named?"), { exact: true }).fill("Tío Rafael");
    await page
      .getByLabel(copy("I want the owner to review these words and choose whether this version is included for invited family."), { exact: true })
      .check();
    await submit.click();

    await expect(page.getByRole("alert")).toHaveText(
      copy("Your photograph could not be confirmed as saved. It is still here; please try again."),
    );
    const savedCopy = copy("Your photograph is saved for review. It has not automatically been shared with family.");
    await expect(page.getByText(savedCopy, { exact: true })).toHaveCount(0);
    await expect(page.getByAltText(copy("Photograph you chose to add"), { exact: true })).toBeVisible();

    await submit.click();
    await expect(page.getByText(savedCopy, { exact: true })).toBeVisible();
    expect(sends).toHaveLength(2);
    expect(sends[1].key).toBe(sends[0].key);
    // The exact chosen file is sent: no resize, re-encode or correction.
    for (const send of sends) {
      expect(send.sha).toBe(fixtureSha);
      expect(send.bodySha).toBe(fixtureSha);
      expect(send.type).toBe("image/png");
    }
    await expect(page.getByAltText(copy("Photograph added by {name}", { name: "Tío Rafael" }), { exact: true })).toBeVisible();
    await expect(page.getByText(copy("Waiting for owner review"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: copy("Revise my recollection"), exact: true })).toHaveCount(0);
    await expect(page.getByAltText(copy("Photograph you chose to add"), { exact: true })).toHaveCount(0);
  });
