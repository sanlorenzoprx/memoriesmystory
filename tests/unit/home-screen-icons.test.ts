import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(publicFile(path));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

type ManifestIcon = { src: string; sizes: string; type: string; purpose: string };

describe("home-screen install icons", () => {
  const manifest = JSON.parse(readFileSync(publicFile("/manifest.webmanifest"), "utf8")) as {
    short_name: string;
    icons: ManifestIcon[];
  };

  it("labels the home-screen icon with the customer brand, not the technical identifier", () => {
    expect(manifest.short_name).not.toBe("memoriesmystory");
  });

  it("offers Android the PNG sizes it needs, including a maskable icon", () => {
    const pngs = manifest.icons.filter((icon) => icon.type === "image/png");
    expect(pngs.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(pngs.some((icon) => icon.purpose === "maskable")).toBe(true);

    for (const icon of manifest.icons) {
      expect(existsSync(publicFile(icon.src))).toBe(true);
      if (icon.type === "image/png") {
        const [width, height] = icon.sizes.split("x").map(Number);
        expect(pngSize(icon.src)).toEqual({ width, height });
      }
    }
  });

  it("gives iPhone a 180px apple-touch-icon", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const href = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html)?.[1];

    expect(href).toBe("/icons/apple-touch-icon.png");
    expect(pngSize(href!)).toEqual({ width: 180, height: 180 });
  });
});
