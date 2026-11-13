import { t, notice, useLocale, getLocale } from "../../localization/language";
import { useEffect, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { Link, useNavigate, useParams } from "react-router";

import {
  loadArchive,
  loadArchiveDraft,
  closeAccountSession,
  type ArchiveAsset,
  type ArchiveDraft
} from "../../services/identity-api";

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export function ArchiveExperience() {
  useLocale();
  const { draftId } = useParams();
  return draftId ? <ArchiveMemory draftId={draftId} /> : <ArchiveIndex />;
}

function ArchiveIndex() {
  useLocale();
  const [drafts, setDrafts] = useState<readonly ArchiveDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void loadArchive().then(setDrafts).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Your archive could not be opened.");
    });
  }, []);
  return (
    <div className="quiet-page archive-page" id="main-content">
      <section className="capture-introduction archive-card">
        <p className="eyebrow">{t("Your private family archive")}</p>
        <h1>{t("Your Living Memories")}</h1>
        {error && <ArchiveSignInMessage message={notice(error)} />}
        {drafts === null && !error && <p className="preservation-status" role="status">{t("Gathering your stories…")}</p>}
        {drafts?.length === 0 && <p className="capture-lede">{t("Your first protected Living Memory will appear here.")}</p>}
        {drafts && drafts.length > 0 && (
          <ul className="archive-list">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  to={`/memory/${encodeURIComponent(draft.id)}`}
                >
                  <strong>{draft.status === "complete" ? t("Living Memory") : t("Continue Living Memory")}</strong>
                  <span>{t("Protected")} {new Date(draft.updated_at).toLocaleDateString(getLocale())}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link className="secondary-action" to="/">{t("Capture another memory")}</Link>
        <AccountExit />
      </section>
    </div>
  );
}

function ArchiveMemory({ draftId }: { readonly draftId: string }) {
  useLocale();
  const [draft, setDraft] = useState<ArchiveDraft | null>(null);
  const [assets, setAssets] = useState<readonly ArchiveAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void loadArchiveDraft(draftId)
      .then((result) => { setDraft(result.draft); setAssets(result.assets); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "This story could not be opened."));
  }, [draftId]);
  const photo = assets.find((asset) => asset.role === "original_photo");
  const audio = assets.find((asset) => asset.role === "original_audio");
  return (
    <div className="quiet-page archive-page" id="main-content">
      <section className="capture-introduction archive-card">
        <p className="eyebrow">{t("Safe in your family archive")}</p>
        <h1>{t("We have your back.")}</h1>
        {error && <ArchiveSignInMessage message={notice(error)} draftId={draftId} />}
        {!draft && !error && <p className="preservation-status" role="status">{t("Opening your preserved story…")}</p>}
        {draft && (
          <>
            {photo && <div className="story-photo-focus"><img src={photo.mediaUrl} alt={t("Your privately preserved photograph")} /></div>}
            {audio && <audio className="voice-player" controls src={audio.mediaUrl}>{t("Your browser cannot play the preserved recording.")}</audio>}
            <div className="durable-status" role="status"><span aria-hidden="true">✓</span><div><strong>{t("Available across your devices")}</strong><p>{t("Your signed-in archive keeps the original photograph and voice together.")}</p></div></div>
          </>
        )}
        <Link className="secondary-action" to="/archive">{t("All Living Memories")}</Link>
        <AccountExit />
      </section>
    </div>
  );
}

function AccountExit() {
  useLocale();
  return clerkConfigured ? <ConfiguredAccountExit /> : null;
}

function ConfiguredAccountExit() {
  useLocale();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await closeAccountSession();
      await clerk.signOut();
      await navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  }
  return <button className="light-text-action" type="button" disabled={busy} onClick={() => void signOut()}>{busy ? t("Signing out…") : t("Sign out")}</button>;
}

function ArchiveSignInMessage({ message, draftId }: { readonly message: string; readonly draftId?: string }) {
  useLocale();
  const target = draftId ? `/auth/protect?draftId=${encodeURIComponent(draftId)}` : "/auth/protect";
  return <><p className="inline-error" role="alert">{notice(message)}</p><Link className="primary-action" to={target}>{t("Sign in to your archive")}</Link></>;
}
