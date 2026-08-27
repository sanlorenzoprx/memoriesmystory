import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

interface Intent {
  slug: string;
  title: string;
  headline: string;
  description: string;
  intent: string;
  relationship: string;
  themes: string[];
  sampleQuestions: string[];
}

const root = process.cwd();
const intents = JSON.parse(fs.readFileSync(path.join(root, "config", "functional-discovery-intents.json"), "utf8")) as Intent[];
const generator = fs.readFileSync(path.join(root, "scripts", "generate-functional-discovery-pages.mjs"), "utf8");
const discoveryRoutes = fs.readFileSync(path.join(root, "worker", "discovery-routes.ts"), "utf8");

const expectedSlugs = [
  "questions-to-ask-your-mother",
  "questions-to-ask-your-father",
  "questions-to-ask-your-grandmother",
  "questions-to-ask-your-grandfather",
  "questions-to-ask-aging-parents",
  "family-oral-history",
  "preserving-a-parents-voice",
  "stories-behind-old-photographs",
  "family-recipe-stories",
  "family-reunion-questions"
];

describe("Functional Discovery Surface 01", () => {
  it("defines exactly ten distinct family-story utility doors", () => {
    expect(intents).toHaveLength(10);
    expect(intents.map(intent => intent.slug)).toEqual(expectedSlugs);
    expect(new Set(intents.map(intent => intent.slug)).size).toBe(10);
    for (const intent of intents) {
      expect(intent.description.length).toBeGreaterThan(90);
      expect(intent.themes.length).toBeGreaterThanOrEqual(3);
      expect(intent.sampleQuestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("routes every utility through the existing public Legacy Story Starter", () => {
    expect(generator).toContain("/api/v1/legacy-story-starter");
    expect(generator).toContain("web-intent:");
    expect(generator).toContain("protocol: 'search'");
    expect(generator).toContain("start_living_memory_url");
    expect(generator).not.toContain("/api/media");
    expect(generator).not.toContain("/api/archive");
  });

  it("keeps the public utility privacy boundary explicit", () => {
    expect(generator).toContain("does not read or create a private Memory Story");
    expect(generator).toContain("No invented family history");
    expect(generator).not.toContain("photo_context:");
  });

  it("indexes every utility through the host-neutral sitemap and crawler rules", () => {
    for (const slug of expectedSlugs) expect(discoveryRoutes).toContain(`/${slug}`);
    expect(discoveryRoutes).toContain("User-agent: OAI-SearchBot");
    expect(discoveryRoutes).toContain("ChatGPT-User");
  });

  it("emits Story Studio route templates instead of generic homepage links", () => {
    expect(generator).toContain("storyStudioPathTemplate");
    expect(generator).toContain("source=story-studio");
    expect(generator).toContain("campaign=functional-discovery-01");
    expect(generator).toContain("creative_id={creative_id}");
  });
});
