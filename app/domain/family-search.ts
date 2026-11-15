/**
 * Literal, accent- and case-insensitive matching over human-entered archive text.
 * This is deliberately not semantic search: it never infers, ranks by meaning or
 * rewrites what a person wrote.
 */
export const familySearchLimits = {
  minimumCharacters: 2,
  maximumCharacters: 80,
  candidateRows: 300,
  maximumMemories: 20,
  maximumMatchesPerMemory: 6,
  snippetRadius: 70,
} as const;

export type FamilySearchMatchKind =
  | "title"
  | "chapter"
  | "person"
  | "context_person"
  | "context_place"
  | "context_time"
  | "context_event"
  | "recollection"
  | "written_words";

export type FamilySearchMatch = {
  kind: FamilySearchMatchKind;
  /** The human-entered text containing the match, shortened around it when long. */
  text: string;
  /** How the person who wrote or said it chose to be named, when it is a contribution. */
  attribution: string | null;
  /** True when the storyteller marked this detail as approximate. */
  approximate: boolean;
};

export type FamilySearchResult = {
  memoryId: string;
  title: string | null;
  matches: FamilySearchMatch[];
};

export type FamilySearchResponse = {
  query: string;
  results: FamilySearchResult[];
  /** True when more matched than is shown; the person should narrow the search. */
  truncated: boolean;
};

/** Lowercase and strip accents, keeping one output character per input character. */
export function foldForSearch(value: string): string {
  let folded = "";
  for (const character of value) {
    const base = character
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    // Keep positions aligned with the original so snippets can be cut from it.
    folded += base.length === character.length ? base : base.slice(0, 1).padEnd(character.length, " ");
  }
  return folded;
}

export function normalizeSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.replace(/\s+/g, " ").trim();
  return query.length >= familySearchLimits.minimumCharacters &&
    query.length <= familySearchLimits.maximumCharacters
    ? query
    : null;
}

/**
 * A coarse SQL LIKE pattern. Letters that can carry an accent become a
 * single-character wildcard so "maria" finds "María"; every candidate is then
 * checked exactly with {@link matchesSearch}.
 */
export function searchLikePattern(query: string): string {
  let pattern = "%";
  for (const character of foldForSearch(query)) {
    if ("aeioucny".includes(character)) pattern += "_";
    else if (character === "%" || character === "_" || character === "\\")
      pattern += `\\${character}`;
    else pattern += character;
  }
  return `${pattern}%`;
}

export function matchesSearch(text: string, query: string): boolean {
  return foldForSearch(text).includes(foldForSearch(query));
}

/** Cut the original text around the first match, never altering its characters. */
export function searchSnippet(text: string, query: string): string {
  const index = foldForSearch(text).indexOf(foldForSearch(query)),
    radius = familySearchLimits.snippetRadius;
  if (index < 0 || text.length <= radius * 2 + query.length) return text;
  const start = Math.max(0, index - radius),
    end = Math.min(text.length, index + query.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
