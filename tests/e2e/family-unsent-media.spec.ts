import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";

// Synthetic UI evidence: the microphone is an oscillator and the server is
// stubbed. It proves an unsent recording and photograph survive a reload with
// their request keys, and that deleting the memory clears them.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: an unsent recording and photograph survive a reload and are cleared when the memory is deleted`, async ({ page }) => {
    const copy = (key: string, values?: Record<string, string | number>) => translate(key, locale, values),
      memory = "memory_unsent_media_browser",
      grant = "grant_unsent_media_browser",
      photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";
    const sends: { kind: string; key: string }[] = [];
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
          ? { memberships: [{ id: grant, role: "contributor", scopeKind: "memory", label: "Our family photograph" }], nextCursor: null }
          : { membership: { id: grant, role: "contributor", scopeKind: "memory" }, memories: [{ id: memory, title: "Our family photograph", photoUrl: photo, audioUrl: null }], nextCursor: null },
      }),
    );
    await page.route("**/resources/family-contributions/**", async (route) => {
      const request = route.request(),
        parts = new URL(request.url()).pathname.split("/");
      if (request.method() === "GET")
        return route.fulfill({ json: { canContribute: true, draftScope: "4".repeat(64), nextCursor: null, contributions: [] } });
      sends.push({ kind: parts[4]!, key: request.headers()["x-idempotency-key"] });
      // Every send fails here: the point is what survives on the device.
      return route.fulfill({ status: 503, json: { error: { code: "family_contribution_voice_unconfirmed" } } });
    });
    const open = async () => {
      await page.goto("/family");
      await page.getByRole("button", { name: "Our family photograph", exact: true }).click();
      await page.getByText(copy("Family recollections"), { exact: true }).click();
      await page.getByRole("button", { name: copy("Open recollections"), exact: true }).click();
    };
    await open();
    await page.getByRole("button", { name: copy("Record my voice"), exact: true }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: copy("Stop recording"), exact: true }).click();
    const listen = page.getByText(copy("Listen to your recording before submitting it."), { exact: true });
    await expect(listen).toBeVisible();
    await page.getByLabel(copy("How would you like to be named?"), { exact: true }).fill("Tía María");
    await page.getByLabel(copy("I want the owner to review these words and choose whether this version is included for invited family."), { exact: true }).check();
    await page.getByRole("button", { name: copy("Submit my voice recollection for review"), exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel(copy("Choose a photograph to add"), { exact: true }).setInputFiles({
      name: "back-of-print.png",
      mimeType: "image/png",
      buffer: readFileSync(new URL("../fixtures/synthetic-family-photo.png", import.meta.url)),
    });
    await expect(page.getByAltText(copy("Photograph you chose to add"), { exact: true })).toBeVisible();

    // A reload keeps both, and a send after it reuses the recording's request key.
    await open();
    await expect(listen).toBeVisible();
    await expect(page.getByAltText(copy("Photograph you chose to add"), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy("Submit my voice recollection for review"), exact: true }).click();
    await expect.poll(() => sends.filter((send) => send.kind === "voice").length).toBe(2);
    const voiceSends = sends.filter((send) => send.kind === "voice");
    expect(voiceSends[1]!.key).toBe(voiceSends[0]!.key);

    // Deleting the memory (announced to every open tab) clears what was kept.
    await page.evaluate((id) => new BroadcastChannel("memoriesmystory-legacy-deletion").postMessage({ memoryId: id }), memory);
    await page.waitForTimeout(300);
    await open();
    await expect(listen).toHaveCount(0);
    await expect(page.getByAltText(copy("Photograph you chose to add"), { exact: true })).toHaveCount(0);
  });
