import { useState } from "react";
import { saveShareAgreement, type ShareAgreement } from "../../services/living-memory-api";
import { t, notice, useLocale } from "../../localization/language";

/**
 * Asked once (owner decision 2026-11-16): an adult chooses how they want to be
 * able to share. The choice is saved and not asked again while this wording
 * stands. Agreeing shares nothing by itself.
 */
export function ShareAgreementCard({
  agreement,
  onSaved,
}: {
  readonly agreement: ShareAgreement;
  readonly onSaved: (agreement: ShareAgreement) => void;
}) {
  useLocale();
  const [family, setFamily] = useState(agreement.familyAndFriends),
    [everyone, setEveryone] = useState(agreement.public),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveShareAgreement({ public: everyone, version: agreement.version }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your sharing choice could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="memory-review-section" aria-labelledby="share-agreement-title">
      <h2 id="share-agreement-title">{t("How you want to share")}</h2>
      <p>{t("You choose this once. We save your choice and will not ask again.")}</p>
      <label className="share-option">
        <input type="checkbox" checked={family} disabled={busy || agreement.familyAndFriends} onChange={(event) => setFamily(event.target.checked)} />
        {t("Friends and family: I can send links to my memories to the people I choose. Anyone who receives a link can open it and keep a copy.")}
      </label>
      <label className="share-option">
        <input type="checkbox" checked={everyone} disabled={busy || agreement.public} onChange={(event) => setEveryone(event.target.checked)} />
        {t("Public: I can also post links where anyone may see them, for example on Facebook.")}
      </label>
      {error && <p className="inline-error" role="alert">{notice(error)}</p>}
      <button className="primary-action" type="button" disabled={busy || !family} onClick={() => void save()}>
        {t("I agree")}
      </button>
    </section>
  );
}
