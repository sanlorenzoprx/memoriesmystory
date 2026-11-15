/**
 * A timeline built only from what the storyteller said about when a memory
 * happened. Nothing is inferred: a memory is ordered by a four-digit year only
 * when the storyteller's own words contain one, and their words are always
 * shown unchanged.
 */
export type FamilyTimelineEntry = {
  memoryId: string;
  title: string | null;
  /** The storyteller's current answer about when, exactly as they gave it. */
  when: { text: string; approximate: boolean } | null;
  /** A year the storyteller typed, used only to order entries. Never displayed as a date. */
  orderingYear: number | null;
};

export type FamilyTimelineResponse = {
  entries: FamilyTimelineEntry[];
  /** True when the archive holds more memories than one timeline page shows. */
  truncated: boolean;
};

export const familyTimelineLimits = { maximumEntries: 500 } as const;

/** The first plausible four-digit year the person wrote, or null. "1950s" and "'50" give null. */
export function yearWrittenIn(text: string): number | null {
  for (const match of text.matchAll(/(?<![\d\p{L}])(\d{4})(?![\d\p{L}])/gu)) {
    const year = Number(match[1]);
    if (year >= 1000 && year <= 2999) return year;
  }
  return null;
}

export type FamilyTimelineGroups = {
  /** Ascending by the year the storyteller wrote. */
  dated: { year: number; entries: FamilyTimelineEntry[] }[];
  /** The storyteller said when, without a year we can order by. */
  remembered: FamilyTimelineEntry[];
  /** Unknown, left out, or never asked. */
  unknown: FamilyTimelineEntry[];
};

export function groupTimeline(
  entries: readonly FamilyTimelineEntry[],
): FamilyTimelineGroups {
  const years = new Map<number, FamilyTimelineEntry[]>(),
    remembered: FamilyTimelineEntry[] = [],
    unknown: FamilyTimelineEntry[] = [];
  for (const entry of entries) {
    if (!entry.when) unknown.push(entry);
    else if (entry.orderingYear === null) remembered.push(entry);
    else
      years.set(entry.orderingYear, [
        ...(years.get(entry.orderingYear) ?? []),
        entry,
      ]);
  }
  return {
    dated: [...years.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, group]) => ({ year, entries: group })),
    remembered,
    unknown,
  };
}
