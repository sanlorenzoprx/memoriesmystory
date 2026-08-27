import { describe, expect, it } from "vitest";
import { buildStoryStarter } from "../../app/services/agent/story-starter";
import { buildInterviewPlan } from "../../app/services/agent/interview-plan";
import { buildPhotoStoryPrompts } from "../../app/services/agent/photo-story-prompts";

const options = { id: "starter-test", publicOrigin: "https://memories.example" };

describe("ASC-01 deterministic Story Starter", () => {
  it("returns bounded prompts and a human-action start URL without inventing relationship facts", () => {
    const result = buildStoryStarter({
      relationship: "grandmother named Ana who grew up in Ponce",
      occasion: "family reunion",
      themes: ["childhood", "family traditions"],
      language: "en",
      prompt_count: 8
    }, options);

    expect(result.questions).toHaveLength(8);
    expect(result.start_living_memory_url).toBe("https://memories.example/?source=agent&starter_id=starter-test");
    const output = JSON.stringify(result).toLowerCase();
    expect(output).not.toContain("ana");
    expect(output).not.toContain("ponce");
    expect(result.capture_tip).toContain("real voice");
  });

  it("supports Spanish with uncertainty-friendly photo prompts", () => {
    const result = buildStoryStarter({
      themes: ["old photographs", "recipes"],
      language: "es",
      prompt_count: 6
    }, options);

    expect(result.questions).toHaveLength(6);
    expect(result.opening_question).toMatch(/recuerdo/i);
    expect(result.photo_prompts.some(prompt => /si lo recuerdas/i.test(prompt))).toBe(true);
  });

  it("reuses the Story Starter capability for interview plans", () => {
    const starter = buildStoryStarter({ themes: ["legacy"], prompt_count: 6 }, options);
    const plan = buildInterviewPlan({ themes: ["legacy"], prompt_count: 6 }, options);
    expect(plan.sections.flatMap(section => section.questions)).toEqual(starter.questions);
    expect(plan.start_living_memory_url).toBe(starter.start_living_memory_url);
  });

  it("does not inspect or echo caller photo context into generated testimony", () => {
    const result = buildPhotoStoryPrompts({
      photo_context: "This is definitely Ana and Carlos marrying in Ponce in 1953",
      relationship: "mother",
      language: "en",
      prompt_count: 4
    }, options);
    const output = JSON.stringify(result).toLowerCase();
    expect(output).not.toContain("ana");
    expect(output).not.toContain("carlos");
    expect(output).not.toContain("1953");
    expect(output).not.toContain("definitely");
  });
});
