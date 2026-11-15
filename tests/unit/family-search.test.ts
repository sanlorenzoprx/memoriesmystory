import { describe, expect, it } from "vitest";
import {
  foldForSearch,
  matchesSearch,
  normalizeSearchQuery,
  searchLikePattern,
  searchSnippet,
} from "../../app/domain/family-search";

describe("literal family archive search", () => {
  it("matches across accents and case in English and Spanish without changing length", () => {
    expect(foldForSearch("María Ñandú ÜBER")).toBe("maria nandu uber");
    expect(foldForSearch("Abuela’s cocina").length).toBe("Abuela’s cocina".length);
    expect(matchesSearch("La cocina de la tía María", "tia maria")).toBe(true);
    expect(matchesSearch("Mayagüez, Puerto Rico", "MAYAGUEZ")).toBe(true);
    expect(matchesSearch("niño", "nino")).toBe(true);
    expect(matchesSearch("Grandmother's kitchen", "kitchens")).toBe(false);
  });

  it("is literal: no stemming, synonyms or inference", () => {
    expect(matchesSearch("my aunt", "tía")).toBe(false);
    expect(matchesSearch("1950", "1951")).toBe(false);
  });

  it("builds a coarse pattern that treats LIKE wildcards in the query as plain text", () => {
    expect(searchLikePattern("maria")).toBe("%m_r__%");
    expect(searchLikePattern("100%_x\\")).toBe("%100\\%\\_x\\\\%");
  });

  it("accepts only bounded queries and collapses whitespace", () => {
    expect(normalizeSearchQuery("  tía   María ")).toBe("tía María");
    expect(normalizeSearchQuery("a")).toBeNull();
    expect(normalizeSearchQuery("x".repeat(81))).toBeNull();
    expect(normalizeSearchQuery(42)).toBeNull();
  });

  it("cuts a snippet from the original words without rewriting them", () => {
    const long = `${"Antes. ".repeat(40)}Recuerdo la cocina de la tía María en mayo.${" Después.".repeat(40)}`,
      snippet = searchSnippet(long, "tia maria");
    expect(snippet).toContain("tía María");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(long).toContain(snippet.replace(/…/g, "").trim());
    expect(searchSnippet("Short title", "title")).toBe("Short title");
  });
});
