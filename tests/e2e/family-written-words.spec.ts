import { test, expect, type Page } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { FamilyContribution } from "../../app/domain/family-contribution";

// Synthetic UI evidence with stubbed routes: the speaker writes their own words
// for a voice recollection; the owner chooses whether family sees them.
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: a speaker's written words survive a failed save and reach family only by owner choice`, async ({
    page,
    browser,
  }) => {
    const copy = (key: string, values?: Record<string, string | number>) =>
        translate(key, locale, values),
      memory = "memory_written_words_browser",
      grant = "grant_written_words_browser",
      words = "Dije que fue en mayo, creo.",
      photo =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";
    const record = {
      id: "contribution_words_browser",
      version: 2,
      included: true,
      latest: null as { id: string; text: string; createdAt: string } | null,
      pinned: null as string | null,
    };
    const keys: string[] = [];
    let fail = true;
    function view(actor: string): FamilyContribution {
      const mine = actor !== "owner";
      return {
        id: record.id,
        memoryId: memory,
        version: record.version,
        authorState: "submitted",
        own: mine,
        canAssemble: !mine,
        canInclude: !mine,
        familyVisible: record.included,
        latestRevisionId: "voice_source_words_browser",
        includedRevisionId: record.included ? "voice_source_words_browser" : null,
        revision: {
          id: "voice_source_words_browser",
          attribution: "Tía María",
          text: "",
          sourceKind: "human_voice",
          createdAt: "2026-11-15T00:00:01Z",
        },
        voice: { durationMs: 9000, contentType: "audio/webm" },
        photo: null,
        writtenWords: {
          latest: record.latest,
          included: record.pinned && record.latest?.id === record.pinned ? record.latest : null,
        },
      };
    }
    async function install(target: Page, actor: string) {
      await target.addInitScript(
        (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
        locale,
      );
      await target.route("**/resources/drafts/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/living-memory"))
          return route.fulfill({
            json: {
              livingMemoryId: memory,
              status: "complete",
              version: 1,
              completedAt: "2026-11-15T00:00:00Z",
              originals: {
                photo: { assetId: "photo_words_original", mediaUrl: photo },
                audio: { assetId: "audio_words_original", mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF" },
              },
              transcript: null,
              context: [],
              musePrompt: null,
            },
          });
        if (path.endsWith("/muse-conversation"))
          return route.fulfill({ json: { livingMemoryId: memory, turns: [], context: [], unresolved: [], done: true, currentQuestion: null } });
        if (path.endsWith("/process"))
          return route.fulfill({ json: { state: "ready", livingMemoryId: memory, transcript: null } });
        if (path.endsWith("/review"))
          return route.fulfill({ json: { originalTranscript: null, revisions: [], nextCursor: null } });
        return route.fulfill({ json: { scans: [] } });
      });
      await target.route("**/resources/living-memories/**/shares**", (route) =>
        route.fulfill({ json: { shares: [], nextCursor: null } }),
      );
      await target.route("**/resources/family-access**", (route) =>
        route.fulfill({
          json: new URL(route.request().url()).pathname.endsWith("/memberships")
            ? { memberships: [{ id: grant, role: "contributor", scopeKind: "memory", label: "Our family photograph" }], nextCursor: null }
            : {
                membership: { id: grant, role: "contributor", scopeKind: "memory" },
                memories: [{ id: memory, title: "Our family photograph", photoUrl: photo, audioUrl: null }],
                nextCursor: null,
              },
        }),
      );
      await target.route("**/resources/family-contributions/**", async (route) => {
        const request = route.request(),
          parts = new URL(request.url()).pathname.split("/"),
          id = parts[4],
          action = parts[5];
        if (request.method() === "GET") {
          if (action === "voice")
            return route.fulfill({ status: 200, contentType: "audio/webm", body: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]) });
          if (id) return route.fulfill({ json: { contribution: view(actor) } });
          return route.fulfill({
            json: { canContribute: true, draftScope: (actor === "owner" ? "6" : "5").repeat(64), nextCursor: null, contributions: [view(actor)] },
          });
        }
        const body = request.postDataJSON();
        expect(body.version).toBe(record.version);
        if (action === "transcript") {
          expect(actor).toBe("participant");
          expect(body.agree).toBe(true);
          keys.push(request.headers()["x-idempotency-key"]);
          if (fail) {
            fail = false;
            return route.fulfill({ status: 503, json: { error: { code: "family_contribution_unavailable" } } });
          }
          record.latest = { id: "written_words_browser_1", text: body.text, createdAt: "2026-11-15T00:00:02Z" };
        } else {
          expect(action).toBe("transcript-assembly");
          expect(actor).toBe("owner");
          record.pinned = body.include ? body.transcriptId : null;
        }
        record.version++;
        return route.fulfill({ json: { id: record.id, version: record.version } });
      });
    }
    await install(page, "participant");
    await page.goto("/family");
    await page.getByRole("button", { name: "Our family photograph", exact: true }).click();
    await page.getByText(copy("Family recollections"), { exact: true }).click();
    await page.getByRole("button", { name: copy("Open recollections"), exact: true }).click();

    await page.getByText(copy("Write the words I said in this recording"), { exact: true }).click();
    const field = page.getByLabel(copy("The words I said, as I would write them"), { exact: true }),
      save = page.getByRole("button", { name: copy("Save my written words for review"), exact: true });
    await field.fill(words);
    await expect(save).toBeDisabled();
    await page
      .getByLabel(copy("I want the owner to review these written words and choose whether they are included for invited family."), { exact: true })
      .check();
    await save.click();
    // A failed save keeps the typed words and makes no saved claim.
    await expect(page.getByRole("alert")).toBeVisible();
    const savedCopy = copy("Your written words are saved for review. They have not automatically been shared with family.");
    await expect(page.getByText(savedCopy, { exact: true })).toHaveCount(0);
    await expect(field).toHaveValue(words);
    await save.click();
    await expect(page.getByText(savedCopy, { exact: true })).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    await expect(page.getByText(copy("Written by {name} for this recording", { name: "Tía María" }), { exact: true })).toBeVisible();
    await expect(page.locator("p.human-recollection-text", { hasText: words })).toBeVisible();
    await expect(page.getByText(copy("Written words are waiting for owner review"), { exact: true })).toBeVisible();

    const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const owner = await ownerContext.newPage();
      await install(owner, "owner");
      await owner.goto(`/memory/${memory}`);
      await owner.getByText(copy("Family recollections"), { exact: true }).click();
      await owner.getByRole("button", { name: copy("Open recollections"), exact: true }).click();
      await expect(owner.getByText(words, { exact: true })).toBeVisible();
      // The owner cannot edit the speaker's words; they only choose inclusion.
      await expect(owner.getByLabel(copy("The words I said, as I would write them"), { exact: true })).toHaveCount(0);
      await owner.getByRole("button", { name: copy("Include these written words for family"), exact: true }).click();
      await expect(owner.getByText(copy("These written words are included for invited family"), { exact: true })).toBeVisible();
      expect(record.pinned).toBe("written_words_browser_1");
    } finally {
      await ownerContext.close();
    }
  });
