import { phase1Config } from "../../config/phase-1";
import type { UserId } from "./ids";

export type StoryEntitlement = {
  readonly userId: UserId;
  readonly plan: "free";
  readonly freeStoryLimit: number;
  /** Compatibility field retained while prior share-to-unlock runtime code is retired. */
  readonly freeStoriesUnlocked: number;
  readonly freeStoriesCompleted: number;
  readonly updatedAt: string;
};

export type ShareUnlockResult = {
  readonly entitlement: StoryEntitlement;
  readonly granted: false;
  readonly reason: "voluntary_sharing_no_reward" | "free_limit_reached";
};

export function createInitialEntitlement(userId: UserId, now: string): StoryEntitlement {
  return {
    userId,
    plan: "free",
    freeStoryLimit: phase1Config.entitlements.freeStoryLimit,
    freeStoriesUnlocked: phase1Config.entitlements.initiallyUnlockedStories,
    freeStoriesCompleted: 0,
    updatedAt: now
  };
}

export function canCreateFreeStory(entitlement: StoryEntitlement): boolean {
  return entitlement.freeStoriesCompleted < entitlement.freeStoriesUnlocked;
}

/**
 * @deprecated Sharing is voluntary and no longer grants a free Living Memory.
 * Retained temporarily so existing callers fail closed without receiving a reward
 * while the share runtime is migrated to product-event tracking.
 */
export function grantShareUnlock(input: {
  readonly entitlement: StoryEntitlement;
  readonly storyAlreadyGrantedUnlock: boolean;
  readonly now: string;
}): ShareUnlockResult {
  void input.storyAlreadyGrantedUnlock;
  void input.now;

  return {
    entitlement: input.entitlement,
    granted: false,
    reason:
      input.entitlement.freeStoriesCompleted >= input.entitlement.freeStoryLimit
        ? "free_limit_reached"
        : "voluntary_sharing_no_reward"
  };
}
