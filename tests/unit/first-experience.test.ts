import { describe, expect, it } from "vitest";

import { firstExperienceContent } from "../../app/features/first-experience/content";

describe("first experience contract", () => {
  it("uses the approved loving-urgency copy and actions", () => {
    expect(firstExperienceContent.headline).toBe(
      "Let them hear the story only you can tell."
    );
    expect(firstExperienceContent.supporting).toBe(
      "Tell it in your own voice—so the people you love can remember more than the photograph."
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
