import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiMessageKey } from "../../localization/errors";
import { t, notice, useLocale } from "../../localization/language";

type Kind = "person" | "place" | "time" | "event";
type Remembered = { id: string; memoryId: string; memoryTitle: string | null; kind: Kind; value: string; approximate: boolean; forgotten: boolean };
type MuseMemory = { leftOff: { draftId: string; updatedAt: string; unfinished: number } | null; remembered: Remembered[] };
const fallback = "Muse's memory could not be opened. Please try again.";
const headings: Record<Kind, string> = { person: "People", place: "Places", time: "Times", event: "Moments" };

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const body = (await response.json().catch(() => null)) as (Partial<MuseMemory> & { error?: { code?: string } }) | null;
  if (!response.ok || !body || !Array.isArray(body.remembered)) throw new Error(apiMessageKey(body?.error?.code, fallback));
  return body as Pick<MuseMemory, "remembered"> & Partial<MuseMemory>;
}

/**
 * Where the person left off, and everything Muse remembers about them
 * (Talk with Muse M2, decision 2026-11-16). Muse remembers only what the
 * person confirmed in their own words; forgetting here never changes a memory.
 */
export function MuseMemoryPanel() {
  useLocale();
  const [memory, setMemory] = useState<MuseMemory | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void request("/resources/muse/memory")
      .then((body) => !cancelled && setMemory({ leftOff: body.leftOff ?? null, remembered: body.remembered }))
      .catch(() => undefined); // The archive works without this panel.
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(entry: Remembered, forgotten: boolean) {
    setBusy(true);
    setError(null);
    try {
      const body = await request("/resources/muse/memory/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Memories-Request": "muse-memory-v1" },
        body: JSON.stringify({ contextEntryId: entry.id, forgotten }),
      });
      setMemory((current) => (current ? { ...current, remembered: body.remembered } : current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  if (!memory) return null;
  const { leftOff, remembered } = memory;
  return (
    <>
      {leftOff && (
        <section className="muse-left-off" aria-label={t("Where you left off")}>
          <p>
            {leftOff.unfinished === 1
              ? t("You have 1 memory you haven't finished.")
              : t("You have {count} memories you haven't finished.", { count: leftOff.unfinished })}
          </p>
          <Link className="primary-action" to={`/memory/${encodeURIComponent(leftOff.draftId)}`}>
            {t("Pick up where you left off")}
          </Link>
        </section>
      )}
      {remembered.length > 0 && (
        <details className="memory-review-section muse-memory">
          <summary>{t("What Muse remembers")}</summary>
          <p>
            {t(
              "Muse remembers only what you confirmed in your own words, so it can ask whether a new photograph connects to an old story. Nothing here is shared. Asking Muse to forget never changes your memory.",
            )}
          </p>
          {error && <p role="alert">{notice(error)}</p>}
          {(Object.keys(headings) as Kind[]).map((kind) => {
            const entries = remembered.filter((entry) => entry.kind === kind);
            if (!entries.length) return null;
            return (
              <section key={kind}>
                <h3>{t(headings[kind])}</h3>
                <ul>
                  {entries.map((entry) => (
                    <li key={entry.id} className={entry.forgotten ? "muse-memory-forgotten" : undefined}>
                      <span>
                        {entry.approximate ? t("About: {value}", { value: entry.value }) : entry.value}
                      </span>{" "}
                      <Link to={`/memory/${encodeURIComponent(entry.memoryId)}`}>
                        {entry.memoryTitle ? t("from {title}", { title: entry.memoryTitle }) : t("from a Living Memory")}
                      </Link>{" "}
                      <button type="button" disabled={busy} onClick={() => void choose(entry, !entry.forgotten)}>
                        {entry.forgotten
                          ? t("Let Muse remember {value}", { value: entry.value })
                          : t("Ask Muse to forget {value}", { value: entry.value })}
                      </button>
                      {entry.forgotten && <span> {t("Muse won't bring this up.")}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </details>
      )}
    </>
  );
}
