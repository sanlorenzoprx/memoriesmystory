import { describe, expect, it } from "vitest";

import { firstExperienceContent } from "../../app/features/first-experience/content";

describe("first experience contract", () => {
  it("uses the approved loving-urgency copy and actions", () => {
    expect(firstExperienceContent.headline).toBe(
      "Old photographs fade. The voices behind them should not."
    );
    expect(firstExperienceContent.supporting).toBe(
      "You do not have to organize a lifetime. Start with one photograph, tell the story it brings back, and keep your real voice with it—so the people you love can receive more than an image."
    );
    expect(firstExperienceContent.primaryAction).toBe("Capture Your Memories");
    expect(firstExperienceContent.secondaryAction).toBe("Import a photo");
  });

  it("keeps the first-screen journey emotional and free of Muse language", () => {
    expect(firstExperienceContent.journey).toEqual([
      "Photo",
      "Voice",
      "Preserved",
      "Shared"
    ]);
    expect(JSON.stringify(firstExperienceContent)).not.toMatch(/Muse|AI|truthful save/i);
  });
});
