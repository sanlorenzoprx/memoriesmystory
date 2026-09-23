export const firstExperienceContent = {
  eyebrow: "A photograph can hold a lifetime",
  headline: "Let them hear the story only you can tell.",
  supporting:
    "Tell it in your own voice—so the people you love can remember more than the photograph.",
  primaryAction: "Capture Your Memories",
  secondaryAction: "Import a photo",
  photoPrompt: "Hold a photograph here",
  photoGuidance: "We’ll help you find the best light.",
  privacyPromise: "Nothing is shared unless you choose.",
  journey: ["Photo", "Voice", "Preserved", "Shared"]
} as const;

export type FirstExperienceContent = typeof firstExperienceContent;
