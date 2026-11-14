import { test, expect } from "@playwright/test";
import { translate } from "../../app/localization/messages";
for (const locale of ["en-US", "es-PR"] as const) {
  test(`${locale}: remote originals are not shown as saved until verified and voice identification remains explicit`, async ({
    page,
  }) => {
    const copy = (key: string) => translate(key, locale),
      sessionId = "legacy_remote_archive_browser",
      recordingId = "remote_recording_browser";
    let phase = "",
      captureStopped = false,
      claims = 0;
    const keys: string[] = [];
    await page.addInitScript(
      (value) => localStorage.setItem("memoriesmystory:ui-locale", value),
      locale,
    );
    await page.route("**/resources/legacy-sessions/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.endsWith("/photo"))
        return route.fulfill({
          path: "tests/fixtures/synthetic-family-photo.png",
          contentType: "image/png",
        });
      if (path.endsWith("/invitation"))
        return route.fulfill({ json: { joinPath: null } });
      if (path.endsWith("/remote-recordings") && request.method() === "POST") {
        expect(request.headers()["x-memories-request"]).toBe("legacy-v1");
        keys.push(request.headers()["x-idempotency-key"]);
        phase = "recording";
        return route.fulfill({ status: 202, json: { recordingId } });
      }
      if (path.endsWith("/stop")) {
        phase = "processing";
        captureStopped = true;
        return route.fulfill({ status: 202, json: { ok: true } });
      }
      if (path.endsWith("/claim")) {
        expect(request.postDataJSON()).toMatchObject({
          confirm: true,
          note: "Soy María; esta es mi voz.",
        });
        claims++;
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith("/remote-recordings"))
        return route.fulfill({
          json: {
            available: true,
            recordings: phase
              ? [
                  {
                    id: recordingId,
                    phase,
                    captureStopped,
                    requestedAt: new Date().toISOString(),
                    preservedAt:
                      phase === "preserved" ? new Date().toISOString() : null,
                    completeness: "review_required",
                    sources:
                      phase === "preserved"
                        ? [
                            {
                              id: "remote_source_host",
                              kind: "participant_audio",
                              participantId: "participant_host",
                              byteSize: 1000,
                              sha256: "a".repeat(64),
                              speakerConfirmed: false,
                              mediaUrl: `/resources/legacy-sessions/${sessionId}/remote-recordings/${recordingId}/sources/remote_source_host`,
                            },
                          ]
                        : [],
                  },
                ]
              : [],
          },
        });
      return route.fulfill({
        json: {
          id: sessionId,
          mode: "remote",
          status: "draft",
          version: 1,
          consentEpoch: 2,
          consentVersion: "legacy-recording-v1",
          actorId: "participant_host",
          actorRole: "host",
          photoUrl: `/resources/legacy-sessions/${sessionId}/photo`,
          canRecord: true,
          ...(phase
            ? { remoteRecording: { id: recordingId, phase, captureStopped } }
            : {}),
          participants: [
            {
              id: "participant_host",
              role: "host",
              displayName: "María",
              consent: "accepted",
              joined: true,
              revoked: false,
            },
            {
              id: "participant_guest",
              role: "guest",
              displayName: "Guest",
              consent: "accepted",
              joined: true,
              revoked: false,
            },
          ],
        },
      });
    });
    await page.goto(`/legacy/${sessionId}`);
    await page
      .getByRole("button", {
        name: copy("Start recording our conversation"),
        exact: true,
      })
      .click();
    await expect(
      page.getByText(copy("This conversation is being recorded."), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        copy(
          "Joining does not give recording consent. This call is not being recorded.",
        ),
        { exact: true },
      ),
    ).toHaveCount(0);
    const saved = page.getByText(
      copy(
        "Conversation originals are saved privately. Review the playback for completeness.",
      ),
      { exact: true },
    );
    await expect(saved).toHaveCount(0);
    await page
      .getByRole("button", {
        name: copy("Stop conversation recording"),
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        copy("Recording stopped. Verifying the private originals…"),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(saved).toHaveCount(0);
    phase = "preserved";
    await expect(saved).toBeVisible();
    const confirm = page.getByRole("button", {
      name: copy("Keep my voice identification"),
      exact: true,
    });
    await expect(confirm).toBeDisabled();
    await page
      .getByLabel(copy("My voice identification note"), { exact: true })
      .fill("Soy María; esta es mi voz.");
    await page
      .getByLabel(copy("I listened and this is my voice."), { exact: true })
      .check();
    await confirm.click();
    await expect(
      page.getByText(
        copy(
          "You identified your own voice. This note remains separate from the original.",
        ),
        { exact: true },
      ),
    ).toBeVisible();
    expect(claims).toBe(1);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^remote_start_/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
