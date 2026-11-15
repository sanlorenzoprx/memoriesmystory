import { describe, expect, it } from "vitest";
import { groupTimeline, yearWrittenIn, type FamilyTimelineEntry } from "../../app/domain/family-timeline";

describe("timeline from the storyteller's own words", () => {
  it("orders only by a year the person actually wrote", () => {
    expect(yearWrittenIn("Summer of 1950, I think")).toBe(1950);
    expect(yearWrittenIn("verano de 1962")).toBe(1962);
    expect(yearWrittenIn("between 1948 and 1951")).toBe(1948);
    // No guessing a year from a decade, an abbreviation, an age or a longer number.
    for (const text of ["the 1950s", "'50", "when I was 12", "around Christmas", "19501", "año1950x"])
      expect(yearWrittenIn(text)).toBeNull();
  });

  it("keeps undated and unknown memories instead of placing them on a date", () => {
    const entry = (memoryId: string, text: string | null, orderingYear: number | null, approximate = false): FamilyTimelineEntry => ({
      memoryId, title: null, orderingYear, when: text === null ? null : { text, approximate },
    });
    const groups = groupTimeline([
      entry("c", "June 1951", 1951),
      entry("a", "about 1950", 1950, true),
      entry("d", null, null),
      entry("b", "one Christmas", null),
      entry("e", "1950", 1950),
    ]);
    expect(groups.dated.map((g) => [g.year, g.entries.map((e) => e.memoryId)])).toEqual([[1950, ["a", "e"]], [1951, ["c"]]]);
    expect(groups.dated[0].entries[0].when).toEqual({ text: "about 1950", approximate: true });
    expect(groups.remembered.map((e) => e.memoryId)).toEqual(["b"]);
    expect(groups.unknown.map((e) => e.memoryId)).toEqual(["d"]);
  });
});
