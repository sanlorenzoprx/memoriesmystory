import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = join(process.cwd(), "tests/fixtures/synthetic-family-photo.png");

async function original(page: Page) {
  return page.evaluate(async () => {
    const draft = await new Promise<{ photo: { blob: Blob; sha256: string; capture?: { method: string; orientation: string }; inspection: { width: number; height: number } } }>((resolve, reject) => {
      const open = indexedDB.open("memoriesmystory-local", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const read = db.transaction("memory-story-drafts").objectStore("memory-story-drafts").getAll();
        read.onsuccess = () => { resolve(read.result[0]); db.close(); };
        read.onerror = () => { reject(read.error); db.close(); };
      };
    });
    if (!draft.photo) return null;
    const digest = await crypto.subtle.digest("SHA-256", await draft.photo.blob.arrayBuffer());
    return {
      digest: Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(""),
      recordedHash: draft.photo.sha256, capture: draft.photo.capture, inspection: draft.photo.inspection
    };
  });
}

async function installStill(page: Page, delayed = false) {
  await page.addInitScript((waitForRelease) => {
    type State = { nativeHash: string; settings: unknown; takeCalls: number; releaseStill?: () => void };
    const state = { takeCalls: 0 } as State;
    Object.assign(window, { archivalTest: state });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 480;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#d9c3a8"; context.fillRect(0, 0, 640, 480);
        return canvas.captureStream(1);
      }
    } });
    Object.defineProperty(globalThis, "ImageCapture", { configurable: true, value: class {
      async getPhotoCapabilities() { return { imageWidth: { max: 2400 }, imageHeight: { max: 1800 } }; }
      async takePhoto(settings: unknown) {
        state.settings = settings; state.takeCalls += 1;
        const canvas = document.createElement("canvas"); canvas.width = 2400; canvas.height = 1800;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#ba9673"; context.fillRect(0, 0, 2400, 1800);
        context.fillStyle = "#423025"; context.fillRect(300, 200, 1500, 1000);
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/png"));
        const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
        state.nativeHash = Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
        if (waitForRelease) await new Promise<void>((resolve) => { state.releaseStill = resolve; });
        return blob;
      }
    } });
  }, delayed);
}

async function openGuidedCamera(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Capture Your Memories", exact: true }).click();
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.getByLabel("Live camera preview")).toBeVisible();
}

test("native still bytes and dimensions survive review and reload without preview resizing", async ({ page }) => {
  await installStill(page);
  await openGuidedCamera(page);
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Does the photograph feel clear enough?" })).toBeVisible();
  const before = await original(page);
  const native = await page.evaluate(() => (window as unknown as { archivalTest: { nativeHash: string; settings: unknown; takeCalls: number } }).archivalTest);
  expect(before?.digest).toBe(native.nativeHash);
  expect(before?.recordedHash).toBe(native.nativeHash);
  expect(before?.inspection).toMatchObject({ width: 2400, height: 1800 });
  expect(before?.capture).toMatchObject({ method: "image_capture", orientation: "landscape" });
  expect(native.settings).toEqual({ imageWidth: 2400, imageHeight: 1800 });
  expect(native.takeCalls).toBe(1);
  await expect(page.getByText("Your original photograph is kept unchanged. Any corrected scan will be a separate copy.")).toBeVisible();
  await page.reload();
  expect(await original(page)).toEqual(before);
});

test("canceling a pending still never lets its late result overwrite a selected import", async ({ page }) => {
  await installStill(page, true);
  await openGuidedCamera(page);
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Taking photo…", exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { archivalTest: { releaseStill?: () => void } }).archivalTest.releaseStill)).toBe("function");
  await page.getByRole("button", { name: "Cancel camera", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open camera", exact: true })).toBeEnabled();
  await page.getByLabel("Choose a photograph from this device").setInputFiles(fixture);
  await expect(page.getByRole("heading", { name: "Does the photograph feel clear enough?" })).toBeVisible();
  const selected = await original(page);
  await page.evaluate(() => (window as unknown as { archivalTest: { releaseStill: () => void } }).archivalTest.releaseStill());
  await expect.poll(() => original(page)).toEqual(selected);
  expect(selected?.capture?.method).toBe("file_import");
  await page.reload();
  expect(await original(page)).toEqual(selected);
});

test("device-camera picker is available after denial and preserves the chosen file in Spanish", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } } });
    Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => { throw new Error("Decode through the image element instead"); } });
  });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("es-PR");
  await page.getByRole("button", { name: "Captura tus recuerdos", exact: true }).click();
  await page.getByRole("button", { name: "Abrir cámara", exact: true }).click();
  await expect(page.getByRole("button", { name: "Usar la cámara del dispositivo", exact: true })).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Usar la cámara del dispositivo", exact: true }).click();
  const fileChooser = await chooser;
  await expect(page.getByLabel("Tomar una foto con este dispositivo")).toHaveAttribute("capture", "environment");
  await fileChooser.setFiles(fixture);
  await expect(page.getByRole("heading", { name: "¿La fotografía se ve lo bastante clara?" })).toBeVisible();
  expect((await original(page))?.capture?.method).toBe("device_picker");
  await page.getByRole("button", { name: /Usar esta foto/ }).click();
  await expect(page.getByRole("heading", { name: "Cuenta la historia que recuerdas." })).toBeVisible();
});

test("canceling pending permission stops a camera granted after cancellation", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: () => new Promise<MediaStream>((resolve) => {
        const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 960;
        const stream = canvas.captureStream(1);
        Object.assign(window, { lateCamera: stream, allowCamera: () => resolve(stream) });
      })
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Capture Your Memories", exact: true }).click();
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await page.getByRole("button", { name: "Cancel camera", exact: true }).click();
  await page.evaluate(() => (window as unknown as { allowCamera: () => void }).allowCamera());
  await expect.poll(() => page.evaluate(() => (window as unknown as { lateCamera: MediaStream }).lateCamera.getVideoTracks()[0]?.readyState)).toBe("ended");
  await expect(page.getByRole("heading", { name: "Bring the photograph into the light." })).toBeVisible();
  expect(await original(page)).toBeNull();
});

test("steady photo keeps one untouched candidate after a disclosed three-shot burst",async({page})=>{
  await installStill(page);await openGuidedCamera(page);
  await page.getByRole("checkbox",{name:"Steady photo: take up to three shots and keep the clearest",exact:true}).check();
  await page.getByRole("button",{name:"Take photo",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Does the photograph feel clear enough?"})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {archivalTest:{takeCalls:number}}).archivalTest.takeCalls)).toBe(3);
  const photo=await original(page);expect(photo?.capture).toMatchObject({method:"image_capture",steady:{method:"best-shot-v1",candidates:3,selectedIndex:0}});
});
