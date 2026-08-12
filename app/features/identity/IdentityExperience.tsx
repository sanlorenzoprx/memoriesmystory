import { SignIn, SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { isOfferId, livingMemoryOffers, type OfferId } from "../commerce/offers";
import { claimLocalDraft, openAccountSession } from "../../services/identity-api";
import { loadLocalDraft } from "../../services/local-draft-store";

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

type IdentityIntent = "free" | "checkout" | "archive";

function intentFrom(value: string | null): IdentityIntent {
  if (value === "free" || value === "checkout") return value;
  return "archive";
}

export function IdentityExperience() {
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draftId");
  const intent = intentFrom(searchParams.get("intent"));
  const offerParam = searchParams.get("offer");
  const offerId: OfferId | null = isOfferId(offerParam) ? offerParam : null;
  const copy = useMemo(() => identityCopy(intent, offerId), [intent, offerId]);

  if (!clerkConfigured) {
    const localDestination = intent === "checkout" && offerId
      ? `/checkout/${offerId}`
      : intent === "free"
        ? "/create"
        : draftId
          ? `/capture/${encodeURIComponent(draftId)}`
          : "/archive";

    return (
      <main className="identity-journey" id="main-content">
        <section className="identity-layout" aria-labelledby="identity-title">
          <IdentityStoryPanel title={copy.title} body={copy.body} />
          <div className="identity-card-v2">
            <p className="lm-eyebrow">Sign in</p>
            <h1 id="identity-title">{copy.cardTitle}</h1>
            <p>{copy.cardBody}</p>
            <div className="identity-local-state">
              <strong>Identity is ready for Clerk configuration.</strong>
              <span>This environment does not have a Clerk publishable key, so no real sign-in form can be shown here.</span>
            </div>
            <Link className="lm-primary-button" to={localDestination}>Continue in this local environment</Link>
            <p className="identity-privacy">Private first. Nothing is shared unless you choose.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="identity-journey" id="main-content">
      <section className="identity-layout" aria-labelledby="identity-title">
        <IdentityStoryPanel title={copy.title} body={copy.body} />
        <div className="identity-card-v2">
          <p className="lm-eyebrow">Sign in</p>
          <h1 id="identity-title">{copy.cardTitle}</h1>
          <p>{copy.cardBody}</p>
          <SignedOut>
            <SignIn
              routing="hash"
              appearance={{
                variables: {
                  colorPrimary: "#c8893b",
                  colorText: "#102a43",
                  colorBackground: "#fffaf3",
                  borderRadius: "14px",
                  fontFamily: '"Avenir Next", Avenir, Inter, ui-sans-serif, system-ui, sans-serif'
                },
                elements: {
                  card: "clerk-brand-card",
                  headerTitle: "clerk-brand-title",
                  headerSubtitle: "clerk-brand-subtitle",
                  formButtonPrimary: "clerk-brand-button",
                  footerActionLink: "clerk-brand-link"
                }
              }}
            />
          </SignedOut>
          <SignedIn>
            <BindIdentity draftId={draftId} intent={intent} offerId={offerId} />
          </SignedIn>
          <p className="identity-privacy">Private first. Nothing is shared unless you choose.</p>
        </div>
      </section>
    </main>
  );
}

function BindIdentity({
  draftId,
  intent,
  offerId
}: {
  readonly draftId: string | null;
  readonly intent: IdentityIntent;
  readonly offerId: OfferId | null;
}) {
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
          return;
        }

        if (!active) return;
        if (intent === "free") {
          await navigate("/create", { replace: true });
          return;
        }
        if (intent === "checkout" && offerId) {
          await navigate(`/checkout/${offerId}`, { replace: true });
          return;
        }
        await navigate("/archive", { replace: true });
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Your archive could not be opened.");
      }
    }

    void bind();
    return () => { active = false; };
  }, [draftId, getToken, intent, navigate, offerId]);

  return <p className="preservation-status" role="status">{message}</p>;
}

function IdentityStoryPanel({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <aside className="identity-story-panel">
      <div className="identity-photo" aria-hidden="true">
        <span className="identity-photo-person one" />
        <span className="identity-photo-person two" />
      </div>
      <p className="lm-eyebrow">Your family's stories stay with you</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="identity-benefits">
        <span>Continue across phone, tablet, or computer.</span>
        <span>Keep your first Living Memory tied to your account.</span>
        <span>Return to the same calm, photo-first experience after sign-in.</span>
      </div>
    </aside>
  );
}

function identityCopy(intent: IdentityIntent, offerId: OfferId | null) {
  if (intent === "free") {
    return {
      title: "One sign-in keeps the story connected to you.",
      body: "After sign-in, you return directly to the photograph. No detour. No need to choose the free offer again.",
      cardTitle: "Let's begin with one photograph.",
      cardBody: "Sign in so your first free Living Memory can stay with you across devices."
    };
  }

  if (intent === "checkout" && offerId) {
    const offer = livingMemoryOffers[offerId];
    return {
      title: "Keep your place while you sign in.",
      body: `You chose ${offer.name}. After sign-in, you go directly to the ${offer.name} checkout page.`,
      cardTitle: `Continue with ${offer.name}.`,
      cardBody: "Sign in to protect your purchase and connect it to the correct Family Archive."
    };
  }

  return {
    title: "Your story, wherever you are.",
    body: "Sign in once, then continue your Living Memories across the devices your family actually uses.",
    cardTitle: "Open your private Family Archive.",
    cardBody: "Sign in to continue where you left off."
  };
}
