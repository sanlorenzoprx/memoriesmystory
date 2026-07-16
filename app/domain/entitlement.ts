import { phase1Config } from "../../config/phase-1";
import type { UserId } from "./ids";

export type StoryEntitlement = {
  readonly userId: UserId;
  readonly plan: "free";
  readonly freeStoryLimit: number;
  readonly freeStoriesUnlocked: number;
  readonly freeStoriesCompleted: number;
  readonly updatedAt: string;
};

export type ShareUnlockResult = {
  readonly entitlement: StoryEntitlement;
  readonly granted: boolean;
  readonly reason: "granted" | "already_granted_for_story" | "free_limit_reached";
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

export function grantShareUnlock(input: {
  readonly entitlement: StoryEntitlement;
  readonly storyAlreadyGrantedUnlock: boolean;
  readonly now: string;
}): ShareUnlockResult {
  if (input.storyAlreadyGrantedUnlock) {
    return {
      entitlement: input.entitlement,
      granted: false,
      reason: "already_granted_for_story"
    };
  }

  if (input.entitlement.freeStoriesUnlocked >= input.entitlement.freeStoryLimit) {
    return {
      entitlement: input.entitlement,
      granted: false,
      reason: "free_limit_reached"
    };
  }

  return {
    entitlement: {
      ...input.entitlement,
      freeStoriesUnlocked: input.entitlement.freeStoriesUnlocked + 1,
      updatedAt: input.now
    },
    granted: true,
    reason: "granted"
  };
}
