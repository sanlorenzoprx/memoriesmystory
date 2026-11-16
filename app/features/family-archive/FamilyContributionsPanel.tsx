import { legacyDeletionChannel } from "../../services/legacy-recording-store";
import {
  keepUnsentMedia,
  loadUnsentMedia,
  removeUnsentMedia,
  removeUnsentMediaForMemory,
} from "../../services/contribution-media-store";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FamilyContribution } from "../../domain/family-contribution";
import {
  contributionRequest,
  contributionMediaUrl,
  readContributionPhoto,
  removeLocalContributionDrafts,
  submitPhotoContribution,
  submitVoiceContribution,
  type ContributionIndex,
  type LocalContributionPhoto,
} from "../../services/family-contributions";
import { ContributionVoiceRecorder } from "./ContributionVoiceRecorder";
import { ContributionWrittenWords } from "./ContributionWrittenWords";
import type { LocalAudio } from "../capture/local-draft";
import { t, notice, useLocale } from "../../localization/language";
import { phase1Config } from "../../../config/phase-1";
const limits = phase1Config.familyContributions;
type Draft = {
  attribution: string;
  text: string;
  agree: boolean;
  editing: FamilyContribution | null;
  requestKey: string | null;
  agreementVersion: string;
};
const blank: Draft = {
  attribution: "",
  text: "",
  agree: false,
  editing: null,
  requestKey: null,
  agreementVersion: limits.agreementVersion,
};
function readDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value &&
      typeof value.attribution === "string" &&
      typeof value.text === "string" &&
      typeof value.agree === "boolean" &&
      value.text.length <= limits.textCharacters
      ? value.agreementVersion === limits.agreementVersion
        ? value
        : {
            ...value,
            agree: false,
            requestKey: null,
            agreementVersion: limits.agreementVersion,
          }
      : null;
  } catch {
    return null;
  }
}
export function FamilyContributionsPanel({
  memoryId,
  grantId,
}: {
  memoryId: string;
  grantId?: string;
}) {
  const locale = useLocale();
  const [view, setView] = useState<ContributionIndex | null>(null),
    [draft, setDraft] = useState<Draft>(blank),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [voice, setVoice] = useState<LocalAudio | null>(null),
    [voiceSaved, setVoiceSaved] = useState(false),
    [photo, setPhoto] = useState<LocalContributionPhoto | null>(null),
    [photoSaved, setPhotoSaved] = useState(false),
    [wordsSaved, setWordsSaved] = useState(false),
    [storageError, setStorageError] = useState(false),
    [deleted, setDeleted] = useState(false),
    [history, setHistory] = useState<{
      contributionId: string;
      revisions: { attribution: string; text: string; createdAt: string }[];
      nextCursor: string | null;
    } | null>(null);
  // One key per recording, reused on retry so a repeated send cannot store it twice.
  const voiceKey = useRef<string | null>(null),
    photoKey = useRef<string | null>(null),
    photoInput = useRef<HTMLInputElement | null>(null),
    // Same words for the same recording reuse one key, so a retry cannot save twice.
    wordsKeys = useRef<Record<string, { text: string; key: string }>>({});
  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo.blob) : null),
    [photo],
  );
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  const localKey = useRef<string | null>(null),
    mounted = useRef(true),
    deletion = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(legacyDeletionChannel);
    channel.onmessage = (event) => {
      if (event.data?.memoryId !== memoryId) return;
      deletion.current = true;
      setDeleted(true);
      setDraft({ ...blank });
      setVoice(null);
      setPhoto(null);
      setView(null);
      setHistory(null);
      try {
        removeLocalContributionDrafts(memoryId);
      } catch {
        setStorageError(true);
      }
      void removeUnsentMediaForMemory(memoryId).catch(() => setStorageError(true));
    };
    return () => channel.close();
  }, [memoryId]);
  useEffect(() => {
    if (!localKey.current || deletion.current) return;
    try {
      localStorage.setItem(
        localKey.current,
        JSON.stringify({ ...draft, memoryId }),
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [draft, memoryId]);
  // Keep unsent media on this device until it is sent, discarded or deleted.
  function keepMedia(kind: "voice" | "photo", media: unknown, requestKey: string | null) {
    if (!localKey.current || deletion.current) return Promise.resolve();
    const key = `${localKey.current}:${kind}`;
    return (media ? keepUnsentMedia({ key, memoryId, kind, media, requestKey }) : removeUnsentMedia(key)).catch(() =>
      setStorageError(true),
    );
  }
  useEffect(() => {
    void keepMedia("voice", voice, voiceKey.current);
  }, [voice]);
  useEffect(() => {
    void keepMedia("photo", photo, photoKey.current);
  }, [photo]);
  function edit(values: Partial<Draft>) {
    setSaved(false);
    setDraft((previous) => ({ ...previous, ...values, requestKey: null }));
  }
  async function refresh(more = false) {
    const next = await contributionRequest<ContributionIndex>(
      memoryId,
      grantId,
      more && view?.nextCursor
        ? `?after=${encodeURIComponent(view.nextCursor)}`
        : "",
    );
    if (
      !Array.isArray(next.contributions) ||
      typeof next.draftScope !== "string" ||
      !/^[a-f0-9]{64}$/.test(next.draftScope)
    )
      throw new Error(
        "Family recollections could not be opened. Please try again.",
      );
    if (!mounted.current || deletion.current) return;
    setView((previous) =>
      more && previous
        ? {
            ...next,
            contributions: [...previous.contributions, ...next.contributions],
          }
        : next,
    );
    if (!localKey.current) {
      localKey.current = `memoriesmystory:contribution:${next.draftScope}`;
      const recovered = readDraft(localKey.current);
      if (recovered) setDraft(recovered);
      // An unsent recording or photograph survives a reload, with its request key.
      const scope = localKey.current;
      void Promise.all([loadUnsentMedia(`${scope}:voice`), loadUnsentMedia(`${scope}:photo`)])
        .then(([keptVoice, keptPhoto]) => {
          if (!mounted.current || deletion.current) return;
          if (keptVoice?.media) {
            voiceKey.current = keptVoice.requestKey;
            setVoice((current) => current ?? (keptVoice.media as LocalAudio));
          }
          if (keptPhoto?.media) {
            photoKey.current = keptPhoto.requestKey;
            setPhoto((current) => current ?? (keptPhoto.media as LocalContributionPhoto));
          }
        })
        .catch(() => setStorageError(true));
    }
  }
  async function action(work: () => Promise<void>) {
    if (busy || deletion.current) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    setVoiceSaved(false);
    setPhotoSaved(false);
    setWordsSaved(false);
    try {
      await work();
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "Family recollections could not be opened. Please try again.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function submit() {
    const key =
      draft.requestKey ?? `contribution_request_${crypto.randomUUID()}`;
    setDraft((previous) => ({ ...previous, requestKey: key }));
    const source = draft.editing;
    const result = await contributionRequest<{ id: string; version: number }>(
      memoryId,
      grantId,
      source ? `/${source.id}/revise` : "",
      "POST",
      {
        ...(source ? { version: source.version } : {}),
        attribution: draft.attribution,
        text: draft.text,
        agree: draft.agree,
        agreementVersion: draft.agreementVersion,
      },
      key,
    );
    const canonical = await contributionRequest<{
      contribution: FamilyContribution;
    }>(memoryId, grantId, `/${result.id}`);
    if (
      !canonical.contribution?.own ||
      canonical.contribution.revision?.text !== draft.text.trim() ||
      canonical.contribution.revision.attribution !==
        draft.attribution.trim() ||
      canonical.contribution.authorState !== "submitted"
    )
      throw new Error(
        "Family recollections could not be opened. Please try again.",
      );
    await refresh();
    if (deletion.current) return;
    setDraft({ ...blank });
    setHistory(null);
    setSaved(true);
  }
  async function submitVoice() {
    if (!voice) return;
    const key =
      voiceKey.current ??
      (voiceKey.current = `contribution_voice_${crypto.randomUUID()}`);
    await keepMedia("voice", voice, key);
    const result = await submitVoiceContribution(memoryId, grantId, voice, {
      attribution: draft.attribution,
      agreementVersion: draft.agreementVersion,
      key,
    });
    // "Saved" is shown only after the server's own record of this voice is read back.
    const canonical = await contributionRequest<{
      contribution: FamilyContribution;
    }>(memoryId, grantId, `/${result.id}`);
    if (
      !canonical.contribution?.own ||
      canonical.contribution.revision?.sourceKind !== "human_voice" ||
      canonical.contribution.revision.attribution !==
        draft.attribution.trim() ||
      canonical.contribution.authorState !== "submitted"
    )
      throw new Error(
        "Your recording could not be confirmed as saved. It is still here; please try again.",
      );
    await refresh();
    if (deletion.current) return;
    voiceKey.current = null;
    setVoice(null);
    setDraft((previous) => ({ ...previous, agree: false, requestKey: null }));
    setVoiceSaved(true);
  }
  async function submitPhoto() {
    if (!photo) return;
    const key =
      photoKey.current ??
      (photoKey.current = `contribution_photo_${crypto.randomUUID()}`);
    await keepMedia("photo", photo, key);
    const result = await submitPhotoContribution(memoryId, grantId, photo, {
      attribution: draft.attribution,
      agreementVersion: draft.agreementVersion,
      key,
    });
    const canonical = await contributionRequest<{
      contribution: FamilyContribution;
    }>(memoryId, grantId, `/${result.id}`);
    if (
      !canonical.contribution?.own ||
      canonical.contribution.revision?.sourceKind !== "human_photo" ||
      canonical.contribution.revision.attribution !==
        draft.attribution.trim() ||
      canonical.contribution.authorState !== "submitted"
    )
      throw new Error(
        "Your photograph could not be confirmed as saved. It is still here; please try again.",
      );
    await refresh();
    if (deletion.current) return;
    photoKey.current = null;
    if (photoInput.current) photoInput.current.value = "";
    setPhoto(null);
    setDraft((previous) => ({ ...previous, agree: false, requestKey: null }));
    setPhotoSaved(true);
  }
  async function writeWords(contribution: FamilyContribution, words: string) {
    const remembered = wordsKeys.current[contribution.id],
      key =
        remembered?.text === words
          ? remembered.key
          : `contribution_words_${crypto.randomUUID()}`;
    wordsKeys.current[contribution.id] = { text: words, key };
    await contributionRequest(
      memoryId,
      grantId,
      `/${contribution.id}/transcript`,
      "POST",
      {
        version: contribution.version,
        text: words,
        agree: true,
        agreementVersion: limits.agreementVersion,
      },
      key,
    );
    const canonical = await contributionRequest<{
      contribution: FamilyContribution;
    }>(memoryId, grantId, `/${contribution.id}`);
    if (canonical.contribution?.writtenWords?.latest?.text !== words.trim())
      throw new Error(
        "Family recollections could not be opened. Please try again.",
      );
    await refresh();
    if (deletion.current) return;
    delete wordsKeys.current[contribution.id];
    setWordsSaved(true);
  }
  async function decideWords(
    contribution: FamilyContribution,
    include: boolean,
    transcriptId?: string,
  ) {
    await contributionRequest(
      memoryId,
      grantId,
      `/${contribution.id}/transcript-assembly`,
      "POST",
      {
        version: contribution.version,
        include,
        ...(include ? { transcriptId } : {}),
      },
      `contribution_words_assembly_${crypto.randomUUID()}`,
    );
    await refresh();
  }
  async function decide(contribution: FamilyContribution, include: boolean) {
    await contributionRequest(
      memoryId,
      grantId,
      `/${contribution.id}/assembly`,
      "POST",
      {
        version: contribution.version,
        include,
        ...(include ? { revisionId: contribution.revision.id } : {}),
      },
      `contribution_assembly_${crypto.randomUUID()}`,
    );
    await refresh();
  }
  if (deleted)
    return <p>{t("This recollection is not available with your access.")}</p>;
  return (
    <details className="memory-review-section">
      <summary>{t("Family recollections")}</summary>
      <p>
        {t(
          "Different people can remember differently. Each recollection keeps its own words and attribution.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      {storageError && (
        <p role="alert">
          {t(
            "Your unsent words are only in this open page. Keep it open until submission is confirmed.",
          )}
        </p>
      )}
      {saved && (
        <p role="status">
          {t(
            "Your recollection is saved for review. It has not automatically been shared with family.",
          )}
        </p>
      )}
      {wordsSaved && (
        <p role="status">
          {t(
            "Your written words are saved for review. They have not automatically been shared with family.",
          )}
        </p>
      )}
      {photoSaved && (
        <p role="status">
          {t(
            "Your photograph is saved for review. It has not automatically been shared with family.",
          )}
        </p>
      )}
      {voiceSaved && (
        <p role="status">
          {t(
            "Your voice recollection is saved for review. It has not automatically been shared with family.",
          )}
        </p>
      )}
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={() => void action(() => refresh())}
      >
        {t(view ? "Recheck recollections" : "Open recollections")}
      </button>
      {view && (
        <>
          <ul className="archive-list">
            {view.contributions.map((item) => (
              <li key={item.id}>
                <h3>{item.revision.attribution}</h3>
                {Number.isFinite(Date.parse(item.revision.createdAt)) && (
                  <p>
                    <time dateTime={item.revision.createdAt}>
                      {t("Added {date}", {
                        date: new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.revision.createdAt)),
                      })}
                    </time>
                  </p>
                )}
                {item.revision.sourceKind === "human_voice" ? (
                  <>
                    <p>{t("Voice recollection")}</p>
                    <audio
                      controls
                      preload="none"
                      aria-label={t("Recollection in {name}'s own voice", {
                        name: item.revision.attribution,
                      })}
                      src={contributionMediaUrl(
                        "voice",
                        memoryId,
                        item.id,
                        grantId,
                      )}
                    />
                    <ContributionWrittenWords
                      item={item}
                      busy={busy}
                      onWrite={async (words) => {
                        let saved = false;
                        await action(async () => {
                          await writeWords(item, words);
                          saved = true;
                        });
                        return saved;
                      }}
                      onDecide={(include, transcriptId) =>
                        void action(() =>
                          decideWords(item, include, transcriptId),
                        )
                      }
                    />
                  </>
                ) : item.revision.sourceKind === "human_photo" ? (
                  <>
                    <p>{t("Added photograph")}</p>
                    <img
                      loading="lazy"
                      style={{ maxWidth: "100%", height: "auto" }}
                      alt={t("Photograph added by {name}", {
                        name: item.revision.attribution,
                      })}
                      src={contributionMediaUrl(
                        "photo",
                        memoryId,
                        item.id,
                        grantId,
                      )}
                    />
                  </>
                ) : (
                  <p
                    className="human-recollection-text"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {item.revision.text}
                  </p>
                )}
                <p>
                  {t(
                    item.authorState === "withdrawn"
                      ? "Withdrawn from family view"
                      : item.includedRevisionId && !item.familyVisible
                        ? "Not available to family with current access"
                        : item.includedRevisionId === item.revision.id
                          ? "This version is included for invited family"
                          : item.includedRevisionId
                            ? "An earlier reviewed version is included"
                            : "Waiting for owner review",
                  )}
                </p>
                {item.own && item.revision.sourceKind === "human_voice" && (
                  <p>
                    {t(
                      "A voice recollection stays exactly as recorded. To say it differently, withdraw it and record a new one.",
                    )}
                  </p>
                )}
                {item.own && item.revision.sourceKind === "human_photo" && (
                  <p>
                    {t(
                      "An added photograph stays exactly as provided. To replace it, withdraw it and add another.",
                    )}
                  </p>
                )}
                {item.own && item.revision.sourceKind === "human_text" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        (draft.text || draft.attribution) &&
                        !window.confirm(
                          t(
                            "Replace your unsent writing with this recollection?",
                          ),
                        )
                      )
                        return;
                      setDraft({
                        attribution: item.revision.attribution,
                        text: item.revision.text,
                        agree: false,
                        editing: item,
                        requestKey: null,
                        agreementVersion: limits.agreementVersion,
                      });
                      setSaved(false);
                      setHistory(null);
                    }}
                  >
                    {t("Revise my recollection")}
                  </button>
                )}
                {(item.own || item.canAssemble) &&
                  item.revision.sourceKind === "human_text" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const result = await contributionRequest<{
                          revisions: {
                            attribution: string;
                            text: string;
                            createdAt: string;
                          }[];
                          nextCursor: string | null;
                        }>(memoryId, grantId, `/${item.id}/history`);
                        if (!Array.isArray(result.revisions))
                          throw new Error(
                            "Family recollections could not be opened. Please try again.",
                          );
                        setHistory({
                          contributionId: item.id,
                          revisions: result.revisions,
                          nextCursor: result.nextCursor,
                        });
                      })
                    }
                  >
                    {t("Read earlier words")}
                  </button>
                )}
                {item.canAssemble && item.authorState === "submitted" && (
                  <>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !item.canInclude ||
                        item.includedRevisionId === item.revision.id
                      }
                      onClick={() => void action(() => decide(item, true))}
                    >
                      {t("Include this version for family")}
                    </button>
                    {item.includedRevisionId && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void action(() => decide(item, false))}
                      >
                        {t("Keep out of family view")}
                      </button>
                    )}
                  </>
                )}
                {item.own && item.authorState === "submitted" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            "Withdraw this recollection from family view? Its source history stays preserved for review.",
                          ),
                        )
                      )
                        void action(async () => {
                          await contributionRequest(
                            memoryId,
                            grantId,
                            `/${item.id}/withdraw`,
                            "POST",
                            { version: item.version },
                            `contribution_withdraw_${crypto.randomUUID()}`,
                          );
                          await refresh();
                        });
                    }}
                  >
                    {t("Withdraw my recollection")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {view.nextCursor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void action(() => refresh(true))}
            >
              {t("More recollections")}
            </button>
          )}
          {history && (
            <section aria-label={t("Earlier words")}>
              <h3>{t("Earlier words")}</h3>
              {history.revisions.map((revision, index) => (
                <blockquote key={index}>
                  <p>{revision.attribution}</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{revision.text}</p>
                </blockquote>
              ))}
              {history.nextCursor && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const next = await contributionRequest<{
                        revisions: {
                          attribution: string;
                          text: string;
                          createdAt: string;
                        }[];
                        nextCursor: string | null;
                      }>(
                        memoryId,
                        grantId,
                        `/${history.contributionId}/history?after=${encodeURIComponent(history.nextCursor!)}`,
                      );
                      if (!Array.isArray(next.revisions))
                        throw new Error(
                          "Family recollections could not be opened. Please try again.",
                        );
                      setHistory({
                        ...history,
                        revisions: [...history.revisions, ...next.revisions],
                        nextCursor: next.nextCursor,
                      });
                    })
                  }
                >
                  {t("More earlier words")}
                </button>
              )}
              <button type="button" onClick={() => setHistory(null)}>
                {t("Close earlier words")}
              </button>
            </section>
          )}
          {view.canContribute && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action(submit);
              }}
            >
              <h3>
                {t(
                  draft.editing
                    ? "Revise your own recollection"
                    : "Add your own recollection",
                )}
              </h3>
              <p>
                {t(
                  "Unsent writing stays on this device. Submission preserves your words for the archive owner to review.",
                )}
              </p>
              <fieldset disabled={busy}>
                <label>
                  {t("How would you like to be named?")}
                  <input
                    required
                    value={draft.attribution}
                    maxLength={limits.attributionCharacters}
                    onChange={(e) => edit({ attribution: e.target.value })}
                  />
                </label>
                <label htmlFor={`contribution-text-${memoryId}`}>
                  {t("Your recollection, in your own words")}
                </label>
                <textarea
                  id={`contribution-text-${memoryId}`}
                  required
                  value={draft.text}
                  maxLength={limits.textCharacters}
                  onChange={(e) => edit({ text: e.target.value })}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={draft.agree}
                    onChange={(e) => edit({ agree: e.target.checked })}
                  />
                  {t(
                    "I want the owner to review these words and choose whether this version is included for invited family.",
                  )}
                </label>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={
                    !draft.agree ||
                    !draft.text.trim() ||
                    !draft.attribution.trim()
                  }
                >
                  {t("Submit my recollection for review")}
                </button>
                {draft.editing && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            "Discard this unsent revision? Earlier preserved words stay unchanged.",
                          ),
                        )
                      )
                        setDraft({ ...blank });
                    }}
                  >
                    {t("Cancel revision")}
                  </button>
                )}
              </fieldset>
              {!draft.editing && (
                <>
                  <ContributionVoiceRecorder
                    audio={voice}
                    disabled={busy}
                    maximumSeconds={limits.voiceSeconds}
                    onChange={(next) => {
                      voiceKey.current = null;
                      setVoiceSaved(false);
                      setVoice(next);
                    }}
                  />
                  {voice && (
                    <>
                      {(!draft.agree || !draft.attribution.trim()) && (
                        <p>
                          {t(
                            "Add your name and choose owner review above before submitting your recording.",
                          )}
                        </p>
                      )}
                      <button
                        type="button"
                        className="primary-action"
                        disabled={
                          busy || !draft.agree || !draft.attribution.trim()
                        }
                        onClick={() => void action(submitVoice)}
                      >
                        {t("Submit my voice recollection for review")}
                      </button>
                    </>
                  )}
                  <section aria-label={t("Added photograph")}>
                    <h3>{t("Or add a photograph of your own")}</h3>
                    <p>
                      {t(
                        "For example the back of the print, or another picture from that day. It is kept exactly as you provide it and never replaces the original photograph.",
                      )}
                    </p>
                    <label>
                      {t(photo ? "Choose a different photograph" : "Choose a photograph to add")}
                      <input
                        ref={photoInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          photoKey.current = null;
                          setPhotoSaved(false);
                          void readContributionPhoto(file).then(
                            (chosen) => {
                              if (mounted.current && !deletion.current)
                                setPhoto(chosen);
                            },
                            () => {
                              if (mounted.current)
                                setError(
                                  "Your photograph could not be confirmed as saved. It is still here; please try again.",
                                );
                            },
                          );
                        }}
                      />
                    </label>
                    {photo && photoPreview && (
                      <>
                        <img
                          style={{ maxWidth: "100%", height: "auto" }}
                          alt={t("Photograph you chose to add")}
                          src={photoPreview}
                        />
                        <p role="status">
                          {t(
                            "Your unsent photograph is only in this open page. Keep it open until submission is confirmed.",
                          )}
                        </p>
                        {(!draft.agree || !draft.attribution.trim()) && (
                          <p>
                            {t(
                              "Add your name and choose owner review above before submitting your photograph.",
                            )}
                          </p>
                        )}
                        <button
                          type="button"
                          className="primary-action"
                          disabled={
                            busy || !draft.agree || !draft.attribution.trim()
                          }
                          onClick={() => void action(submitPhoto)}
                        >
                          {t("Submit my photograph for review")}
                        </button>
                      </>
                    )}
                  </section>
                </>
              )}
            </form>
          )}
        </>
      )}
    </details>
  );
}
