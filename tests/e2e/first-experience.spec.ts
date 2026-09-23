import { expect, test } from "@playwright/test";

const syntheticPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAIAAAD6wG44AAABuElEQVR42u3cMUpDQRiFUTPMPu1TBNIEKwlWYiNY2NtmIVlEVmNhKQ9FzGT++85Xq+Acri+imc3lfLpTbs0RABZgARZgARZgAQaslPpvPujp+OKk5uzxeLBgP6IFWIAFWHO+iv7e6/ubsxvffruzYAEGLMACLMACLMACDFiABViANbS+hm/y43nxf8ruHw6A01CXPiwSu6+WdukTw5g72mzmjjabudG9yVcGPItBdeNGN9u40c02bnSzjRvdbONGN9vYHxvCa+abPWILtmDzrTxiC7Zgo6k8Ygu2YAEW4MAHXonHsAVbsAALsAALsAALMODZmvMdBiXe92DBFizAApz2wKvyxkMLtmCjKTtfC7ZgI648Xwu2YCOuPN+qC77VKVe8k6Xqj+jxZ130xp3Cz+CRJ173PqXaL7LGnHvp27LKv4q+9ulXvwst4dek6xkE3HQXcpXhl8Q/vtXAXZWxzG6bjWV2X3TVB7Mb38OLVwx/FS3AgAVYgAVYgAVYgAUYsAALsAALsAALMGABFmABFmAB1g/98f+i99uds7NgARZgARbgtba5nE9OwYIFWIAFWIAFWIABK6JPUa93M71fK2YAAAAASUVORK5CYII=",
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
  await expect(page.getByRole("link", { name: "My stories" })).toHaveAttribute("href", "/auth/protect");
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
  await page.getByRole("button", { name: /Use this photo/ }).click();

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

test("an offline photograph never blocks the voice and later backs up in order", async ({
  page
}) => {
  let connectionAvailable = false;
  await page.route("**/resources/drafts/*/photo", (route) => {
    if (connectionAvailable) return route.continue();
    return route.abort("internetdisconnected");
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (!constraints.audio) throw new Error("Synthetic microphone expected");
          const context = new AudioContext();
          await context.resume();
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
  await page.getByRole("button", { name: /Use this photo/ }).click();

  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." })
  ).toBeVisible();
  await page.getByRole("button", { name: "I'm ready to record" }).click();
  await page.waitForTimeout(1250);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("heading", { name: "Does this sound like the story you meant to keep?" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep this recording" }).click();

  await expect(
    page.getByRole("heading", { name: "Your story stays with you." })
  ).toBeVisible();
  await expect(page.getByText(/quietly finish preserving/i)).toBeVisible();

  connectionAvailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("heading", { name: "Your photograph and voice are safe." })).toBeVisible();
  await expect(page.getByText("Your photograph and real voice are safely backed up.")).toBeVisible();
});


test("Muse cues before recording and returns before a rerecord", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "micRequestCount", {
      configurable: true,
      writable: true,
      value: 0
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (!constraints.audio) throw new Error("Synthetic microphone expected");
          const holder = window as unknown as { micRequestCount: number };
          holder.micRequestCount += 1;
          const context = new AudioContext();
          await context.resume();
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
  await page.getByRole("button", { name: /Use this photo/ }).click();

  await expect(page.getByText("Would you like help remembering?", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { micRequestCount: number }).micRequestCount
    )
  ).toBe(0);

  await page.getByRole("button", { name: "Give me a cue" }).click();
  await expect(
    page.getByText("What comes back to you first when you look at this photograph?", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "I'm ready to record" }).click();
  await page.waitForTimeout(1250);
  expect(
    await page.evaluate(
      () => (window as unknown as { micRequestCount: number }).micRequestCount
    )
  ).toBe(1);
  await page.getByRole("button", { name: "Stop recording" }).click();

  await page.getByRole("button", { name: "Record again" }).click();
  await expect(
    page.getByText("Would another cue help before you record again?", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(
      "What detail do you most want to make sure your family hears this time?",
      { exact: true }
    )
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { micRequestCount: number }).micRequestCount
    )
  ).toBe(1);

  await page.getByRole("button", { name: "Record again" }).click();
  await page.waitForTimeout(1250);
  expect(
    await page.evaluate(
      () => (window as unknown as { micRequestCount: number }).micRequestCount
    )
  ).toBe(2);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Does this sound like the story you meant to keep?"
    })
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
          await context.resume();
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
  await page.getByRole("button", { name: /Use this photo/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." })
  ).toBeVisible();

  await page.getByRole("button", { name: "I'm ready to record" }).click();
  await expect(page.getByText("Recording your real voice")).toBeVisible();
  await page.waitForTimeout(1250);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Does this sound like the story you meant to keep?"
    })
  ).toBeVisible();

  await page.getByRole("button", { name: "Keep this recording" }).click();
  await expect(
    page.getByRole("heading", { name: "Your photograph and voice are safe." })
  ).toBeVisible();
  await expect(page.getByText("Playing the preserved original")).toBeVisible();
  await expect(page.getByText(/This memory is now part/i)).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your photograph and voice are safe." })
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
