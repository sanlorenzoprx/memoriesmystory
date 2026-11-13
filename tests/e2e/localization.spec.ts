import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function photoDigest(page: Page) {
  return page.evaluate(async () => {
    const draft = await new Promise<{ photo: { blob: Blob } }>((resolve, reject) => {
      const open = indexedDB.open("memoriesmystory-local", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const read = db.transaction("memory-story-drafts").objectStore("memory-story-drafts").getAll();
        read.onsuccess = () => { resolve(read.result[0]); db.close(); };
        read.onerror = () => { reject(read.error); db.close(); };
      };
    });
    const digest = await crypto.subtle.digest("SHA-256", await draft.photo.blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  });
}

test("Spanish capture survives language changes and reload with the same original photograph", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("es-PR");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-PR");
  await page.getByRole("button", { name: "Importar una foto", exact: true }).click();
  await page.getByLabel("Elige una fotografía de este dispositivo").setInputFiles(join(process.cwd(), "tests/fixtures/synthetic-family-photo.png"));
  await expect(page.getByRole("heading", { name: "¿La fotografía se ve lo bastante clara?" })).toBeVisible();
  const before = await photoDigest(page);
  await page.getByRole("combobox", { name: "Idioma de la interfaz" }).selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Does the photograph feel clear enough?" })).toBeVisible();
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("es-US");
  await page.getByRole("button", { name: /Usar esta foto/ }).click();
  await expect(page.getByRole("heading", { name: "Cuenta la historia que recuerdas." })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es-US");
  await expect(page.getByText("Tu fotografía sigue aquí. Volvimos al mismo paso.")).toBeVisible();
  expect(await photoDigest(page)).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Spanish account entry and archive errors switch without leaking server diagnostics", async ({ page }) => {
  await page.route("**/resources/archive/drafts", (route) => route.fulfill({ status: 401, json: { error: { code: "session_required", message: "Private server diagnostics must stay private" } } }));
  await page.goto("/auth/protect");
  await page.getByRole("combobox", { name: "Interface language" }).selectOption("es-PR");
  await expect(page.getByRole("heading", { name: "Llévala contigo." })).toBeVisible();
  await page.goto("/archive");
  await expect(page.getByRole("alert")).not.toContainText("Private server diagnostics");
  await expect(page.getByRole("alert")).toContainText("sesión");
  await page.getByRole("combobox", { name: "Idioma de la interfaz" }).selectOption("en-US");
  await expect(page.getByRole("alert")).toContainText("Sign in");
});
