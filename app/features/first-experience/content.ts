export const firstExperienceContent = {
  eyebrow: "A photograph can open a whole world",
  headline: "Old photographs fade. The voices behind them should not.",
  supporting:
    "You do not have to organize a lifetime. Start with one photograph, tell the story it brings back, and keep your real voice with it—so the people you love can receive more than an image.",
  primaryAction: "Capture Your Memories",
  secondaryAction: "Import a photo",
  photoPrompt: "Hold a photograph here",
  photoGuidance: "We’ll help you get a clear image. The story matters more than perfection.",
  privacyPromise: "Nothing is shared unless you choose.",
  journey: ["Photo", "Voice", "Preserved", "Shared"]
} as const;

export type FirstExperienceContent = typeof firstExperienceContent;
