import { Navigate, Link, useParams } from "react-router";
import { useAuth } from "@clerk/clerk-react";

import { isOfferId, livingMemoryOffers } from "./offers";

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export function CheckoutExperience() {
  const { offerId } = useParams();

  if (!isOfferId(offerId)) {
    return <Navigate to="/#pricing" replace />;
  }

  if (!clerkConfigured) {
    return <CheckoutFrame offerId={offerId} identityReady={false} />;
  }

  return <ProtectedCheckout offerId={offerId} />;
}

function ProtectedCheckout({ offerId }: { readonly offerId: keyof typeof livingMemoryOffers }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <main className="journey-page" id="main-content">
        <section className="journey-card"><p className="journey-status">Opening your secure checkout…</p></section>
      </main>
    );
  }

  if (!isSignedIn) {
    return <Navigate to={`/auth/protect?intent=checkout&offer=${offerId}`} replace />;
  }

  return <CheckoutFrame offerId={offerId} identityReady />;
}

function CheckoutFrame({ offerId, identityReady }: { readonly offerId: keyof typeof livingMemoryOffers; readonly identityReady: boolean }) {
  const offer = livingMemoryOffers[offerId];

  return (
    <main className="journey-page" id="main-content">
      <section className="checkout-layout" aria-labelledby="checkout-title">
        <div className="checkout-main">
          <p className="lm-eyebrow">Secure checkout</p>
          <h1 id="checkout-title">{offer.outcome}</h1>
          <p className="journey-lede">{offer.shortDescription}</p>

          <div className="checkout-order-card">
            <div className="checkout-order-heading">
              <div>
                <span className="checkout-plan-name">{offer.name}</span>
                <strong>{offer.priceLabel}</strong>
              </div>
              <span>one-time</span>
            </div>
            <ul>
              {offer.primaryBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
            </ul>
          </div>

          <section className="checkout-payment-panel" aria-labelledby="payment-title">
            <h2 id="payment-title">Payment</h2>
            <p>
              This page is ready for the Stripe payment connection, but this branch does not yet contain a Stripe checkout service. We will not collect card details in an unconnected form.
            </p>
            <button className="lm-primary-button checkout-disabled" type="button" disabled>
              Secure payment connection coming next
            </button>
            {!identityReady && (
              <p className="checkout-note">
                Clerk is not configured in this environment. In staging or production, a signed-in session is required before this page opens.
              </p>
            )}
          </section>
        </div>

        <aside className="checkout-summary" aria-label="Purchase summary">
          <p className="lm-eyebrow">Your selection</p>
          <h2>{offer.name}</h2>
          <p>{offer.outcome}</p>
          {offer.includesMemoryCircle && <p className="checkout-memory-circle">Includes live Memory Circle</p>}
          <div className="checkout-total"><span>Total</span><strong>{offer.priceLabel}</strong></div>
          <p className="checkout-trust">One-time price. Final fulfillment claims remain gated until the matching capability is acceptance-tested.</p>
          <Link className="lm-text-link" to="/#pricing">Choose a different plan</Link>
        </aside>
      </section>
    </main>
  );
}

export function ThankYouExperience() {
  const { offerId } = useParams();
  const offer = isOfferId(offerId) ? livingMemoryOffers[offerId] : null;

  return (
    <main className="journey-page" id="main-content">
      <section className="thank-you-card" aria-labelledby="thank-you-title">
        <span className="thank-you-mark" aria-hidden="true">♥</span>
        <p className="lm-eyebrow">Thank you</p>
        <h1 id="thank-you-title">Your family's next chapter starts with one story.</h1>
        <p className="journey-lede">
          {offer
            ? `When payment for ${offer.name} is confirmed, this page becomes the handoff into your Living Memory Archive.`
            : "When a purchase is confirmed, this page becomes the handoff into your Living Memory Archive."}
        </p>
        <div className="lm-action-row lm-action-row-center">
          <Link className="lm-primary-button" to="/create">Create a Living Memory</Link>
          <Link className="lm-secondary-button" to="/archive">Open My Archive</Link>
        </div>
        <p className="lm-trust-line">The same photo-first, voice-first experience continues from here.</p>
      </section>
    </main>
  );
}
