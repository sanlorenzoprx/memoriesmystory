import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { t, notice, useLocale } from "../../localization/language";
import { MuseSupportLines } from "../living-memory/MuseSupportLines";
import {
  confirmTalkConsent,
  deleteTalk,
  listTalks,
  loadTalk,
  loadTalkConsent,
  sendToMuse,
  startTalk,
  type Talk,
} from "../../services/muse-talk";

/** A conversation touched within this many hours is picked up again; older ones start fresh. */
const resumeWithinHours = 12;

/**
 * Talk with Muse (packet M4c, decision 2026-11-16). A person chooses to come
 * here; it is never part of the first five minutes. Muse says it is an AI
 * before anything else, everything stays private, and the person can delete
 * the conversation at any time. Nothing here rewards time spent.
 */
export function TalkWithMuse() {
  useLocale();
  const [state, setState] = useState<"loading" | "consent" | "ready" | "signed-out">("loading"),
    [disclosureVersion, setDisclosureVersion] = useState(""),
    [talk, setTalk] = useState<Talk | null>(null),
    [error, setError] = useState<string | null>(null);

  async function open() {
    const { talks } = await listTalks();
    const recent = talks[0];
    setTalk(
      recent && Date.now() - Date.parse(recent.lastActivityAt) < resumeWithinHours * 3_600_000 ? await loadTalk(recent.talkId) : await startTalk(),
    );
    setState("ready");
  }

  useEffect(() => {
    void loadTalkConsent()
      .then(async (consent) => {
        setDisclosureVersion(consent.disclosureVersion);
        if (consent.confirmed) await open();
        else setState("consent");
      })
      .catch(() => setState("signed-out"));
  }, []);

  return (
    <div className="quiet-page muse-talk-page" id="main-content">
      <section className="capture-introduction archive-card">
        <h1>{t("Talk with Muse")}</h1>
        {error && <p role="alert">{notice(error)}</p>}
        {state === "loading" && <p role="status">{t("Opening your conversation…")}</p>}
        {state === "signed-out" && (
          <p>
            {t("Sign in to talk with Muse about your stories.")} <Link to="/archive">{t("Open your archive")}</Link>
          </p>
        )}
        {state === "consent" && (
          <TalkConsentCard
            onConfirm={async () => {
              setError(null);
              try {
                await confirmTalkConsent(disclosureVersion);
                await open();
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Muse could not answer right now. Your words are safe. Please try again.");
              }
            }}
          />
        )}
        {state === "ready" && talk && (
          <Conversation
            talk={talk}
            onChange={setTalk}
            onError={setError}
            onDeleted={async () => {
              setTalk(await startTalk());
            }}
          />
        )}
        <Link className="secondary-action" to="/archive">
          {t("Back to your Living Memories")}
        </Link>
      </section>
    </div>
  );
}

function TalkConsentCard({ onConfirm }: { readonly onConfirm: () => Promise<void> }) {
  useLocale();
  const [adult, setAdult] = useState(false),
    [understandsAi, setUnderstandsAi] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="muse-talk-consent"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void onConfirm().finally(() => setBusy(false));
      }}
    >
      <p>
        {t(
          "Muse is an AI that helps you remember and tell your stories. It is not a person and cannot give advice. What you say stays private unless you choose to share it, and you can delete a conversation at any time.",
        )}
      </p>
      <label>
        <input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /> {t("I am 18 or older.")}
      </label>
      <label>
        <input type="checkbox" checked={understandsAi} onChange={(event) => setUnderstandsAi(event.target.checked)} />{" "}
        {t("I understand Muse is an AI, not a person.")}
      </label>
      <button className="primary-action" type="submit" disabled={!adult || !understandsAi || busy}>
        {t("Start talking with Muse")}
      </button>
    </form>
  );
}

function Conversation({
  talk,
  onChange,
  onError,
  onDeleted,
}: {
  readonly talk: Talk;
  readonly onChange: (talk: Talk) => void;
  readonly onError: (message: string | null) => void;
  readonly onDeleted: () => Promise<void>;
}) {
  useLocale();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    end = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    // Newer browsers return a promise from scrollIntoView; it must not become the effect's cleanup.
    void end.current?.scrollIntoView?.({ block: "nearest" });
  }, [talk.turns.length]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    onError(null);
    try {
      await work();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Muse could not answer right now. Your words are safe. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ol className="muse-talk-turns" aria-label={t("Conversation with Muse")} aria-live="polite">
        {talk.turns.map((turn) => (
          <li key={turn.turnId} className={turn.speaker === "muse" ? "muse-talk-muse" : "muse-talk-person"}>
            <strong>{turn.speaker === "muse" ? "Muse" : t("You")}</strong>
            <p>{turn.content}</p>
            {turn.support && <MuseSupportLines support={turn.support} />}
            {turn.kind === "family" && <Link to="/archive">{t("Choose a story to share")}</Link>}
          </li>
        ))}
        <li ref={end} aria-hidden="true" className="muse-talk-end" />
      </ol>
      <form
        className="muse-talk-reply"
        onSubmit={(event) => {
          event.preventDefault();
          const words = text.trim();
          if (!words) return;
          void run(async () => {
            onChange(await sendToMuse(talk, words));
            setText("");
          });
        }}
      >
        <label htmlFor="muse-talk-text">{t("Your words")}</label>
        <textarea id="muse-talk-text" rows={3} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} disabled={busy} />
        <button className="primary-action" type="submit" disabled={busy || !text.trim()}>
          {busy ? t("Muse is listening…") : t("Send to Muse")}
        </button>
      </form>
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            if (!window.confirm(t("Delete this conversation? Your Living Memories are not affected."))) return;
            await deleteTalk(talk.talkId);
            await onDeleted();
          })
        }
      >
        {t("Delete this conversation")}
      </button>
    </>
  );
}
