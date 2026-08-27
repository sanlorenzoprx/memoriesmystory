import { describe, expect, it } from "vitest";

import { firstExperienceContent } from "../../app/features/first-experience/content";

describe("first experience contract", () => {
  it("uses the approved loving-urgency copy and actions", () => {
    expect(firstExperienceContent.headline).toBe(
      "Old photographs fade. The voices behind them should not."
    );
    expect(firstExperienceContent.supporting).toBe(
      "Capture a photo. Tell its story. Preserve your voice for the people you love."
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
