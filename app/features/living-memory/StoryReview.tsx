import { t, notice, useLocale, getLocale } from "../../localization/language";
import { useEffect, useRef, useState } from "react";

import { sourceLanguageTag } from "../../localization/locale";
import { phase1Config } from "../../../config/phase-1";
import { storyContextKinds, type StoryContextInput } from "../../domain";
import { loadReviewHistory, saveStoryReview, type LivingMemorySnapshot, type ReviewHistory } from "../../services/living-memory-api";

const labels = { person: "Who", place: "Where", time: "When", event: "What" } as const;
const describe = (entry: StoryContextInput) => entry.state === "unknown" ? t("I don't remember") : entry.state === "omitted" ? t("Left out") : `${entry.value}${entry.state === "approximate" ? ` ${t("— approximate")}` : ""}`;

export function StoryReview({ draftId, snapshot, onUpdated, onEditingChange }: {
  readonly draftId: string;
  readonly snapshot: LivingMemorySnapshot;
  readonly onUpdated: () => Promise<void>;
  readonly onEditingChange: (editing: boolean) => void;
}) {
  useLocale();
  const [editing, setEditing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState<StoryContextInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ReviewHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const editor = useRef<HTMLHeadingElement | null>(null);
  const editButton = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  const historyEpoch = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (editing) editor.current?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function startEditing() {
    setTranscript(snapshot.transcript?.text ?? "");
    setContext(storyContextKinds.map((kind) => {
      const current = snapshot.context.find((entry) => entry.kind === kind);
      return { kind, state: current?.state ?? "omitted", value: current?.value ?? null };
    }));
    setMessage(null);
    setEditing(true);
    onEditingChange(true);
  }
  function close() { setEditing(false); setMessage(null); onEditingChange(false); }

  async function getHistory(before?: string) {
    const epoch = ++historyEpoch.current;
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      const next = await loadReviewHistory(draftId, before);
      if (alive.current && epoch === historyEpoch.current) setHistory((previous) => before && previous
        ? { ...next, revisions: [...previous.revisions, ...next.revisions] } : next);
    } catch (error) {
      if (alive.current && epoch === historyEpoch.current) setHistoryError(error instanceof Error ? error.message : "Your revision history could not be loaded. Try again.");
    } finally { if (alive.current && epoch === historyEpoch.current) setHistoryBusy(false); }
  }

  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    const review = { expectedVersion: snapshot.version, transcriptText: snapshot.transcript ? transcript : null, context };
    const payload = JSON.stringify(review);
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: `review_${crypto.randomUUID()}` };
    try {
      await saveStoryReview(draftId, review, attempt.current!.key);
      if (!alive.current) return;
      await onUpdated();
      if (!alive.current) return;
      close();
      setHistory(null);
      if (historyOpen) void getHistory();
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error ? error.message : "Your changes could not be saved. Your unsaved words are still here.");
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  }

  async function reload() {
    if (!window.confirm(t("Discard these unsaved edits and reopen the latest details?"))) return;
    setBusy(true);
    try { await onUpdated(); if (alive.current) close(); }
    catch { if (alive.current) setMessage("The latest details could not be loaded. Your unsaved words are still here."); }
    finally { if (alive.current) setBusy(false); }
  }

  return <section className="memory-review-section" aria-label={t("Your story details")}>
    <p>{t("Details are optional. Unknown dates and people are welcome; you can leave them out.")}</p>
    {snapshot.transcript && !editing && <div>
      <strong>{snapshot.transcript.revisionKind === "corrected_transcript" ? t("Your revised transcript") : t("Transcript from your voice")}</strong>
      <p lang={sourceLanguageTag(snapshot.transcript.locale)}>{snapshot.transcript.text}</p>
    </div>}
    {!editing && <>
      {snapshot.context.length > 0 && <dl>{snapshot.context.map((entry) => <div key={entry.kind}><dt>{t(labels[entry.kind])}</dt><dd>{describe(entry)}</dd></div>)}</dl>}
      <button ref={editButton} className="secondary-action" type="button" onClick={startEditing}>{t("Edit details")}</button>
    </>}
    {editing && <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <h2 ref={editor} tabIndex={-1}>{t("Your words, your details")}</h2>
      <p>{t("Saving adds a revision. Your original photograph, recording and earlier words remain unchanged. Existing family links keep the captions you selected for them.")}</p>
      {snapshot.transcript && <label className="memory-field"><span>{t("Edit transcript")}</span>
        <textarea lang={sourceLanguageTag(snapshot.transcript.locale)} rows={6} value={transcript} maxLength={phase1Config.review.maxTranscriptCharacters} required
          disabled={busy} onChange={(event) => setTranscript(event.target.value)} />
      </label>}
      {context.map((entry, index) => <fieldset key={entry.kind} disabled={busy}>
        <legend>{t(labels[entry.kind])} {t("— optional")}</legend>
        <label className="memory-field"><span>{t("{field} certainty", { field: t(labels[entry.kind]) })}</span>
          <select value={entry.state} onChange={(event) => {
            const state = event.target.value as StoryContextInput["state"];
            setContext((previous) => previous.map((item, i) => i !== index ? item : {
              ...item, state, value: state === "unknown" || state === "omitted" ? null : item.value
            }));
          }}>
            <option value="stated">{t("In my words")}</option><option value="approximate">{t("Approximate")}</option>
            <option value="unknown">{t("I don't remember")}</option><option value="omitted">{t("Leave this out")}</option>
          </select>
        </label>
        {(entry.state === "stated" || entry.state === "approximate") && <label className="memory-field"><span>{t("{field} details", { field: t(labels[entry.kind]) })}</span>
          <input value={entry.value ?? ""} maxLength={phase1Config.review.maxContextCharacters} required onChange={(event) =>
            setContext((previous) => previous.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} />
        </label>}
      </fieldset>)}
      {message && <p role="alert">{notice(message)} {t("Your unsaved words remain in this form.")}</p>}
      <div className="capture-actions">
        <button className="primary-action" type="submit" disabled={busy}>{busy ? t("Saving changes…") : t("Save my changes")}</button>
        <button className="secondary-action" type="button" disabled={busy} onClick={close}>{t("Cancel edits")}</button>
        {message && <button className="secondary-action" type="button" disabled={busy} onClick={() => void reload()}>{t("Reopen latest details")}</button>}
      </div>
    </form>}
    <p>{t("Your original recording remains the primary testimony. Revisions reflect your choices, not a platform judgment.")}</p>
    <button className="light-text-action" type="button" aria-expanded={historyOpen} onClick={() => {
      setHistoryOpen(!historyOpen); if (!historyOpen) void getHistory();
    }}>{t("Revision history")}</button>
    {historyOpen && <div aria-label={t("Revision history")}>
      {historyBusy && <p role="status">{t("Loading earlier versions…")}</p>}
      {historyError && <p role="alert">{notice(historyError)}</p>}
      {historyError && <button type="button" disabled={historyBusy} onClick={() => void getHistory()}>{t("Retry history")}</button>}
      {history?.originalTranscript && <details><summary>{t("Original machine transcript")}</summary><p lang={sourceLanguageTag(history.originalTranscript.locale)}>{history.originalTranscript.text}</p><p>{t("The recording is the original; this text was transcribed by a machine.")}</p></details>}
      {history?.revisions.map((revision) => <details key={revision.reviewId}>
        <summary>{revision.kind === "completion" ? t("You preserved this memory") : t("Your saved revision")} · {new Date(revision.createdAt).toLocaleString(getLocale())}</summary>
        {revision.transcriptText && <p lang={sourceLanguageTag(revision.locale)}>{revision.transcriptText}</p>}
        <dl>{revision.context.map((entry) => <div key={entry.kind}><dt>{t(labels[entry.kind])}</dt><dd>{describe(entry)}</dd></div>)}</dl>
      </details>)}
      {history && history.revisions.length === 0 && <p>{t("No saved detail revisions yet.")}</p>}
      {history?.nextCursor && <button type="button" className="secondary-action" disabled={historyBusy} onClick={() => void getHistory(history.nextCursor!)}>{t("Load earlier revisions")}</button>}
    </div>}
  </section>;
}
