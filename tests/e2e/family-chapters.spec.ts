import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
for (const locale of ["en-US", "es-PR"] as const) {
  test(`${locale}: private Chapters retain edits on failure, reorder references and leave originals intact`, async ({
    page,
  }) => {
    const copy = (key: string) => translate(key, locale),
      otherLocale = locale === "en-US" ? "es-PR" : "en-US";
    const memories = [
      {
        id: "memory_chapter_first",
        title: "First family photograph",
        titleVersion: 1,
        photoUrl: "/resources/drafts/memory_chapter_first/media/photo_first",
        voiceAvailable: true,
      },
      {
        id: "memory_chapter_second",
        title: "Second family photograph",
        titleVersion: 1,
        photoUrl: "/resources/drafts/memory_chapter_second/media/photo_second",
        voiceAvailable: false,
      },
    ];
    type Chapter = {
      id: string;
      archiveId: string;
      title: string;
      description: string;
      version: number;
      position: number;
      visibility: string;
      coverMemoryId: string | null;
      memoryIds: string[];
    };
    const archives: {
      id: string;
      title: string;
      description: string;
      version: number;
    }[] = [];
    let chapter: Chapter | null = null,
      failSave = true,
      mediaWrites = 0;
    const saveKeys: string[] = [],
      dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({
        json: {
          drafts: memories.map((memory) => ({
            id: memory.id,
            status: "complete",
            ui_locale: "en-US",
            created_at: "2026-11-14T00:00:00Z",
            updated_at: "2026-11-14T00:00:00Z",
          })),
        },
      }),
    );
    await page.route("**/resources/drafts/**", (route) => {
      if (route.request().method() !== "GET") mediaWrites++;
      return route.fulfill({
        path: "tests/fixtures/synthetic-family-photo.png",
        contentType: "image/png",
      });
    });
    await page.route("**/resources/family-archives**", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname,
        method = request.method();
      if (method !== "GET")
        expect(request.headers()["x-memories-request"]).toBe("family-v1");
      if (path.endsWith("/archives") && method === "POST") {
        archives.push({
          id: "family_archive_browser",
          title: request.postDataJSON().title,
          description: "",
          version: 1,
        });
        return route.fulfill({
          status: 201,
          json: { id: archives[0]!.id, version: 1 },
        });
      }
      if (path.endsWith("/chapters") && method === "POST") {
        const body = request.postDataJSON();
        chapter = {
          id: "family_chapter_browser",
          archiveId: body.archiveId,
          title: body.title,
          description: "",
          version: 1,
          position: 0,
          visibility: "private",
          coverMemoryId: null,
          memoryIds: [],
        };
        return route.fulfill({
          status: 201,
          json: { id: "family_chapter_browser", version: 1 },
        });
      }
      if (path.endsWith("/chapters/family_chapter_browser")) {
        if (method === "GET") return route.fulfill({ json: { chapter } });
        if (method === "DELETE") {
          expect(request.postDataJSON().version).toBe(2);
          chapter = null;
          return route.fulfill({
            json: { id: "family_chapter_browser", version: 3 },
          });
        }
        if (method === "PATCH") {
          saveKeys.push(request.headers()["x-idempotency-key"]);
          const body = request.postDataJSON();
          expect(body.version).toBe(1);
          expect(body.memoryIds).toEqual([memories[1]!.id, memories[0]!.id]);
          expect(body.coverMemoryId).toBe(memories[1]!.id);
          if (failSave) {
            failSave = false;
            return route.fulfill({
              status: 503,
              json: { error: { code: "family_archive_unavailable" } },
            });
          }
          chapter = { ...chapter!, ...body, version: 2 };
          return route.fulfill({
            json: { id: "family_chapter_browser", version: 2 },
          });
        }
      }
      if (path.includes("/memories/"))
        return route.fulfill({
          json: { memory: memories.find((memory) => path.endsWith(memory.id)) },
        });
      return route.fulfill({
        json: {
          archives,
          archiveId: archives[0]?.id ?? null,
          chapters: chapter ? [chapter] : [],
          memories,
          nextMemoryCursor: null,
          nextChapterCursor: null,
        },
      });
    });
    await page.goto("/archive");
    await page
      .getByLabel(copy("Chapter name"), { exact: true })
      .fill("Grandmother's Kitchen");
    await page
      .getByRole("button", {
        name: copy("Create a private Chapter"),
        exact: true,
      })
      .click();
    const editor = page
      .getByRole("heading", { name: copy("Your private Chapter"), exact: true })
      .locator("..");
    await expect(editor).toBeVisible();
    await editor
      .getByLabel(copy("About this Chapter (optional)"), { exact: true })
      .fill("La mesa azul de nuestra familia");
    await editor.getByLabel("First family photograph", { exact: true }).check();
    await editor
      .getByLabel("Second family photograph", { exact: true })
      .check();
    await editor
      .getByRole("button", {
        name: translate("Move Living Memory {number} up", locale, {
          number: 2,
        }),
        exact: true,
      })
      .click();
    await editor
      .getByLabel(copy("Chapter cover"), { exact: true })
      .selectOption(memories[1]!.id);
    await expect(
      editor.getByRole("img", {
        name: copy("Chapter cover photograph"),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      editor.getByText(copy("The original voice is unavailable right now."), {
        exact: true,
      }),
    ).toBeVisible();
    await editor
      .getByRole("button", { name: copy("Save Chapter"), exact: true })
      .click();
    await expect(editor.getByRole("alert")).toHaveText(
      copy("Your private archive is unavailable right now. Please try again."),
    );
    await expect(
      editor.getByText(copy("Your private Chapter changes are saved."), {
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByLabel(copy("Interface language"), { exact: true })
      .selectOption(otherLocale);
    await expect(
      page.getByLabel(translate("About this Chapter (optional)", otherLocale), {
        exact: true,
      }),
    ).toHaveValue("La mesa azul de nuestra familia");
    await expect(
      page.getByLabel(translate("Chapter name", otherLocale), { exact: true }),
    ).toHaveValue("Grandmother's Kitchen");
    await page
      .getByLabel(translate("Interface language", otherLocale), { exact: true })
      .selectOption(locale);
    await page
      .getByRole("button", { name: copy("Save Chapter"), exact: true })
      .click();
    await expect(
      page.getByText(copy("Your private Chapter changes are saved."), {
        exact: true,
      }),
    ).toBeVisible();
    expect(saveKeys).toHaveLength(2);
    expect(saveKeys[0]).toBe(saveKeys[1]);
    await page
      .getByRole("button", { name: copy("Close Chapter"), exact: true })
      .click();
    expect(dialogs).toEqual([]);
    await page.getByRole("button", { name: /Grandmother's Kitchen/ }).click();
    await page
      .getByRole("button", { name: copy("Remove Chapter"), exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: copy("Your private Chapter"),
        exact: true,
      }),
    ).toHaveCount(0);
    expect(dialogs).toEqual([
      copy("Remove this Chapter? Its Living Memories stay in your archive."),
    ]);
    expect(memories).toHaveLength(2);
    expect(mediaWrites).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
