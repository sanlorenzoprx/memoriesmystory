const mebibyte = 1024 * 1024;

export const phase1Config = {
  entitlements: {
    freeStoryLimit: 1,
    initiallyUnlockedStories: 1,
    freeVoiceSecondsPerStory: 30,
    shareRewardEnabled: false
  },
  auth: {
    provider: "clerk",
    supportedMethods: ["email", "google"],
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
  capture: {
    previewWidth: 4096,
    previewHeight: 3072,
    preferredShortestEdge: 1800,
    videoJpegQuality: 0.98,
    steadyShots: 3,
    steadyDelayMs: 200,
    shutterDelayMs: 1500,
    stillRequestTimeoutMs: 8_000
  },
  legacy: {
    inviteLifetimeHours: 24,
    guestAccessDays: 7,
    maxNameCharacters: 60,
    maxRecordingSeconds: 600,
    pollIntervalMs: 1500
  },
  scans: {
    maxDecodedPixels: 48_000_000,
    maxEdge: 3072,
    maxPixels: 6_000_000,
    jpegQuality: 0.95
  },
  review: {
    maxTranscriptCharacters: 12_000,
    maxContextCharacters: 1_200,
    historyPageSize: 10
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
    modelConfigVersion: "living-memory-proof-v2",
    transcriptionProvider: "elevenlabs",
    transcriptionModelId: "scribe_v2",
    transcriptionEndpoint: "https://api.elevenlabs.io/v1/speech-to-text",
    museModelId: "@cf/meta/llama-3.1-8b-instruct-fast",
    musePromptVersion: "remembering-companion-v1",
    museConversationPromptVersion: "story-elicitor-v1",
    museTtsProvider: "elevenlabs",
    museTtsModelId: "eleven_multilingual_v2",
    museTtsOutputFormat: "mp3_44100_128",
    maxMuseQuestionsPerProof: 1
  },
  sharing: {
    defaultStoryVisibility: "private",
    tokenLifetimeDays: null,
    tokenPolicyStatus: "requires_security_review",
    revocable: true,
    rewardUnlocks: false,
    primaryPublicTarget: "facebook",
    primaryFamilyTarget: "whatsapp",
    requireShareArtifactPreview: true,
    includePrivateArchiveMetadataByDefault: false
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
