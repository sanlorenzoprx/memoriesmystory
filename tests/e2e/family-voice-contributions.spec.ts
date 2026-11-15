import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { FamilyContribution } from "../../app/domain/family-contribution";

// Synthetic UI evidence: the microphone is an oscillator and the server is stubbed.
// It proves the recorder, retry and truthful-save behaviour, not real storage.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: a relative's recorded voice survives a failed send and is saved only after confirmation`, async ({
    page,
  }) => {
    const copy = (key: string, values?: Record<string, string | number>) =>
        translate(key, locale, values),
      memory = "memory_voice_contribution_browser",
      grant = "grant_voice_contribution_browser",
      photo =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";
    const records: FamilyContribution[] = [],
      sends: { key: string; sha: string; bodySha: string; name: string }[] = [];
    let fail = true;

    await page.addInitScript((value) => {
      localStorage.setItem("memoriesmystory:ui-locale", value);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const context = new AudioContext();
            await context.resume();
            const oscillator = context.createOscillator(),
              destination = context.createMediaStreamDestination();
            oscillator.connect(destination);
            oscillator.start();
            return destination.stream;
          },
        },
      });
    }, locale);
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
        if (action === "voice")
          return route.fulfill({ status: 200, contentType: "audio/webm", body: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]) });
        if (id)
          return route.fulfill({ json: { contribution: records.find((c) => c.id === id) } });
        return route.fulfill({
          json: { canContribute: true, draftScope: "3".repeat(64), nextCursor: null, contributions: records },
        });
      }
      expect(id).toBe("voice");
      const headers = request.headers(),
        body = request.postDataBuffer()!;
      expect(headers["x-memories-request"]).toBe("family-v1");
      expect(headers["x-contribution-agree"]).toBe("true");
      sends.push({
        key: headers["x-idempotency-key"],
        sha: headers["x-content-sha256"],
        bodySha: createHash("sha256").update(body).digest("hex"),
        name: decodeURIComponent(headers["x-contribution-attribution"]),
      });
      if (fail) {
        fail = false;
        return route.fulfill({ status: 503, json: { error: { code: "family_contribution_voice_unconfirmed" } } });
      }
      records.push({
        id: "contribution_voice_browser",
        memoryId: memory,
        version: 1,
        authorState: "submitted",
        own: true,
        canAssemble: false,
        canInclude: false,
        familyVisible: false,
        latestRevisionId: "contribution_voice_source_browser",
        includedRevisionId: null,
        revision: {
          id: "contribution_voice_source_browser",
          attribution: sends.at(-1)!.name,
          text: "",
          sourceKind: "human_voice",
          createdAt: "2026-11-15T00:00:01Z",
        },
        voice: { durationMs: Number(headers["x-audio-duration-ms"]), contentType: "audio/webm" },
      });
      return route.fulfill({ status: 201, json: { id: "contribution_voice_browser", version: 1 } });
    });

    await page.goto("/family");
    await page.getByRole("button", { name: "Our family photograph", exact: true }).click();
    await page.getByText(copy("Family recollections"), { exact: true }).click();
    await page.getByRole("button", { name: copy("Open recollections"), exact: true }).click();

    await page.getByRole("button", { name: copy("Record my voice"), exact: true }).click();
    await expect(page.getByRole("button", { name: copy("Stop recording"), exact: true })).toBeVisible();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: copy("Stop recording"), exact: true }).click();
    await expect(page.getByText(copy("Listen to your recording before submitting it."), { exact: true })).toBeVisible();

    // Nothing can be sent without a chosen name and an explicit review choice.
    const submit = page.getByRole("button", { name: copy("Submit my voice recollection for review"), exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel(copy("How would you like to be named?"), { exact: true }).fill("Tía María");
    await page
      .getByLabel(copy("I want the owner to review these words and choose whether this version is included for invited family."), { exact: true })
      .check();
    await submit.click();

    // A failed send keeps the recording and never claims it was saved.
    await expect(page.getByRole("alert")).toHaveText(
      copy("Your recording could not be confirmed as saved. It is still here; please try again."),
    );
    const savedCopy = copy("Your voice recollection is saved for review. It has not automatically been shared with family.");
    await expect(page.getByText(savedCopy, { exact: true })).toHaveCount(0);
    await expect(page.getByText(copy("Listen to your recording before submitting it."), { exact: true })).toBeVisible();

    await submit.click();
    await expect(page.getByText(savedCopy, { exact: true })).toBeVisible();
    expect(sends).toHaveLength(2);
    // The retry reuses the same key and sends the same untouched bytes.
    expect(sends[1].key).toBe(sends[0].key);
    expect(sends[1].sha).toBe(sends[0].sha);
    for (const send of sends) expect(send.bodySha).toBe(send.sha);
    expect(sends[1].name).toBe("Tía María");

    await expect(page.getByRole("heading", { name: "Tía María", exact: true })).toBeVisible();
    await expect(page.getByLabel(copy("Recollection in {name}'s own voice", { name: "Tía María" }), { exact: true })).toBeVisible();
    await expect(page.getByText(copy("Waiting for owner review"), { exact: true })).toBeVisible();
    // A spoken original is never offered for in-place revision.
    await expect(page.getByRole("button", { name: copy("Revise my recollection"), exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: copy("Withdraw my recollection"), exact: true })).toBeVisible();
    await expect(page.getByText(copy("Listen to your recording before submitting it."), { exact: true })).toHaveCount(0);
  });
