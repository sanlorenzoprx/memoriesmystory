import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  familySearchLimits,
  type FamilySearchMatch,
  type FamilySearchResponse,
} from "../../domain/family-search";
import { searchFamilyArchive } from "../../services/family-search";
import { t, notice, useLocale } from "../../localization/language";

// Each label says where the words came from, so a recollection is never
// presented as an established fact.
function sourceLabel(match: FamilySearchMatch): string {
  switch (match.kind) {
    case "title":
      return t("In the memory's name");
    case "chapter":
      return t("In a Chapter name");
    case "person":
      return t("A person you named");
    case "context_person":
      return t("Who the storyteller said was there");
    case "context_place":
      return t("Where the storyteller said it was");
    case "context_time":
      return t("When the storyteller said it was");
    case "context_event":
      return t("What the storyteller said was happening");
    case "recollection":
      return t("{name} remembered", { name: match.attribution ?? "" });
    case "written_words":
      return t("{name} wrote, for their recording", {
        name: match.attribution ?? "",
      });
  }
}

/**
 * Finds memories by the words people entered. For invited family, `grantId`
 * limits the search to what that invitation shares.
 */
export function FamilySearchPanel({ grantId }: { readonly grantId?: string }) {
  useLocale();
  const [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [found, setFound] = useState<FamilySearchResponse | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  // Results from one invitation must never linger under another.
  useEffect(() => {
    pending.current?.abort();
    setFound(null);
    setError(null);
  }, [grantId]);
  const trimmed = query.replace(/\s+/g, " ").trim(),
    ready = trimmed.length >= familySearchLimits.minimumCharacters;

  async function search() {
    if (!ready) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await searchFamilyArchive(
        trimmed,
        grantId,
        controller.signal,
      );
      if (!controller.signal.aborted) setFound(result);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setFound(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "The search could not be completed. Please try again.",
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section className="memory-review-section" aria-label={t("Find a memory")}>
      <h2>{t("Find a memory")}</h2>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label htmlFor={`family-search-${grantId ?? "own"}`}>
          {t("Search by a name, place, date or words someone used")}
        </label>
        <input
          id={`family-search-${grantId ?? "own"}`}
          type="search"
          value={query}
          maxLength={familySearchLimits.maximumCharacters}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="submit"
          className="secondary-action"
          disabled={busy || !ready}
        >
          {t("Search")}
        </button>
      </form>
      <p>
        {t(
          "Search looks for the exact words people entered. It does not guess, and it shows what each person remembered, not verified facts.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      {busy && <p role="status">{t("Searching…")}</p>}
      {found && !busy && (
        <div role="status">
          {found.results.length === 0 ? (
            <p>{t("No memories matched “{query}”.", { query: found.query })}</p>
          ) : (
            <p>
              {t("Memories matching “{query}”: {count}", {
                query: found.query,
                count: found.results.length,
              })}
            </p>
          )}
          {found.truncated && (
            <p>
              {t(
                "More matched than can be shown. Add another word to narrow the search.",
              )}
            </p>
          )}
        </div>
      )}
      {found && found.results.length > 0 && (
        <ul className="archive-list">
          {found.results.map((result) => (
            <li key={result.memoryId}>
              <h3>
                {grantId ? (
                  (result.title ?? t("Living Memory"))
                ) : (
                  <Link to={`/memory/${encodeURIComponent(result.memoryId)}`}>
                    {result.title ?? t("Living Memory")}
                  </Link>
                )}
              </h3>
              {result.matches.map((match, index) => (
                <div key={index}>
                  <p>
                    {sourceLabel(match)}
                    {match.approximate ? ` · ${t("approximately")}` : ""}
                  </p>
                  <p
                    className="human-recollection-text"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {match.text}
                  </p>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
