export type OfferId = "chapter" | "life" | "family";

export type LivingMemoryOffer = {
  id: OfferId;
  name: string;
  price: number;
  priceLabel: string;
  outcome: string;
  shortDescription: string;
  primaryBenefits: string[];
  expandedBenefits: string[];
  includesMemoryCircle: boolean;
};

export const livingMemoryOffers: Record<OfferId, LivingMemoryOffer> = {
  chapter: {
    id: "chapter",
    name: "Chapter",
    price: 247,
    priceLabel: "$247",
    outcome: "Preserve a meaningful chapter.",
    shortDescription:
      "Keep a season of life together through photographs, real voices, and the stories behind them.",
    primaryBenefits: [
      "Up to 25 Living Memories",
      "Up to 10 minutes of voice for each memory",
      "Transcription and Muse help",
      "One private Chapter with simple organization",
      "Family sharing and archive export as each capability is validated"
    ],
    expandedBenefits: [
      "Original photo and voice stay connected",
      "Names, places, dates, and notes can be added",
      "Basic family contributions",
      "Private-first archive",
      "Cross-device continuation"
    ],
    includesMemoryCircle: false
  },
  life: {
    id: "life",
    name: "Life",
    price: 747,
    priceLabel: "$747",
    outcome: "Preserve the stories that made a life.",
    shortDescription:
      "Bring many chapters together and invite the people who remember them to help tell the fuller story.",
    primaryBenefits: [
      "Up to 100 Living Memories",
      "Multiple Chapters",
      "Expanded family contributions",
      "Live Memory Circle",
      "Life Story direction based on the real memories"
    ],
    expandedBenefits: [
      "Everything in Chapter at a larger scope",
      "Up to 10 minutes of voice for each memory",
      "Priority support",
      "Private-first archive",
      "Cross-device continuation"
    ],
    includesMemoryCircle: true
  },
  family: {
    id: "family",
    name: "Family",
    price: 1497,
    priceLabel: "$1,497",
    outcome: "Build your family's Living Memory Archive.",
    shortDescription:
      "Connect stories across people, relationships, and generations so the archive can keep growing with the family.",
    primaryBenefits: [
      "Up to 300 Living Memories",
      "Multiple people and Chapters",
      "Family relationships and collaboration",
      "Live Memory Circle",
      "Family-level archive direction"
    ],
    expandedBenefits: [
      "Everything in Life at family scale",
      "Up to 10 minutes of voice for each memory",
      "Priority support",
      "Source-based Life Stories",
      "Long-horizon stewardship direction"
    ],
    includesMemoryCircle: true
  }
};

export function isOfferId(value: string | null | undefined): value is OfferId {
  return value === "chapter" || value === "life" || value === "family";
}
