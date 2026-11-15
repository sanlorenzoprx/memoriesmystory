import { useState } from "react";
import type { FamilyContribution } from "../../domain/family-contribution";
import { t, useLocale } from "../../localization/language";
import { phase1Config } from "../../../config/phase-1";

/**
 * The speaker's own written words for their voice recollection. These are typed
 * by the person who spoke; nothing here is a machine transcript.
 */
export function ContributionWrittenWords({
  item,
  busy,
  onWrite,
  onDecide,
}: {
  readonly item: FamilyContribution;
  readonly busy: boolean;
  readonly onWrite: (text: string) => Promise<boolean>;
  readonly onDecide: (include: boolean, transcriptId?: string) => void;
}) {
  useLocale();
  const words = item.writtenWords,
    latest = words?.latest ?? null,
    included = words?.included ?? null,
    shown = latest ?? included;
  const [text, setText] = useState<string | null>(null),
    [agree, setAgree] = useState(false);
  if (!words) return null;
  const draft = text ?? latest?.text ?? "";
  return (
    <section aria-label={t("Written words for this recording")}>
      {shown && (
        <>
          <p>
            {t("Written by {name} for this recording", {
              name: item.revision.attribution,
            })}
          </p>
          <p
            className="human-recollection-text"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {shown.text}
          </p>
          {(item.own || item.canAssemble) && (
            <p>
              {t(
                included?.id === shown.id
                  ? "These written words are included for invited family"
                  : included
                    ? "An earlier version of these written words is included"
                    : "Written words are waiting for owner review",
              )}
            </p>
          )}
        </>
      )}
      {item.canAssemble && latest && item.authorState === "submitted" && (
        <>
          <button
            type="button"
            disabled={
              busy || !item.includedRevisionId || included?.id === latest.id
            }
            onClick={() => onDecide(true, latest.id)}
          >
            {t("Include these written words for family")}
          </button>
          {included && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(false)}
            >
              {t("Keep written words out of family view")}
            </button>
          )}
        </>
      )}
      {item.own && item.authorState === "submitted" && (
        <details>
          <summary>
            {t(
              latest
                ? "Change the words I wrote for this recording"
                : "Write the words I said in this recording",
            )}
          </summary>
          <p>
            {t(
              "This is optional. Your recording stays exactly as you spoke it; these are your own written words beside it.",
            )}
          </p>
          <label htmlFor={`written-words-${item.id}`}>
            {t("The words I said, as I would write them")}
          </label>
          <textarea
            id={`written-words-${item.id}`}
            value={draft}
            maxLength={phase1Config.familyContributions.textCharacters}
            disabled={busy}
            onChange={(event) => setText(event.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={agree}
              disabled={busy}
              onChange={(event) => setAgree(event.target.checked)}
            />
            {t(
              "I want the owner to review these written words and choose whether they are included for invited family.",
            )}
          </label>
          <button
            type="button"
            className="primary-action"
            disabled={
              busy || !agree || !draft.trim() || draft.trim() === latest?.text
            }
            onClick={() =>
              void onWrite(draft).then((saved) => {
                if (!saved) return;
                setText(null);
                setAgree(false);
              })
            }
          >
            {t("Save my written words for review")}
          </button>
        </details>
      )}
    </section>
  );
}
