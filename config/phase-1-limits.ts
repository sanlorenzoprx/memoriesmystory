import { phase1Config } from "./phase-1";

export const phase1Limits = {
  freeMemoryStoryCount: phase1Config.entitlements.freeStoryLimit,
  freeVoiceSecondsPerStory: phase1Config.entitlements.freeVoiceSecondsPerStory
} as const;
