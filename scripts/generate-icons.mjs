// Renders the home-screen PNG icons from the SVG sources in public/.
// iPhone ignores SVG home-screen icons, and Android needs 192/512 PNGs to
// offer "Install app". Re-run after changing either SVG:
//   node scripts/generate-icons.mjs
// Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium binary.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const rounded = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
// Full-bleed square: iOS and Android maskable icons apply their own corner
// shape, and transparent corners would render black on iPhone.
const fullBleed = readFileSync(new URL("../public/icons/icon-full-bleed.svg", import.meta.url), "utf8");

const outputs = [
  { file: "apple-touch-icon.png", size: 180, svg: fullBleed },
  { file: "icon-192.png", size: 192, svg: rounded },
  { file: "icon-512.png", size: 512, svg: rounded },
  { file: "icon-maskable-512.png", size: 512, svg: fullBleed }
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined
});
try {
  for (const { file, size, svg } of outputs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
    await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${sized}`);
    await page.locator("svg").screenshot({
      path: new URL(`../public/icons/${file}`, import.meta.url).pathname,
      omitBackground: true
    });
    await page.close();
    console.log(`public/icons/${file} ${size}x${size}`);
  }
} finally {
  await browser.close();
}
