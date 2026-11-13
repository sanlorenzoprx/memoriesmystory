import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
async function local(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("memoriesmystory-local", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<{
      id: string;
      draftToken: string;
      photo: { sha256: string; blob: Blob };
      scan?: {
        sha256: string;
        sourceSha256: string;
        blob: Blob;
        upload: { status: string; assetId: string };
      };
    }>((resolve, reject) => {
      const request = db
        .transaction("memory-story-drafts")
        .objectStore("memory-story-drafts")
        .get(location.pathname.split("/")[2]!);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const hash = async (blob: Blob) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
    return {
      id: value.id,
      token: value.draftToken,
      photoHash: await hash(value.photo.blob),
      recordedPhotoHash: value.photo.sha256,
      scan: value.scan
        ? {
            hash: await hash(value.scan.blob),
            source: value.scan.sourceSha256,
            status: value.scan.upload.status,
            assetId: value.scan.upload.assetId,
          }
        : null,
    };
  });
}
async function prepare(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import a photo", exact: true })
    .click();
  await page
    .getByLabel("Choose a photograph from this device")
    .setInputFiles(
      join(process.cwd(), "tests/fixtures/synthetic-family-photo.png"),
    );
  await expect(
    page.getByRole("heading", {
      name: "Does the photograph feel clear enough?",
    }),
  ).toBeVisible();
}

test("separate scan survives reload, backs up privately, and leaves original bytes unchanged", async ({
  page,
}) => {
  await prepare(page);
  const source = await local(page);
  await page
    .getByRole("button", { name: "Straighten a separate copy", exact: true })
    .click();
  const corner = page.getByRole("button", {
    name: "Top left corner",
    exact: true,
  });
  await corner.focus();
  await page.keyboard.press("ArrowRight");
  await page
    .getByRole("button", { name: "Preview corrected scan", exact: true })
    .click();
  await expect(
    page.getByAltText("Preview of the separate corrected scan"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rotate scan clockwise", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Keep this separate scan", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Keep this separate scan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Adjust separate scan", exact: true }),
  ).toBeVisible();
  const kept = await local(page);
  expect(kept.photoHash).toBe(source.photoHash);
  expect(kept.scan?.source).toBe(source.photoHash);
  expect(kept.scan?.hash).not.toBe(source.photoHash);
  await page.reload();
  expect((await local(page)).scan?.hash).toBe(kept.scan?.hash);
  await page.getByRole("button", { name: /Use this photo/ }).click();
  await page.getByText("Separate corrected scan", { exact: true }).click();
  await expect(
    page.getByText(
      "Your corrected scan is backed up separately. The original is unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  const backed = await local(page);
  const response = await page.request.get(
    `/resources/drafts/${backed.id}/scans`,
    { headers: { "X-Draft-Token": backed.token } },
  );
  expect(response.status()).toBe(200);
  const list = await response.json();
  expect(list.scans).toHaveLength(1);
  expect(list.scans[0].transform.rotation).toBe(90);
  expect(list.scans[0].sourceSha256).toBe(source.photoHash);
  const media = await page.request.get(list.scans[0].mediaUrl, {
    headers: { "X-Draft-Token": backed.token },
  });
  expect(media.status()).toBe(200);
  expect(media.headers()["x-content-sha256"]).toBe(kept.scan?.hash);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete this draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Capture Your Memories" }),
  ).toBeVisible();
  expect(
    (
      await page.request.get(list.scans[0].mediaUrl, {
        headers: { "X-Draft-Token": backed.token },
      })
    ).status(),
  ).toBe(404);
});

test("Spanish corner selection is optional and crossing corners keeps the original recoverable", async ({
  page,
}) => {
  await prepare(page);
  const source = await local(page);
  await page
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("es-PR");
  await page
    .getByRole("button", { name: "Enderezar una copia aparte", exact: true })
    .click();
  await page
    .getByText("Ajustar las esquinas con controles deslizantes", {
      exact: true,
    })
    .click();
  const sliders = page.getByRole("slider");
  await sliders.nth(0).fill("100");
  await sliders.nth(1).fill("100");
  await page
    .getByRole("button", { name: "Ver el escaneo corregido", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("sin cruzar");
  expect((await local(page)).photoHash).toBe(source.photoHash);
  await page
    .getByRole("button", { name: "Conservar solo el original", exact: true })
    .click();
  await page.getByRole("button", { name: /Usar esta foto/ }).click();
  await expect(
    page.getByRole("heading", { name: "Cuenta la historia que recuerdas." }),
  ).toBeVisible();
  expect((await local(page)).scan).toBeNull();
});

test("changing an accepted photograph starts a new source scope and keeps the earlier capture recoverable", async ({
  page,
}) => {
  await prepare(page);
  const earlier = await local(page);
  const address = page.url();
  await page.getByRole("button", { name: /Use this photo/ }).click();
  await page
    .getByRole("button", { name: "Change photograph", exact: true })
    .click();
  await expect(page).not.toHaveURL(address);
  await expect(
    page.getByRole("heading", {
      name: "Choose the photograph that brings the story back.",
    }),
  ).toBeVisible();
  await page.goto(address);
  await expect(
    page.getByRole("heading", { name: "Tell the story you remember." }),
  ).toBeVisible();
  expect((await local(page)).photoHash).toBe(earlier.photoHash);
});

test("quarter-turn correction puts known source colors in the expected scan corners",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Import a photo",exact:true}).click();
  const png=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");canvas.width=640;canvas.height=480;const ctx=canvas.getContext("2d")!;
    for(const [color,x,y] of [["#ff0000",0,0],["#00ff00",320,0],["#0000ff",320,240],["#ffff00",0,240]] as const){ctx.fillStyle=color;ctx.fillRect(x,y,320,240);}
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page.getByLabel("Choose a photograph from this device").setInputFiles({name:"synthetic-color-corners.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await page.getByRole("button",{name:"Straighten a separate copy",exact:true}).click();await page.getByRole("button",{name:"Preview corrected scan",exact:true}).click();
  await expect(page.getByAltText("Preview of the separate corrected scan")).toBeVisible();
  await page.getByRole("button",{name:"Rotate scan clockwise",exact:true}).click();await expect(page.getByRole("button",{name:"Keep this separate scan",exact:true})).toBeEnabled();
  const colors=await page.getByAltText("Preview of the separate corrected scan").evaluate(async(element)=>{
    const image=element as HTMLImageElement;await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d")!;ctx.drawImage(image,0,0);
    return [[10,10],[canvas.width-11,10],[canvas.width-11,canvas.height-11],[10,canvas.height-11]].map(([x,y])=>Array.from(ctx.getImageData(x!,y!,1,1).data).slice(0,3));
  });
  for(const [actual,expected] of colors.map((color,i)=>[color,[[255,255,0],[255,0,0],[0,255,0],[0,0,255]][i]!] as const))for(let c=0;c<3;c++)expect(Math.abs(actual[c]!-expected[c]!)).toBeLessThan(35);
});
