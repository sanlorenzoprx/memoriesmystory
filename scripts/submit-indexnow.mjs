import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "a236e00b54d2b2c8359eca238446531f";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const rawOrigin = process.env.MEMORIES_PUBLIC_ORIGIN?.trim();
const dryRun = process.argv.includes("--dry-run");

if (!rawOrigin) {
  throw new Error("Set MEMORIES_PUBLIC_ORIGIN to the authorized public https origin before IndexNow submission.");
}
const origin = new URL(rawOrigin);
if (origin.protocol !== "https:" || origin.pathname !== "/") {
  throw new Error("MEMORIES_PUBLIC_ORIGIN must be an https origin with no path.");
}
const siteOrigin = origin.origin;
const intents = JSON.parse(await fs.readFile(path.join(ROOT, "config", "functional-discovery-intents.json"), "utf8"));
const urls = [
  `${siteOrigin}/`,
  `${siteOrigin}/llms.txt`,
  `${siteOrigin}/llms-full.txt`,
  `${siteOrigin}/openapi.json`,
  `${siteOrigin}/agent/index.md`,
  `${siteOrigin}/agent/capabilities.md`,
  `${siteOrigin}/agent/evidence.md`,
  `${siteOrigin}/agent/privacy.md`,
  ...intents.flatMap(intent => [`${siteOrigin}/${intent.slug}`, `${siteOrigin}/${intent.slug}.md`])
];
const payload = {
  host: origin.host,
  key: KEY,
  keyLocation: `${siteOrigin}/${KEY}.txt`,
  urlList: urls
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload)
});

if (![200, 202].includes(response.status)) {
  const body = await response.text().catch(() => "");
  throw new Error(`IndexNow submission failed HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`);
}

console.log(`IndexNow accepted ${urls.length} Memories URLs with HTTP ${response.status}.`);
