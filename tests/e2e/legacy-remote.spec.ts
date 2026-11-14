import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
for (const locale of ["en-US", "es-PR"] as const) {
  test(`${locale}: an unrecorded guest call can be attempted without recording consent and a provider outage remains retryable`, async ({
    page,
  }) => {
    const copy = (key: string) => translate(key, locale);
    let joins = 0;
    await page.addInitScript((value) => {
      localStorage.setItem("memoriesmystory:ui-locale", value);
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: () => {
          throw new Error("Unexpected media request before explicit control");
        },
      });
    }, locale);
    await page.route("**/resources/legacy-sessions/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/call")) {
        expect(route.request().method()).toBe("POST");
        expect(route.request().headers()["x-memories-request"]).toBe(
          "legacy-v1",
        );
        joins++;
        return route.fulfill({
          status: 503,
          json: { error: { code: "legacy_call_unavailable" } },
        });
      }
      if (path.endsWith("/photo"))
        return route.fulfill({
          path: "tests/fixtures/synthetic-family-photo.png",
          contentType: "image/png",
        });
      if (path.endsWith("/recordings"))
        return route.fulfill({ json: { recordings: [] } });
      return route.fulfill({
        json: {
          id: "legacy_remote_browser",
          mode: "remote",
          status: "draft",
          version: 1,
          consentEpoch: 0,
          consentVersion: "legacy-recording-v1",
          actorId: "participant_guest",
          actorRole: "guest",
          photoUrl:
            "/resources/legacy-sessions/legacy_remote_browser/photo?as=guest",
          canRecord: false,
          participants: [
            {
              id: "participant_host",
              role: "host",
              displayName: "Host",
              consent: "pending",
              joined: true,
              revoked: false,
            },
            {
              id: "participant_guest",
              role: "guest",
              displayName: "María",
              consent: "declined",
              joined: true,
              revoked: false,
            },
          ],
        },
      });
    });
    await page.goto("/legacy/legacy_remote_browser?as=guest");
    await expect(
      page.getByText(
        copy(
          "Joining does not give recording consent. This call is not being recorded.",
        ),
      ),
    ).toBeVisible();
    const join = page.getByRole("button", {
      name: copy("Join the call"),
      exact: true,
    });
    await expect(join).toBeEnabled();
    expect(joins).toBe(0);
    await join.click();
    await expect(page.getByRole("alert")).toHaveText(
      copy("Your call is not available yet. Please try again shortly."),
    );
    await expect(join).toBeEnabled();
    await join.click();
    expect(joins).toBe(2);
    await expect(
      page.getByRole("img", {
        name: copy("The photograph selected for this conversation"),
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
