import { expect, test } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type { LegacySessionView } from "../../app/domain/our-living-legacy";
const id = "legacy_browser_test",
  token = "x".repeat(43);
for (const locale of ["en-US", "es-PR"] as const) {
  test(`${locale}: a guest chooses only their own consent and loses the photo on revocation`, async ({
    page,
  }, testInfo) => {
    const copy = (key: string) => translate(key, locale);
    let consent = "pending",
      revoked = false,
      joined = false,
      mutations = 0;
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/legacy-sessions/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.endsWith("/recordings")) {
        await route.fulfill({ json: { recordings: [] } });
        return;
      }
      if (path.endsWith("/join")) {
        expect(request.postDataJSON()).toMatchObject({
          inviteToken: token,
          displayName: "María",
        });
        joined = true;
        await route.fulfill({
          json: { sessionId: id, participantId: "participant_guest" },
        });
        return;
      }
      if (revoked) {
        await route.fulfill({
          status: 403,
          json: { error: { code: "legacy_participant_required" } },
        });
        return;
      }
      if (path.endsWith("/photo")) {
        await route.fulfill({
          path: "tests/fixtures/synthetic-family-photo.png",
          contentType: "image/png",
        });
        return;
      }
      if (path.endsWith("/consent")) {
        expect(new URL(request.url()).searchParams.get("as")).toBe("guest");
        expect(request.headers()["x-memories-request"]).toBe("legacy-v1");
        consent = request.postDataJSON().agree ? "accepted" : "declined";
        mutations++;
        await route.fulfill({ json: { ok: true } });
        return;
      }
      const view: LegacySessionView = {
        id,
        mode: "remote",
        status: "draft",
        version: 1,
        consentEpoch: 1,
        consentVersion: "legacy-recording-v1",
        actorId: "participant_guest",
        actorRole: "guest",
        photoUrl: `/resources/legacy-sessions/${id}/photo?as=guest`,
        participants: [
          {
            id: "participant_host",
            role: "host",
            displayName: "Host",
            consent: "accepted",
            joined: true,
            revoked: false,
          },
          {
            id: "participant_guest",
            role: "guest",
            displayName: "María",
            consent: consent as "pending" | "accepted" | "declined",
            joined,
            revoked: false,
          },
        ],
        canRecord: joined && consent === "accepted",
      };
      await route.fulfill({ json: view });
    });
    await page.goto(`/legacy/${id}/join#${token}`);
    await page
      .getByLabel(copy("Your name for this conversation"))
      .fill("María");
    await page
      .getByRole("button", {
        name: copy("Join this private conversation"),
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("img", {
        name: copy("The photograph selected for this conversation"),
      }),
    ).toBeVisible();
    const allow = page.getByRole("button", {
      name: copy("Give my recording consent"),
      exact: true,
    });
    await expect(allow).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: copy("I agree to recording this private conversation."),
      })
      .check();
    await allow.click();
    await expect(
      page.getByText(copy("Both of you have agreed to recording."), {
        exact: true,
      }),
    ).toBeVisible();
    expect(mutations).toBe(1);
    await page
      .getByRole("button", {
        name: copy("Withdraw my recording consent"),
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        copy("Recording is not permitted until both people join and agree."),
        { exact: true },
      ),
    ).toBeVisible();
    expect(mutations).toBe(2);
    await expect(
      page.getByRole("button", { name: copy("Remove access"), exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath("legacy-consent-phone.png"),
      fullPage: true,
    });
    revoked = true;
    await expect(page.getByRole("alert")).toHaveText(
      copy("This conversation is not available with your current access."),
    );
    await expect(
      page.getByRole("img", {
        name: copy("The photograph selected for this conversation"),
      }),
    ).toHaveCount(0);
  });
}
