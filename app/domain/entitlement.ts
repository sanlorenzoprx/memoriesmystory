import { phase1Config } from "../../config/phase-1";
import type { UserId } from "./ids";

export type StoryEntitlement = {
  readonly userId: UserId;
  readonly plan: "free";
  readonly freeStoryLimit: number;
  /** Available free capacity; set at account creation and never changed by sharing. */
  readonly freeStoriesUnlocked: number;
  readonly freeStoriesCompleted: number;
  readonly updatedAt: string;
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
