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

/**
 * Plans and the entitlement ledger (lane L5.2). Until owner decision D1 sets
 * prices, there is one plan: one free Living Memory, with no price shown.
 * Sharing never adds capacity (Share Policy V2).
 */
export const plans = {
  free: {
    livingMemories: phase1Config.entitlements.freeStoryLimit,
    priceShown: false,
  },
} as const;
export type PlanName = keyof typeof plans;

export type LedgerEntry = {
  entry_kind: "grant" | "memory_completed" | "memory_deleted_capacity_returned" | "memory_deleted_capacity_kept";
  granted: number;
  used_delta: number;
};

/**
 * What a person's ledger adds up to. The latest grant is the allowance; uses
 * and returned deletions add up to what is in use.
 */
export function summarizeLedger(entries: readonly LedgerEntry[]) {
  const grants = entries.filter((entry) => entry.entry_kind === "grant"),
    granted = grants.length ? grants[grants.length - 1]!.granted : 0,
    used = Math.max(0, entries.reduce((sum, entry) => sum + entry.used_delta, 0));
  return { granted, used, remaining: Math.max(0, granted - used) };
}
