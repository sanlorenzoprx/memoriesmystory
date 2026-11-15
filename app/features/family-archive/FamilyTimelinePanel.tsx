import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  groupTimeline,
  type FamilyTimelineEntry,
  type FamilyTimelineResponse,
} from "../../domain/family-timeline";
import { apiMessageKey } from "../../localization/errors";
import { t, notice, useLocale } from "../../localization/language";

const fallback = "The timeline could not be opened. Please try again.";

async function loadTimeline(
  signal: AbortSignal,
): Promise<FamilyTimelineResponse> {
  let response: Response;
  try {
    response = await fetch("/resources/family-timeline", {
      credentials: "same-origin",
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(fallback, { cause: error });
  }
  const value = (await response.json().catch(() => null)) as
    | (Partial<FamilyTimelineResponse> & { error?: { code?: string } })
    | null;
  if (!response.ok) throw new Error(apiMessageKey(value?.error?.code, fallback));
  if (!value || !Array.isArray(value.entries)) throw new Error(fallback);
  return { entries: value.entries, truncated: value.truncated === true };
}

function Entries({ entries }: { readonly entries: FamilyTimelineEntry[] }) {
  return (
    <ul className="archive-list">
      {entries.map((entry) => (
        <li key={entry.memoryId}>
          <Link to={`/memory/${encodeURIComponent(entry.memoryId)}`}>
            <strong>{entry.title ?? t("Living Memory")}</strong>
            {entry.when && (
              <span>
                {/* The storyteller's own words, never a reformatted date. */}
                {entry.when.approximate
                  ? t("The storyteller said, approximately: {when}", {
                      when: entry.when.text,
                    })
                  : t("The storyteller said: {when}", {
                      when: entry.when.text,
                    })}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The owner's memories in the order of the years the storyteller actually named. */
export function FamilyTimelinePanel() {
  useLocale();
  const [view, setView] = useState<FamilyTimelineResponse | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function open() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      const next = await loadTimeline(controller.signal);
      if (!controller.signal.aborted) setView(next);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const groups = view ? groupTimeline(view.entries) : null;
  return (
    <details className="memory-review-section">
      <summary>{t("Timeline")}</summary>
      <p>
        {t(
          "Memories appear by the year the storyteller named. Nothing is placed on a date they did not give.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={() => void open()}
      >
        {t(view ? "Recheck timeline" : "Open timeline")}
      </button>
      {groups && view && (
        <>
          {view.entries.length === 0 && (
            <p>{t("Completed memories will appear here.")}</p>
          )}
          {view.truncated && (
            <p>
              {t(
                "This timeline shows the first memories only. Use search to find others.",
              )}
            </p>
          )}
          {groups.dated.map((group) => (
            <section key={group.year} aria-label={String(group.year)}>
              <h3>{group.year}</h3>
              <Entries entries={group.entries} />
            </section>
          ))}
          {groups.remembered.length > 0 && (
            <section aria-label={t("Remembered without a year")}>
              <h3>{t("Remembered without a year")}</h3>
              <Entries entries={groups.remembered} />
            </section>
          )}
          {groups.unknown.length > 0 && (
            <section aria-label={t("Date not known")}>
              <h3>{t("Date not known")}</h3>
              <p>
                {t(
                  "No date is needed. These memories are complete as they are.",
                )}
              </p>
              <Entries entries={groups.unknown} />
            </section>
          )}
        </>
      )}
    </details>
  );
}
