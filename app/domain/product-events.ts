import type { LivingMemoryId, UserId } from "./ids";

export const productEventNames = [
  "first_living_memory_started",
  "first_living_memory_completed",
  "living_memory_share_prompt_viewed",
  "living_memory_share_started",
  "living_memory_share_artifact_created",
  "living_memory_share_opened",
  "living_memory_referred_visitor",
  "referred_first_living_memory_started",
  "referred_first_living_memory_completed"
] as const;

export type ProductEventName = (typeof productEventNames)[number];

export type ShareChannel =
  | "facebook"
  | "whatsapp"
  | "instagram"
  | "native"
  | "copy_link"
  | "sms"
  | "email"
  | "other";

export type ProductEvent = {
  readonly name: ProductEventName;
  readonly occurredAt: string;
  readonly userId: UserId | null;
  readonly livingMemoryId: LivingMemoryId | null;
  readonly sessionId: string | null;
  readonly referralId: string | null;
  readonly shareChannel: ShareChannel | null;
};

export function isActivationEvent(event: ProductEvent): boolean {
  return event.name === "first_living_memory_completed";
}
