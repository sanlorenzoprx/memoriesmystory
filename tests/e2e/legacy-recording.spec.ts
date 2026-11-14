import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { translate } from "../../app/localization/messages";
import type {
  LegacyRecording,
  LegacySessionView,
} from "../../app/domain/our-living-legacy";
const sessionId = "legacy_recording_phone",
  recordingId = "recording_phone_original";
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
async function setup(page: Page, locale: "en-US" | "es-PR" = "en-US") {
  let allowed = true,
    epoch = 1,
    version = 1,
    attempts = 0,
    failNext = false;
  let original: Buffer | null = null;
  let partial = false;
  let recordings: LegacyRecording[] = [];
  await page.addInitScript((value) => {
    localStorage.setItem("memoriesmystory:ui-locale", value);
    const media = navigator.mediaDevices;
    const original = media.getUserMedia.bind(media);
    let calls = 0;
    Object.defineProperty(window, "legacyMicCalls", { get: () => calls });
    media.getUserMedia = (...args) => {
      calls++;
      return original(...args).then((stream) => {
        Reflect.set(window, "legacyLastStream", stream);
        return stream;
      });
    };
  }, locale);
  await page.route("**/resources/legacy-sessions/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path.endsWith("/invitation")) {
      await route.fulfill({ json: { joinPath: null } });
      return;
    }
    if (path.endsWith("/photo")) {
      await route.fulfill({
        path: "tests/fixtures/synthetic-family-photo.png",
        contentType: "image/png",
      });
      return;
    }
    if (path.endsWith("/recordings") && request.method() === "POST") {
      expect(allowed).toBe(true);
      await route.fulfill({
        status: 201,
        json: {
          recordingId,
          consentEpoch: epoch,
          uploadExpiresAt: "2099-01-01T00:00:00Z",
        },
      });
      return;
    }
    if (path.endsWith("/recordings")) {
      await route.fulfill({ json: { recordings } });
      return;
    }
    if (
      path.endsWith(`/recordings/${recordingId}`) &&
      request.method() === "PUT"
    ) {
      attempts++;
      if (!allowed) {
        await route.fulfill({
          status: 409,
          json: { error: { code: "legacy_consent_changed" } },
        });
        return;
      }
      if (failNext) {
        failNext = false;
        await route.fulfill({
          status: 503,
          json: { error: { code: "legacy_recording_pending" } },
        });
        return;
      }
      original = request.postDataBuffer()!;
      partial = request.headers()["x-recording-interrupted"] === "1";
      expect(request.headers()["x-content-sha256"]).toBe(digest(original));
      const receipt = {
        recordingId,
        status: "durable" as const,
        sha256: digest(original),
        byteSize: original.length,
        durationMs: Number(request.headers()["x-audio-duration-ms"]),
        interrupted: partial,
        capturedByParticipantId: "participant_host",
        photoAssetId: "photo_phone_original",
        consentEpoch: epoch,
        durableAt: new Date().toISOString(),
      };
      recordings = [
        {
          ...receipt,
          mediaUrl: `/resources/legacy-sessions/${sessionId}/recordings/${recordingId}/media`,
          attribution: "unconfirmed",
          claims: [],
        },
      ];
      version++;
      await route.fulfill({ status: 201, json: receipt });
      return;
    }
    if (path.endsWith("/media")) {
      await route.fulfill({ body: original!, contentType: "audio/webm" });
      return;
    }
    if (path.endsWith("/claims")) {
      const body = request.postDataJSON();
      recordings[0]!.claims.push({
        id: "claim_phone_own",
        recordingId,
        participantId: "participant_host",
        startMs: body.startMs,
        endMs: body.endMs,
        note: body.note,
        attributionType: "self_identified",
        displayName: "Host",
      });
      version++;
      await route.fulfill({
        status: 201,
        json: { claimId: "claim_phone_own" },
      });
      return;
    }
    const view: LegacySessionView = {
      id: sessionId,
      memoryId: "memory_recording_phone",
      mode: "in_person",
      status: "draft",
      version,
      consentEpoch: epoch,
      consentVersion: "legacy-recording-v1",
      actorId: "participant_host",
      actorRole: "host",
      photoUrl: `/resources/legacy-sessions/${sessionId}/photo`,
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
          displayName: "Guest",
          consent: allowed ? "accepted" : "declined",
          joined: true,
          revoked: false,
        },
      ],
      canRecord: allowed,
    };
    await route.fulfill({ json: view });
  });
  return {
    copy: (key: string) => translate(key, locale),
    setAllowed: (value: boolean) => {
      allowed = value;
      epoch++;
      version++;
    },
    failNext: () => {
      failNext = true;
    },
    attempts: () => attempts,
    original: () => original,
    partial: () => partial,
  };
}
async function chunks(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const request = indexedDB.open("memoriesmystory-legacy", 1);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("chunks")) {
            db.close();
            resolve(0);
            return;
          }
          const get = db.transaction("chunks").objectStore("chunks").count();
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
        };
      }),
  );
}
async function playerHash(page: Page, label: string) {
  return page
    .locator(`audio[aria-label="${label}"]`)
    .evaluate(async (element) => {
      const bytes = await (
        await fetch((element as HTMLAudioElement).src)
      ).arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    });
}
for (const locale of ["en-US", "es-PR"] as const) {
  test(`${locale}: shared original survives pause, failed backup and reload, then receives only a separate own-speaker note`, async ({
    page,
  }, testInfo) => {
    const s = await setup(page, locale),
      copy = s.copy;
    await page.goto(`/legacy/${sessionId}`);
    expect(
      await page.evaluate(() => Reflect.get(window, "legacyMicCalls")),
    ).toBe(0);
    await page
      .getByRole("button", {
        name: copy("Record our conversation"),
        exact: true,
      })
      .click();
    await expect.poll(() => chunks(page)).toBeGreaterThan(0);
    await page
      .getByRole("button", {
        name: copy("Pause conversation recording"),
        exact: true,
      })
      .click();
    await expect(
      page.getByText(copy("Conversation recording paused"), { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: copy("Resume conversation recording"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: copy("Stop and listen together"),
        exact: true,
      })
      .click();
    const backup = page.getByRole("button", {
      name: copy("Back up this original recording"),
      exact: true,
    });
    await expect(backup).toBeVisible();
    const before = await playerHash(
      page,
      copy("Listen to this device recording"),
    );
    s.failNext();
    await backup.click();
    await expect(page.getByRole("alert")).toContainText(
      copy(
        "This recording's backup was not confirmed. Keep your device copy and try again.",
      ),
    );
    await page.reload();
    await expect(backup).toBeVisible();
    expect(
      await playerHash(page, copy("Listen to this device recording")),
    ).toBe(before);
    await expect(
      page.getByText(copy("Original conversation backed up privately"), {
        exact: true,
      }),
    ).toHaveCount(0);
    await backup.click();
    await expect(
      page.getByText(copy("Original conversation backed up privately"), {
        exact: true,
      }),
    ).toBeVisible();
    expect(digest(s.original()!)).toBe(before);
    expect(s.attempts()).toBe(2);
    await page
      .getByText(copy("Identify my own words"), { exact: true })
      .click();
    await page.getByLabel(copy("My voice starts at (seconds)")).fill("0");
    await page.getByLabel(copy("My voice ends at (seconds)")).fill("0.5");
    await page
      .getByLabel(copy("My separate recollection or speaker note (optional)"))
      .fill("I remember a different summer.");
    await page
      .getByRole("button", { name: copy("Keep my speaker note"), exact: true })
      .click();
    await expect(
      page.getByText("I remember a different summer.", { exact: true }),
    ).toBeVisible();
    expect(
      await playerHash(page, copy("Replay the original conversation")),
    ).toBe(before);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath("legacy-shared-recording.png"),
      fullPage: true,
    });
  });
}
test("reload during capture recovers only persisted chunks as partial without restarting the microphone", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(`/legacy/${sessionId}`);
  await page
    .getByRole("button", { name: "Record our conversation", exact: true })
    .click();
  await expect.poll(() => chunks(page)).toBeGreaterThan(0);
  await page.reload();
  await expect(
    page.getByText(
      "An interrupted recording was recovered. Only the recorded part is available; its backup is not confirmed.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "legacyMicCalls"))).toBe(
    0,
  );
  await page
    .getByRole("button", {
      name: "Back up this original recording",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Original conversation backed up privately", {
      exact: true,
    }),
  ).toBeVisible();
  expect(s.partial()).toBe(true);
});
test("consent loss stops capture, keeps the partial locally and refuses backup", async ({
  page,
}) => {
  const s = await setup(page);
  await page.goto(`/legacy/${sessionId}`);
  await page
    .getByRole("button", { name: "Record our conversation", exact: true })
    .click();
  await expect.poll(() => chunks(page)).toBeGreaterThan(0);
  s.setAllowed(false);
  await expect(
    page.getByText(
      "Recording stopped because agreement or connection changed. Review the part kept on this device.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop and listen together", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Back up this original recording",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Recording choices changed.",
  );
  await expect(
    page.getByText("Original conversation backed up privately", {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(s.original()).toBe(null);
});

test("a declined participant keeps recording disabled without requesting the microphone", async ({
  page,
}) => {
  const s = await setup(page);
  s.setAllowed(false);
  await page.goto(`/legacy/${sessionId}`);
  await expect(
    page.getByRole("button", { name: "Record our conversation", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => Reflect.get(window, "legacyMicCalls"))).toBe(
    0,
  );
});
test("cancelled microphone permission stops a stream granted after cancellation", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    const media = navigator.mediaDevices,
      original = media.getUserMedia.bind(media);
    media.getUserMedia = async (constraints) => {
      await new Promise<void>((resolve) =>
        Reflect.set(window, "releaseLegacyMic", resolve),
      );
      const stream = await original(constraints);
      Reflect.set(window, "lateLegacyTracks", stream.getTracks());
      return stream;
    };
  });
  await page.goto(`/legacy/${sessionId}`);
  await page
    .getByRole("button", { name: "Record our conversation", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => typeof Reflect.get(window, "releaseLegacyMic")),
    )
    .toBe("function");
  await page
    .getByRole("button", { name: "Cancel microphone request", exact: true })
    .click();
  await page.evaluate(() => Reflect.get(window, "releaseLegacyMic")());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tracks = Reflect.get(window, "lateLegacyTracks") as
          MediaStreamTrack[] | undefined;
        return Boolean(
          tracks?.length &&
          tracks.every((track) => track.readyState === "ended"),
        );
      }),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Stop and listen together", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record our conversation", exact: true }),
  ).toBeEnabled();
});

test("another tab cannot recover and finalize a still-locked take", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.goto(`/legacy/${sessionId}`);
  await expect(
    page.getByRole("button", { name: "Record our conversation", exact: true }),
  ).toBeEnabled();
  await page.evaluate(async (id) => {
    const request = indexedDB.open("memoriesmystory-legacy", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["recordings", "chunks"], "readwrite");
      tx.objectStore("recordings").put({
        id: "recording_tab_active",
        sessionId: id,
        memoryId: "memory_recording_phone",
        actorId: "participant_host",
        consentEpoch: 1,
        startedAt: new Date().toISOString(),
        mimeType: "audio/wav",
        durationMs: 1000,
        interrupted: false,
        stage: "recording",
        receipt: null,
      });
      tx.objectStore("chunks").put({
        recordingId: "recording_tab_active",
        index: 0,
        blob: new Blob(
          [new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69])],
          { type: "audio/wav" },
        ),
      });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    await new Promise<void>((resolve, reject) => {
      void navigator.locks
        .request("memoriesmystory-recording-recording_tab_active", async () => {
          const done = new Promise<void>((release) =>
            Reflect.set(window, "releaseOtherTabTake", release),
          );
          resolve();
          await done;
        })
        .catch(reject);
    });
  }, sessionId);
  const other = await context.newPage();
  await setup(other);
  await other.goto(`/legacy/${sessionId}`);
  await expect(other.getByRole("alert")).toContainText(
    "Another tab is keeping this recording.",
  );
  await expect(
    other.getByRole("button", { name: "Record our conversation", exact: true }),
  ).toBeDisabled();
  await expect(
    other.getByRole("button", {
      name: "Back up this original recording",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, "releaseOtherTabTake")());
  await other
    .getByRole("button", { name: "Recheck device recordings", exact: true })
    .click();
  await expect(
    other.getByText(
      "An interrupted recording was recovered. Only the recorded part is available; its backup is not confirmed.",
      { exact: true },
    ),
  ).toBeVisible();
  await other.close();
});

test("storage exhaustion stops capture and protects the in-memory original until confirmed backup", async ({
  page,
}) => {
  const s = await setup(page);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    let chunks = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "chunks" && ++chunks > 1)
        throw new DOMException("Synthetic device quota", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.goto(`/legacy/${sessionId}`);
  await page
    .getByRole("button", { name: "Record our conversation", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Some recording bytes could not be kept on this device.",
  );
  await expect(
    page.getByRole("button", {
      name: "Back up this original recording",
      exact: true,
    }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      async () =>
        ((await navigator.locks.query()).held ?? []).filter((x) =>
          x.name?.startsWith("memoriesmystory-recording-"),
        ).length,
    ),
  ).toBe(1);
  const original = await playerHash(page, "Listen to this device recording");
  await page
    .getByRole("button", {
      name: "Back up this original recording",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Original conversation backed up privately", {
      exact: true,
    }),
  ).toBeVisible();
  expect(digest(s.original()!)).toBe(original);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          ((await navigator.locks.query()).held ?? []).filter((x) =>
            x.name?.startsWith("memoriesmystory-recording-"),
          ).length,
      ),
    )
    .toBe(0);
});

test("whole-memory deletion from another tab stops capture and removes local source chunks", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.goto(`/legacy/${sessionId}`);
  await page
    .getByRole("button", { name: "Record our conversation", exact: true })
    .click();
  await expect.poll(() => chunks(page)).toBeGreaterThan(0);
  const owner = await context.newPage();
  await owner.route("**/resources/**", async (route) => {
    const request = route.request();
    if (request.method() === "DELETE") {
      await route.fulfill({ json: { ok: true, deleted: true } });
      return;
    }
    if (new URL(request.url()).pathname.endsWith("/living-memory")) {
      await route.fulfill({
        json: {
          livingMemoryId: "memory_recording_phone",
          status: "complete",
          completedAt: "2026-11-13T12:00:00Z",
          originals: {
            photo: {
              assetId: "photo_phone_original",
              mediaUrl:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2f9sAAAAASUVORK5CYII=",
            },
            audio: {
              assetId: "solo_phone_original",
              mediaUrl: "data:audio/wav;base64,UklGRgQAAABXQVZF",
            },
          },
          transcript: null,
          musePrompt: null,
          context: [],
        },
      });
      return;
    }
    await route.fulfill({
      status: 401,
      json: { error: { code: "session_required" } },
    });
  });
  await owner.goto("/memory/memory_recording_phone");
  owner.once("dialog", (dialog) => dialog.accept());
  await owner
    .getByRole("button", { name: "Delete this memory", exact: true })
    .click();
  await expect(owner).toHaveURL(/\/archive$/);
  await expect(page.getByRole("alert")).toContainText(
    "This conversation was deleted. Recording has stopped.",
  );
  await expect.poll(() => chunks(page)).toBe(0);
  expect(
    await page.evaluate(() => {
      const stream = Reflect.get(window, "legacyLastStream") as
        MediaStream | undefined;
      return Boolean(
        stream?.getTracks().every((track) => track.readyState === "ended"),
      );
    }),
  ).toBe(true);
  await owner.close();
});
