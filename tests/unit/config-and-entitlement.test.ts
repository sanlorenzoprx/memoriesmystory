import { describe, expect, it } from "vitest";

import {
  asId,
  canCreateFreeStory,
  createInitialEntitlement,
  grantShareUnlock,
  type UserId
} from "../../app/domain";
import { localeFallbackChain, phase1Config } from "../../config/phase-1";
import { phase1Limits } from "../../config/phase-1-limits";

describe("central Phase 1 configuration", () => {
  it("owns the first-free-Living-Memory and 30-second launch limits", () => {
    expect(phase1Config.entitlements.freeStoryLimit).toBe(1);
    expect(phase1Config.entitlements.freeVoiceSecondsPerStory).toBe(30);
    expect(phase1Config.entitlements.shareRewardEnabled).toBe(false);
    expect(phase1Limits.freeMemoryStoryCount).toBe(phase1Config.entitlements.freeStoryLimit);
  });

  it("keeps sharing private-first and voluntary", () => {
    expect(phase1Config.sharing.defaultStoryVisibility).toBe("private");
    expect(phase1Config.sharing.rewardUnlocks).toBe(false);
    expect(phase1Config.sharing.primaryPublicTarget).toBe("facebook");
    expect(phase1Config.sharing.primaryFamilyTarget).toBe("whatsapp");
    expect(phase1Config.sharing.requireShareArtifactPreview).toBe(true);
    expect(phase1Config.sharing.includePrivateArchiveMetadataByDefault).toBe(false);
  });

  it("does not invent privacy-sensitive retention or provider values", () => {
    expect(phase1Config.retention.policyStatus).toBe("requires_legal_approval");
    expect(phase1Config.retention.guestDraftRetentionDays).toBeNull();
    expect(phase1Config.ai.transcriptionModelId).toBeNull();
    expect(phase1Config.sharing.tokenLifetimeDays).toBeNull();
  });

  it("provides BCP 47 locale fallback without confusing spoken and UI locale", () => {
    expect(localeFallbackChain("es-PR")).toEqual(["es-PR", "es", "en-US", "en"]);
    expect(localeFallbackChain("en-US")).toEqual(["en-US", "en"]);
  });
});

describe("free Living Memory entitlement", () => {
  const userId = asId<UserId>("user-1");
  const now = "2026-08-11T00:00:00.000Z";

  it("starts with one available free Living Memory", () => {
    const entitlement = createInitialEntitlement(userId, now);

    expect(entitlement.freeStoriesUnlocked).toBe(1);
    expect(canCreateFreeStory(entitlement)).toBe(true);
    expect(canCreateFreeStory({ ...entitlement, freeStoriesCompleted: 1 })).toBe(false);
  });

  it("never grants another free Living Memory for sharing", () => {
    const entitlement = createInitialEntitlement(userId, now);
    const result = grantShareUnlock({
      entitlement,
      storyAlreadyGrantedUnlock: false,
      now
    });

    expect(result).toMatchObject({
      granted: false,
      reason: "voluntary_sharing_no_reward",
      entitlement: { freeStoriesUnlocked: 1 }
    });
  });
});
