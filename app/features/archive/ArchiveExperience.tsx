import { useEffect, useState } from "react";
import { ClerkProvider, useClerk } from "@clerk/clerk-react";
import { Link, useNavigate, useParams } from "react-router";

import {
  loadArchive,
  loadArchiveDraft,
  closeAccountSession,
  type ArchiveAsset,
  type ArchiveDraft
} from "../../services/identity-api";
import "../../styles/living-memory-runtime.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(clerkPublishableKey);

export function ArchiveExperience() {
  if (!clerkPublishableKey) return <ArchiveContent />;

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ArchiveContent />
    </ClerkProvider>
  );
}

function ArchiveContent() {
  const { draftId } = useParams();
  return draftId ? <ArchiveMemory draftId={draftId} /> : <ArchiveIndex />;
}

function ArchiveIndex() {
  const [drafts, setDrafts] = useState<readonly ArchiveDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadArchive().then(setDrafts).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Your archive could not be opened.");
    });
  }, []);

  return (
    <main className="archive-page" id="main-content">
      <section className="archive-card">
        <p className="eyebrow">Your private Family Archive</p>
        <h1>Your Living Memories</h1>
        {error && <ArchiveSignInMessage message={error} />}
        {drafts === null && !error && (
          <p className="preservation-status" role="status">Gathering your Living Memories…</p>
        )}
        {drafts?.length === 0 && (
          <p className="capture-lede">Your first protected Living Memory will appear here.</p>
        )}
        {drafts && drafts.length > 0 && (
          <ul className="archive-list">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link to={`/archive/${encodeURIComponent(draft.id)}`}>
                  <strong>Photograph and original voice</strong>
                  <span>Protected {new Date(draft.updated_at).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link className="secondary-action" to="/create">Create another Living Memory</Link>
        <AccountExit />
      </section>
    </main>
  );
}

function ArchiveMemory({ draftId }: { readonly draftId: string }) {
  const [draft, setDraft] = useState<ArchiveDraft | null>(null);
  const [assets, setAssets] = useState<readonly ArchiveAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadArchiveDraft(draftId)
      .then((result) => {
        setDraft(result.draft);
        setAssets(result.assets);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "This Living Memory could not be opened.");
      });
  }, [draftId]);

  const photo = assets.find((asset) => asset.role === "original_photo");
  const audio = assets.find((asset) => asset.role === "original_audio");

  return (
    <main className="archive-page" id="main-content">
      <section className="archive-card">
        <p className="eyebrow">Safe in your Family Archive</p>
        <h1>Your Living Memory is here.</h1>
        {error && <ArchiveSignInMessage message={error} draftId={draftId} />}
        {!draft && !error && (
          <p className="preservation-status" role="status">Opening your preserved Living Memory…</p>
        )}
        {draft && (
          <>
            {photo && (
              <div className="story-photo-focus">
                <img src={photo.mediaUrl} alt="Your privately preserved photograph" />
              </div>
            )}
            {audio && (
              <audio className="voice-player" controls src={audio.mediaUrl}>
                Your browser cannot play the preserved recording.
              </audio>
            )}
            <div className="durable-status" role="status">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Available across your devices</strong>
                <p>Your signed-in Family Archive keeps the original photograph and voice together.</p>
              </div>
            </div>
          </>
        )}
        <Link className="secondary-action" to="/archive">All Living Memories</Link>
        <AccountExit />
      </section>
    </main>
  );
}

function AccountExit() {
  return clerkConfigured ? <ConfiguredAccountExit /> : null;
}

function ConfiguredAccountExit() {
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

  return (
    <button className="light-text-action" type="button" disabled={busy} onClick={() => void signOut()}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

function ArchiveSignInMessage({
  message,
  draftId
}: {
  readonly message: string;
  readonly draftId?: string;
}) {
  const target = draftId
    ? `/auth/protect?intent=archive&draftId=${encodeURIComponent(draftId)}`
    : "/auth/protect?intent=archive";

  return (
    <>
      <p className="inline-error" role="alert">{message}</p>
      <Link className="primary-action" to={target}>Sign in to your Family Archive</Link>
    </>
  );
}
