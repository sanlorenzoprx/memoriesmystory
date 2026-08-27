export const firstExperienceContent = {
  eyebrow: "A photograph can open a whole world",
  headline: "Old photographs fade. The voices behind them should not.",
  supporting:
    "Capture a photo. Tell its story. Preserve your voice for the people you love.",
  primaryAction: "Capture Your Memories",
  secondaryAction: "Import a photo",
  photoPrompt: "Hold a photograph here",
  photoGuidance: "We’ll help you find the best light.",
  privacyPromise: "Nothing is shared unless you choose.",
  journey: ["Photo", "Voice", "Preserved", "Shared"]
} as const;

export type FirstExperienceContent = typeof firstExperienceContent;
