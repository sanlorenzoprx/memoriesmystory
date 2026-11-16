import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
for (const locale of ["en-US", "es-PR"] as const)
  test(`${locale}: invitation retries retain scope, recipient verification and revocation remain explicit`, async ({
    page,
  }) => {
    const copy = (key: string) => translate(key, locale),
      token = "a".repeat(64),
      grant = {
        id: "family_grant_browser",
        archiveId: "family_archive_browser",
        role: "viewer",
        scopeKind: "memory",
        scopeId: "memory_family_browser",
        targetEmail: "relative@example.test",
        state: "pending",
        version: 1,
        expiresAt: "2099-01-01T00:00:00Z",
      };
    let created = false,
      failCreate = true,
      failAccept = true;
    const keys: string[] = [];
    page.on("dialog", (dialog) => void dialog.accept());
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/archive/drafts", (route) =>
      route.fulfill({
        json: {
          drafts: [
            {
              id: grant.scopeId,
              status: "complete",
              ui_locale: "en-US",
              created_at: "2026-11-14T00:00:00Z",
              updated_at: "2026-11-14T00:00:00Z",
            },
          ],
        },
      }),
    );
    await page.route("**/resources/family-archives**", (route) =>
      route.fulfill({
        json: {
          archives: [
            {
              id: grant.archiveId,
              title: "Our family",
              description: "",
              version: 1,
            },
          ],
          archiveId: grant.archiveId,
          chapters: [],
          memories: [
            {
              id: grant.scopeId,
              title: "Abuela en la cocina",
              titleVersion: 1,
              photoUrl: null,
              voiceAvailable: true,
            },
          ],
          nextMemoryCursor: null,
          nextChapterCursor: null,
        },
      }),
    );
    await page.route("**/resources/family-access**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.endsWith("/grants") && request.method() === "POST") {
        keys.push(request.headers()["x-idempotency-key"]);
        expect(request.postDataJSON()).toMatchObject({
          scopeKind: "memory",
          scopeId: grant.scopeId,
          targetEmail: "relative@example.test",
          role: "viewer",
        });
        if (failCreate) {
          failCreate = false;
          return route.fulfill({
            status: 503,
            json: { error: { code: "family_access_unavailable" } },
          });
        }
        created = true;
        return route.fulfill({
          status: 201,
          json: {
            id: grant.id,
            version: 1,
            joinPath: `/family/join/${token}`,
            // Sending is switched off until a sending domain is onboarded.
            ...(request.postDataJSON().emailInvitation
              ? { email: { status: "not_sent", code: "email_sending_off" } }
              : {}),
          },
        });
      }
      if (path.endsWith("/grants"))
        return route.fulfill({
          json: { grants: created ? [grant] : [], nextCursor: null },
        });
      if (path.endsWith("/revoke")) {
        grant.state = "revoked";
        grant.version++;
        return route.fulfill({
          json: { id: grant.id, version: grant.version },
        });
      }
      if (path.endsWith("/accept")) {
        if (failAccept) {
          failAccept = false;
          return route.fulfill({
            status: 403,
            json: { error: { code: "family_recipient_mismatch" } },
          });
        }
        grant.state = "accepted";
        grant.version = 2;
        return route.fulfill({ json: { id: grant.id, version: 2 } });
      }
      if (path.includes("/invite/"))
        return route.fulfill({
          json: {
            role: "viewer",
            scopeKind: "memory",
            expiresAt: grant.expiresAt,
          },
        });
      if (path.endsWith("/view")) {
        if (grant.state === "revoked")
          return route.fulfill({
            status: 403,
            json: { error: { code: "family_access_denied" } },
          });
        return route.fulfill({
          json: {
            membership: { id: grant.id, role: "viewer", scopeKind: "memory" },
            memories: [
              {
                id: grant.scopeId,
                title: "Abuela en la cocina",
                photoUrl: `/resources/family-access/memberships/${grant.id}/media/photo_browser`,
                audioUrl: `/resources/family-access/memberships/${grant.id}/media/voice_browser`,
              },
            ],
            nextCursor: null,
          },
        });
      }
      if (path.endsWith("/photo_browser"))
        return route.fulfill({
          path: "tests/fixtures/synthetic-family-photo.png",
          contentType: "image/png",
        });
      return route.fulfill({
        json: {
          memberships:
            grant.state === "accepted"
              ? [
                  {
                    id: grant.id,
                    role: "viewer",
                    scopeKind: "memory",
                    label: "Abuela en la cocina",
                  },
                ]
              : [],
          nextCursor: null,
        },
      });
    });
    await page.goto("/archive");
    await page.getByText(copy("Invite family"), { exact: true }).click();
    await page
      .getByLabel(copy("Their email address"), { exact: true })
      .fill("relative@example.test");
    await page
      .getByRole("button", {
        name: copy("Create family invitation"),
        exact: true,
      })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByText(copy("Your family invitation is ready."), { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel(copy("Their email address"), { exact: true }),
    ).toHaveValue("relative@example.test");
    await page
      .getByRole("button", {
        name: copy("Create family invitation"),
        exact: true,
      })
      .click();
    await expect(
      page.getByText(copy("Your family invitation is ready."), { exact: true }),
    ).toBeVisible();
    expect(keys[0]).toBe(keys[1]);
    await expect(
      page.getByLabel(copy("Private family invitation link"), { exact: true }),
    ).toHaveValue(new RegExp(`/family/join/${token}$`));
    // Asking to email it afterwards replays the same invitation and says plainly nothing was sent.
    await page
      .getByLabel(copy("Also email the invitation link to this address"), { exact: true })
      .check();
    await page
      .getByRole("button", { name: copy("Create family invitation"), exact: true })
      .click();
    await expect(
      page.getByText(
        copy("Email is not available yet, so nothing was emailed. Send the link below yourself."),
        { exact: true },
      ),
    ).toBeVisible();
    expect(keys[2]).toBe(keys[0]);
    await page.goto(`/family/join/${token}`);
    await page
      .getByRole("button", {
        name: copy("Accept family invitation"),
        exact: true,
      })
      .click();
    await expect(page.getByRole("alert")).toHaveText(
      copy(
        "Use the verified email account that received this family invitation.",
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Abuela en la cocina", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: copy("Accept family invitation"),
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Abuela en la cocina", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByAltText(copy("Shared original photograph"), { exact: true }),
    ).toBeVisible();
    await expect(page.locator("audio")).toHaveAttribute(
      "src",
      new RegExp(`/memberships/${grant.id}/media/voice_browser$`),
    );
    await page.goto("/archive");
    await page.getByText(copy("Invite family"), { exact: true }).click();
    await page
      .getByRole("button", { name: copy("Review family access"), exact: true })
      .click();
    await page
      .getByRole("button", { name: copy("Remove family access"), exact: true })
      .click();
    await expect(
      page.getByText(copy("Access removed"), { exact: true }),
    ).toBeVisible();
    await page.goto("/family");
    await expect(
      page.getByText(
        copy("No family invitations have been accepted by this account yet."),
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
