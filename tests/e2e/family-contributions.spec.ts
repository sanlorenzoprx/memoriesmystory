import { test, expect, type Page } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { FamilyContribution } from "../../app/domain/family-contribution";
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: separate family words survive failure/reload and need explicit owner review`, async ({
    page,
    browser,
  }) => {
    const copy = (key: string) => translate(key, locale),
      memory = "memory_contribution_browser",
      grant = "grant_contribution_browser",
      words = "Yo recuerdo 1950, pero no estoy segura.",
      otherWords = "I remember 1951.",
      photo =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=";
    type Stored = Omit<FamilyContribution, "own" | "canAssemble"> & {
      author: string;
      versions: FamilyContribution["revision"][];
    };
    const other: Stored = {
      id: "contribution_browser_other",
      memoryId: memory,
      version: 2,
      author: "other",
      authorState: "submitted",
      canInclude: true,
      familyVisible: true,
      latestRevisionId: "revision_other_original",
      includedRevisionId: "revision_other_original",
      revision: {
        id: "revision_other_original",
        attribution: "Another relative",
        text: otherWords,
        sourceKind: "human_text",
        createdAt: "2026-11-15T00:00:00Z",
      },
      versions: [],
    };
    other.versions = [{ ...other.revision }];
    const records: Stored[] = [other];
    let fail = true;
    const keys: string[] = [];
    function visible(actor: string, source: Stored): FamilyContribution {
      return {
        ...source,
        own: source.author === actor,
        canAssemble: actor === "owner",
        canInclude: actor === "owner" && source.authorState === "submitted",
        familyVisible:
          source.authorState === "submitted" &&
          Boolean(source.includedRevisionId),
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
                photo: { assetId: "photo_contrib_original", mediaUrl: photo },
                audio: {
                  assetId: "audio_contrib_original",
                  mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF",
                },
              },
              transcript: null,
              context: [],
              musePrompt: null,
            },
          });
        if (path.endsWith("/muse-conversation"))
          return route.fulfill({
            json: {
              livingMemoryId: memory,
              turns: [],
              context: [],
              unresolved: [],
              done: true,
              currentQuestion: null,
            },
          });
        if (path.endsWith("/process"))
          return route.fulfill({
            json: { state: "ready", livingMemoryId: memory, transcript: null },
          });
        if (path.endsWith("/review"))
          return route.fulfill({
            json: { originalTranscript: null, revisions: [], nextCursor: null },
          });
        return route.fulfill({ json: { scans: [] } });
      });
      await target.route("**/resources/living-memories/**/shares**", (route) =>
        route.fulfill({ json: { shares: [], nextCursor: null } }),
      );
      await target.route("**/resources/family-access**", (route) => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({
          json: path.endsWith("/memberships")
            ? {
                memberships: [
                  {
                    id: grant,
                    role: "contributor",
                    scopeKind: "memory",
                    label: "Our family photograph",
                  },
                ],
                nextCursor: null,
              }
            : {
                membership: {
                  id: grant,
                  role: "contributor",
                  scopeKind: "memory",
                },
                memories: [
                  {
                    id: memory,
                    title: "Our family photograph",
                    photoUrl: photo,
                    audioUrl: null,
                  },
                ],
                nextCursor: null,
              },
        });
      });
      await target.route(
        "**/resources/family-contributions/**",
        async (route) => {
          const request = route.request(),
            parts = new URL(request.url()).pathname.split("/"),
            id = parts[4],
            action = parts[5],
            record = records.find((c) => c.id === id);
          if (request.method() === "GET") {
            if (action === "history")
              return route.fulfill({
                json: { revisions: record?.versions, nextCursor: null },
              });
            if (id)
              return route.fulfill({
                json: { contribution: visible(actor, record!) },
              });
            return route.fulfill({
              json: {
                canContribute: true,
                draftScope: (actor === "owner" ? "2" : "1").repeat(64),
                nextCursor: null,
                contributions: records
                  .filter(
                    (c) =>
                      actor === "owner" ||
                      c.author === actor ||
                      (c.authorState === "submitted" && c.includedRevisionId),
                  )
                  .map((c) => visible(actor, c)),
              },
            });
          }
          const body = request.postDataJSON();
          if (!id) {
            keys.push(request.headers()["x-idempotency-key"]);
            if (fail) {
              fail = false;
              return route.fulfill({
                status: 503,
                json: { error: { code: "family_contribution_unavailable" } },
              });
            }
            const revision = {
              id: "revision_browser_original",
              attribution: body.attribution,
              text: body.text,
              sourceKind: "human_text" as const,
              createdAt: "2026-11-15T00:00:01Z",
            };
            records.push({
              id: "contribution_browser_new",
              memoryId: memory,
              version: 1,
              author: actor,
              authorState: "submitted",
              canInclude: true,
              familyVisible: false,
              latestRevisionId: revision.id,
              includedRevisionId: null,
              revision,
              versions: [{ ...revision }],
            });
            return route.fulfill({
              status: 201,
              json: { id: "contribution_browser_new", version: 1 },
            });
          }
          expect(body.version).toBe(record!.version);
          if (action === "assembly") {
            expect(actor).toBe("owner");
            record!.includedRevisionId = body.include ? body.revisionId : null;
            record!.familyVisible = body.include;
          } else if (action === "withdraw") {
            expect(actor).toBe(record!.author);
            record!.authorState = "withdrawn";
            record!.includedRevisionId = null;
            record!.familyVisible = false;
          } else if (action === "revise") {
            expect(actor).toBe(record!.author);
            record!.revision = {
              ...record!.revision,
              id: "revision_browser_revised",
              text: body.text,
              attribution: body.attribution,
            };
            record!.latestRevisionId = record!.revision.id;
            record!.versions.push({ ...record!.revision });
          }
          record!.version++;
          return route.fulfill({
            json: { id: record!.id, version: record!.version },
          });
        },
      );
    }
    await install(page, "participant");
    const ownerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    try {
      const owner = await ownerContext.newPage();
      await install(owner, "owner");
      async function openParticipant() {
        await page.goto("/family");
        await page
          .getByRole("button", { name: "Our family photograph", exact: true })
          .click();
        await page
          .getByText(copy("Family recollections"), { exact: true })
          .click();
        await page
          .getByRole("button", {
            name: copy("Open recollections"),
            exact: true,
          })
          .click();
      }
      await openParticipant();
      await page
        .getByLabel(copy("How would you like to be named?"), { exact: true })
        .fill("María");
      await page
        .getByLabel(copy("Your recollection, in your own words"), {
          exact: true,
        })
        .fill(words);
      await page
        .getByLabel(
          copy(
            "I want the owner to review these words and choose whether this version is included for invited family.",
          ),
          { exact: true },
        )
        .check();
      await page
        .getByRole("button", {
          name: copy("Submit my recollection for review"),
          exact: true,
        })
        .click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(
        page.getByText(
          copy(
            "Your recollection is saved for review. It has not automatically been shared with family.",
          ),
          { exact: true },
        ),
      ).toHaveCount(0);
      const otherLocale = locale === "en-US" ? "es-PR" : "en-US";
      await page
        .getByRole("combobox", { name: copy("Interface language") })
        .selectOption(otherLocale);
      await expect(
        page.getByLabel(
          translate("Your recollection, in your own words", otherLocale),
          { exact: true },
        ),
      ).toHaveValue(words);
      await page
        .getByRole("combobox", {
          name: translate("Interface language", otherLocale),
        })
        .selectOption(locale);
      await openParticipant();
      await expect(
        page.getByLabel(copy("Your recollection, in your own words"), {
          exact: true,
        }),
      ).toHaveValue(words);
      await page
        .getByRole("button", {
          name: copy("Submit my recollection for review"),
          exact: true,
        })
        .click();
      await expect(page.getByRole("status")).toContainText(
        copy(
          "Your recollection is saved for review. It has not automatically been shared with family.",
        ),
      );
      expect(keys[0]).toBe(keys[1]);
      expect(
        records.find((c) => c.author === "participant")!.includedRevisionId,
      ).toBeNull();
      await owner.goto(`/memory/${memory}`);
      await owner
        .getByText(copy("Family recollections"), { exact: true })
        .click();
      await owner
        .getByRole("button", { name: copy("Open recollections"), exact: true })
        .click();
      const ownCard = owner
        .getByRole("heading", { name: "María", exact: true })
        .locator("..");
      await expect(ownCard.getByText(words, { exact: true })).toBeVisible();
      await expect(ownCard.locator("time")).toHaveAttribute(
        "datetime",
        "2026-11-15T00:00:01Z",
      );
      await expect(
        ownCard.getByRole("button", {
          name: copy("Revise my recollection"),
          exact: true,
        }),
      ).toHaveCount(0);
      await ownCard
        .getByRole("button", {
          name: copy("Include this version for family"),
          exact: true,
        })
        .click();
      await expect(
        ownCard.getByText(copy("This version is included for invited family"), {
          exact: true,
        }),
      ).toBeVisible();
      await expect(owner.getByText(otherWords, { exact: true })).toBeVisible();
      expect(records[0].revision.text).toBe(otherWords);
      await page
        .getByRole("button", {
          name: copy("Recheck recollections"),
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: copy("Revise my recollection"),
          exact: true,
        })
        .click();
      await page
        .getByLabel(copy("Your recollection, in your own words"), {
          exact: true,
        })
        .fill("Ahora recuerdo alrededor de 1952.");
      await page
        .getByLabel(
          copy(
            "I want the owner to review these words and choose whether this version is included for invited family.",
          ),
          { exact: true },
        )
        .check();
      await page
        .getByRole("button", {
          name: copy("Submit my recollection for review"),
          exact: true,
        })
        .click();
      expect(
        records.find((c) => c.author === "participant")!.includedRevisionId,
      ).toBe("revision_browser_original");
      expect(
        records.find((c) => c.author === "participant")!.versions[0].text,
      ).toBe(words);
      await owner
        .getByRole("button", {
          name: copy("Recheck recollections"),
          exact: true,
        })
        .click();
      await expect(
        ownCard.getByText(copy("An earlier reviewed version is included"), {
          exact: true,
        }),
      ).toBeVisible();
      await ownCard
        .getByRole("button", {
          name: copy("Include this version for family"),
          exact: true,
        })
        .click();
      expect(
        records.find((c) => c.author === "participant")!.includedRevisionId,
      ).toBe("revision_browser_revised");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(
        await owner.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    } finally {
      await ownerContext.close();
    }
  });
