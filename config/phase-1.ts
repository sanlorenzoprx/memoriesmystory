const mebibyte = 1024 * 1024;

export const phase1Config = {
  entitlements: {
    freeStoryLimit: 5,
    initiallyUnlockedStories: 1,
    freeVoiceSecondsPerStory: 30
  },
  auth: {
    provider: "clerk",
    supportedMethods: ["email", "google", "facebook"],
    sessionLifetimeDays: 30,
    accountOwnershipAgreementVersion: "account-ownership-v1"
  },
  media: {
    maxImageBytes: 25 * mebibyte,
    maxAudioBytes: 25 * mebibyte,
    supportedImageMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif"
    ],
    supportedAudioMimeTypes: [
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg"
    ]
  },
  durability: {
    backgroundRetryDelaysMs: [0, 1_000, 3_000]
  },
  localization: {
    defaultLocale: "en-US",
    supportedLocales: ["en-US", "es-PR", "es-US"],
    fallbackLanguages: ["en", "es"]
  },
  retention: {
    policyStatus: "requires_legal_approval",
    guestDraftRetentionDays: null,
    completedStoryRecoveryDays: null
  },
  ai: {
    modelConfigVersion: "phase1-unselected-v1",
    transcriptionModelId: null,
    museModelId: null,
    musePromptVersion: "pending-packet-5"
  },
  sharing: {
    defaultStoryVisibility: "private",
    tokenLifetimeDays: null,
    tokenPolicyStatus: "requires_security_review",
    revocable: true
  }
} as const;

export type Phase1Config = typeof phase1Config;

export function localeFallbackChain(locale: string): string[] {
  const normalized = locale.trim();

  if (!normalized) {
    return [phase1Config.localization.defaultLocale, "en"];
  }

  const language = normalized.split("-")[0]?.toLowerCase();
  const chain = [normalized];

  if (language && language !== normalized.toLowerCase()) {
    chain.push(language);
  }

  if (language !== "en") {
    chain.push(phase1Config.localization.defaultLocale, "en");
  }

  return [...new Set(chain)];
}
