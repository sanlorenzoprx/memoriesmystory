import { expect, test } from "@playwright/test";

const syntheticPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("the first screen expresses the approved memory-preservation promise", async ({
  page
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Old photographs fade. The voices behind them should not."
    })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Capture a photo. Tell its story. Preserve your voice for the people you love."
    )
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture Your Memories" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import a photo" })).toBeVisible();
  await expect(page.getByText(/Muse|truthful save status/i)).toHaveCount(0);
});

test("both first-screen actions preserve their intended capture path", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Capture Your Memories" }).click();
  await expect(page).toHaveURL(/\/capture\/local_[^?]+\?start=camera$/);
  await expect(
    page.getByRole("heading", { name: "Bring the photograph into the light." })
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Import a photo" }).click();
  await expect(page).toHaveURL(/\/capture\/local_[^?]+\?start=import$/);
  await expect(
    page.getByRole("heading", {
      name: "Choose the photograph that brings the story back."
    })
  ).toBeVisible();
});

test("an imported photograph survives reload without a false saved claim", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import a photo" }).click();

  await page
    .getByLabel("Choose a photograph from this device")
    .setInputFiles({
      name: "synthetic-family-photo.png",
      mimeType: "image/png",
      buffer: syntheticPng
    });

  await expect(
    page.getByRole("heading", { name: "Does the photograph feel clear enough?" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Use this photo anyway" }).click();

  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." })
  ).toBeVisible();
  await expect(page.getByText(/This memory is now part/i)).toHaveCount(0);

  await page.reload();

  await expect(
    page.getByText("Your photograph is still here. We returned you to the same step.")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." })
  ).toBeVisible();
});

test("camera permission is contextual and denial keeps an import fallback", async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "cameraRequestCount", {
      configurable: true,
      writable: true,
      value: 0
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const current = Number(
            (window as unknown as { cameraRequestCount: number }).cameraRequestCount
          );
          (window as unknown as { cameraRequestCount: number }).cameraRequestCount =
            current + 1;
          throw new DOMException("Permission denied", "NotAllowedError");
        }
      }
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Capture Your Memories" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { cameraRequestCount: number }).cameraRequestCount
    )
  ).toBe(0);

  await page.getByRole("button", { name: "Open camera" }).click();

  await expect(
    page.getByRole("heading", { name: "The camera stayed closed." })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Import a photo" })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { cameraRequestCount: number }).cameraRequestCount
    )
  ).toBe(1);
});

test("a capability-qualified camera can capture and manually accept a photograph", async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 1280;
          canvas.height = 960;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Synthetic camera unavailable");
          context.fillStyle = "#d9c3a8";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#654a3a";
          context.fillRect(120, 100, 1040, 760);
          context.fillStyle = "#eadbc9";
          context.fillRect(150, 130, 980, 700);
          return canvas.captureStream(2);
        }
      }
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Capture Your Memories" }).click();
  await page.getByRole("button", { name: "Open camera" }).click();
  await expect(page.getByLabel("Live camera preview")).toBeVisible();
  await page.getByRole("button", { name: "Take photo" }).click();

  await expect(
    page.getByRole("heading", { name: "Does the photograph feel clear enough?" })
  ).toBeVisible();
  await page.getByRole("button", { name: /Use this photo/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." })
  ).toBeVisible();
});

test("an interrupted photograph upload retries the same local original", async ({
  page
}) => {
  await page.route("**/resources/drafts/*/photo", (route) => route.abort("internetdisconnected"), {
    times: 1
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import a photo" }).click();
  await page.getByLabel("Choose a photograph from this device").setInputFiles({
    name: "synthetic-family-photo.png",
    mimeType: "image/png",
    buffer: syntheticPng
  });
  await page.getByRole("button", { name: "Use this photo anyway" }).click();

  await expect(
    page.getByRole("heading", { name: "Your photograph is still here." })
  ).toBeVisible();
  await expect(
    page.getByText("The original remains recoverable on this device.")
  ).toBeVisible();

  await page.getByRole("button", { name: "Try preserving again" }).click();
  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." })
  ).toBeVisible();
});

test("the original voice is recorded, preserved, retrieved, and recovered", async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (!constraints.audio) throw new Error("Synthetic microphone expected");
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const destination = context.createMediaStreamDestination();
          oscillator.frequency.value = 220;
          oscillator.connect(destination);
          oscillator.start();
          return destination.stream;
        }
      }
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Import a photo" }).click();
  await page.getByLabel("Choose a photograph from this device").setInputFiles({
    name: "synthetic-family-photo.png",
    mimeType: "image/png",
    buffer: syntheticPng
  });
  await page.getByRole("button", { name: "Use this photo anyway" }).click();
  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." })
  ).toBeVisible();

  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText("Recording your real voice")).toBeVisible();
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Does this sound like the story you meant to keep?"
    })
  ).toBeVisible();

  await page.getByRole("button", { name: "Keep this recording" }).click();
  await expect(
    page.getByRole("heading", { name: "Your originals are safely backed up." })
  ).toBeVisible();
  await expect(page.getByText("Playing the preserved original")).toBeVisible();
  await expect(page.getByText(/This memory is now part/i)).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your originals are safely backed up." })
  ).toBeVisible();
  await expect(page.getByText("Private originals confirmed")).toBeVisible();
});

test("capture entry remains keyboard reachable at a phone viewport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Capture Your Memories" }).click();

  const heading = page.getByRole("heading", {
    name: "Bring the photograph into the light."
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Open camera" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Import a photo instead" })
  ).toBeFocused();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});
