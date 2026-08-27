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
  it("owns the five-story and 30-second launch limits", () => {
    expect(phase1Config.entitlements.freeStoryLimit).toBe(5);
    expect(phase1Config.entitlements.freeVoiceSecondsPerStory).toBe(30);
    expect(phase1Limits.freeMemoryStoryCount).toBe(
      phase1Config.entitlements.freeStoryLimit
    );
    expect(phase1Limits.freeVoiceSecondsPerStory).toBe(
      phase1Config.entitlements.freeVoiceSecondsPerStory
    );
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

describe("free Memory Story entitlement", () => {
  const userId = asId<UserId>("user-1");
  const now = "2026-07-16T00:00:00.000Z";

  it("starts with one available free Memory Story", () => {
    const entitlement = createInitialEntitlement(userId, now);

    expect(entitlement.freeStoriesUnlocked).toBe(1);
    expect(canCreateFreeStory(entitlement)).toBe(true);
    expect(canCreateFreeStory({ ...entitlement, freeStoriesCompleted: 1 })).toBe(false);
  });

  it("grants no more than one unlock for a story", () => {
    const entitlement = createInitialEntitlement(userId, now);
    const first = grantShareUnlock({
      entitlement,
      storyAlreadyGrantedUnlock: false,
      now
    });
    const duplicate = grantShareUnlock({
      entitlement: first.entitlement,
      storyAlreadyGrantedUnlock: true,
      now
    });

    expect(first.granted).toBe(true);
    expect(first.entitlement.freeStoriesUnlocked).toBe(2);
    expect(duplicate.granted).toBe(false);
    expect(duplicate.entitlement.freeStoriesUnlocked).toBe(2);
  });

  it("caps the free sequence at five stories", () => {
    const entitlement = {
      ...createInitialEntitlement(userId, now),
      freeStoriesUnlocked: 5,
      freeStoriesCompleted: 5
    };

    expect(
      grantShareUnlock({ entitlement, storyAlreadyGrantedUnlock: false, now })
    ).toMatchObject({ granted: false, reason: "free_limit_reached" });
  });
});
