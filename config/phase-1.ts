const mebibyte = 1024 * 1024;

export const phase1Config = {
  familyContributions: {agreementVersion:"family-contribution-review-v1",maximumPerMemory:100,textCharacters:8000,attributionCharacters:120,maximumRequestBytes:32768,pageSize:10,voiceSeconds:30,voiceBytes:5*mebibyte,photoBytes:15*mebibyte},
  familyAccess: {maximumGrants:200,pageSize:50,memoriesPageSize:10,invitationHours:72,maximumRequestBytes:8192},
  familyPeople: {maximumRecords:1000,maximumMemoryReferences:100,labelCharacters:160,notesCharacters:2000,dateCharacters:120,pageSize:50,historyPageSize:50,maximumRequestBytes:65536},
  familyArchive: {maximumArchives:20,maximumChapters:100,maximumMemoriesPerChapter:500,titleCharacters:160,descriptionCharacters:2000,listingPageSize:10,maximumRequestBytes:65536},
  entitlements: {
    freeStoryLimit: 1,
    initiallyUnlockedStories: 1,
    freeVoiceSecondsPerStory: 30,
    shareRewardEnabled: false,
    // Stated deletion policy (lane L5.2), recorded in the entitlement ledger
    // with every deletion. Current behaviour: deleting a completed memory
    // returns its capacity. Owner decision D1 may change this.
    deletionReturnsCapacity: true,
    deletionPolicyVersion: "deletion-returns-capacity-v1"
  },
  // Per-account daily ceilings on budget-spending operations (lanes L5.4, L7).
  // Far above one person's day; uploads and saves are never counted.
  dailyCeilings: {
    muse: 300,
    muse_speech: 300,
    muse_conversation: 300,
    voice_reply: 100,
    transcription: 40,
    scan: 60,
    call: 20
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
    remoteSourceMaximumBytes: 512 * 1024 * 1024,
    remoteRecordingDailyLimit: 3,
    remotePreservationRetryLimit: 12,
    remoteTokenLifetimeSeconds: 900,
    inviteLifetimeHours: 24,
    guestAccessDays: 7,
    maxNameCharacters: 60,
    maxRecordingSeconds: 600,
    recordingUploadHours: 24,
    recordingChunkMs: 1000,
    maxSpeakerNoteCharacters: 2000,
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
