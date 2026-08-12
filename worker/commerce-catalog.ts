export type CommerceOfferId = "chapter" | "life" | "family";

export type CommerceCatalogEnv = {
  readonly STRIPE_CHAPTER_PRICE_ID?: string;
  readonly STRIPE_LIFE_PRICE_ID?: string;
  readonly STRIPE_FAMILY_PRICE_ID?: string;
};

export type CommerceOffer = {
  readonly id: CommerceOfferId;
  readonly name: "Chapter" | "Life" | "Family";
  readonly amountTotal: 24700 | 74700 | 149700;
  readonly currency: "usd";
  readonly livingMemoryLimit: 25 | 100 | 300;
  readonly voiceSecondsPerMemory: 600;
  readonly memoryCircleEnabled: boolean;
  readonly familyArchiveLevel: CommerceOfferId;
};

export const commerceOffers: Record<CommerceOfferId, CommerceOffer> = {
  chapter: {
    id: "chapter",
    name: "Chapter",
    amountTotal: 24700,
    currency: "usd",
    livingMemoryLimit: 25,
    voiceSecondsPerMemory: 600,
    memoryCircleEnabled: false,
    familyArchiveLevel: "chapter"
  },
  life: {
    id: "life",
    name: "Life",
    amountTotal: 74700,
    currency: "usd",
    livingMemoryLimit: 100,
    voiceSecondsPerMemory: 600,
    memoryCircleEnabled: true,
    familyArchiveLevel: "life"
  },
  family: {
    id: "family",
    name: "Family",
    amountTotal: 149700,
    currency: "usd",
    livingMemoryLimit: 300,
    voiceSecondsPerMemory: 600,
    memoryCircleEnabled: true,
    familyArchiveLevel: "family"
  }
};

export function isCommerceOfferId(value: unknown): value is CommerceOfferId {
  return value === "chapter" || value === "life" || value === "family";
}

export function stripePriceIdForOffer(env: CommerceCatalogEnv, offerId: CommerceOfferId): string {
  const priceId = offerId === "chapter"
    ? env.STRIPE_CHAPTER_PRICE_ID
    : offerId === "life"
      ? env.STRIPE_LIFE_PRICE_ID
      : env.STRIPE_FAMILY_PRICE_ID;

  if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) {
    throw new Error(`Stripe price configuration is missing for ${offerId}.`);
  }
  return priceId;
}
