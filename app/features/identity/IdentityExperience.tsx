import { SignIn, SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { claimLocalDraft, openAccountSession } from "../../services/identity-api";
import { loadLocalDraft } from "../../services/local-draft-store";

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export function IdentityExperience() {
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draftId");

  if (!clerkConfigured) {
    return (
      <IdentityFrame>
        <p className="eyebrow">Your story is safe</p>
        <h1>Carry it with you.</h1>
        <p className="capture-lede">
          Sign-in is ready for Clerk configuration. Your photograph and voice remain safely preserved while this environment is connected.
        </p>
        {draftId && <Link className="secondary-action" to={`/capture/${encodeURIComponent(draftId)}`}>Return to your preserved story</Link>}
      </IdentityFrame>
    );
  }

  return (
    <IdentityFrame>
      <p className="eyebrow">Protected family archive</p>
      <h1>Your story, wherever you are.</h1>
      <p className="capture-lede">
        Sign in to protect this Memory Story and continue on your phone, tablet or computer.
      </p>
      <SignedOut>
        <SignIn routing="hash" />
      </SignedOut>
      <SignedIn>
        <BindIdentity draftId={draftId} />
      </SignedIn>
    </IdentityFrame>
  );
}

function BindIdentity({ draftId }: { readonly draftId: string | null }) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Opening your private archive…");

  useEffect(() => {
    let active = true;
    async function bind() {
      try {
        const token = await getToken();
        if (!token) throw new Error("Clerk did not provide a session token.");
        await openAccountSession(token);
        if (draftId) {
          const draft = await loadLocalDraft(draftId);
          if (!draft) throw new Error("This device no longer has the local claim key.");
          setMessage("Protecting your photograph and voice…");
          await claimLocalDraft(draft);
          if (active) await navigate(`/archive/${encodeURIComponent(draftId)}`, { replace: true });
        } else if (active) {
          await navigate("/archive", { replace: true });
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Your archive could not be opened.");
      }
    }
    void bind();
    return () => { active = false; };
  }, [draftId, getToken, navigate]);

  return <p className="preservation-status" role="status">{message}</p>;
}

function IdentityFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="quiet-page identity-page" id="main-content">
      <section className="capture-introduction identity-card">
        {children}
        <p className="privacy-promise">Private by default. Nothing is shared unless you choose.</p>
      </section>
    </div>
  );
}
