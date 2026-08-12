import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, Link, useParams, useSearchParams } from "react-router";

import {
  createCheckoutSession,
  getCheckoutStatus,
  type CheckoutStatusResponse
} from "../../services/commerce-api";
import { mountEmbeddedCheckout } from "../../services/stripe-embedded";
import { isOfferId, livingMemoryOffers, type OfferId } from "./offers";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
const clerkConfigured = Boolean(clerkPublishableKey);
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripeConfigured = /^pk_(test|live)_/.test(stripePublishableKey);

export function CheckoutExperience() {
  const { offerId } = useParams();

  if (!isOfferId(offerId)) {
    return <Navigate to="/#pricing" replace />;
  }

  if (!clerkConfigured) {
    return <CheckoutFrame offerId={offerId} paymentReady={false} />;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ProtectedCheckout offerId={offerId} />
    </ClerkProvider>
  );
}

function ProtectedCheckout({ offerId }: { readonly offerId: OfferId }) {
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

  return <CheckoutFrame offerId={offerId} paymentReady={stripeConfigured} />;
}

function CheckoutFrame({ offerId, paymentReady }: { readonly offerId: OfferId; readonly paymentReady: boolean }) {
  const offer = livingMemoryOffers[offerId];
  const mountRef = useRef<HTMLDivElement>(null);
  const attemptIdRef = useRef(`checkout_${crypto.randomUUID()}`);
  const [paymentState, setPaymentState] = useState<"idle" | "opening" | "ready" | "error">("idle");
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentReady || !mountRef.current) return;
    let active = true;
    let embedded: Awaited<ReturnType<typeof mountEmbeddedCheckout>> | null = null;

    async function openCheckout() {
      setPaymentState("opening");
      setPaymentMessage(null);
      try {
        const checkout = await createCheckoutSession(offerId, attemptIdRef.current);
        if (!active || !mountRef.current) return;
        embedded = await mountEmbeddedCheckout({
          publishableKey: stripePublishableKey,
          clientSecret: checkout.clientSecret,
          target: mountRef.current,
          onComplete: () => {
            if (active) setPaymentMessage("Payment received. Opening your confirmation…");
          }
        });
        if (active) setPaymentState("ready");
      } catch (error) {
        if (!active) return;
        setPaymentState("error");
        setPaymentMessage(error instanceof Error ? error.message : "Secure checkout could not be opened.");
      }
    }

    void openCheckout();
    return () => {
      active = false;
      embedded?.destroy();
    };
  }, [offerId, paymentReady]);

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
            {paymentReady ? (
              <>
                {paymentState === "opening" && <p className="journey-status" role="status">Opening Stripe's secure payment form…</p>}
                {paymentState === "error" && (
                  <div className="checkout-payment-error" role="alert">
                    <p>{paymentMessage}</p>
                    <button className="lm-secondary-button" type="button" onClick={() => window.location.reload()}>
                      Try secure checkout again
                    </button>
                  </div>
                )}
                {paymentMessage && paymentState !== "error" && <p className="journey-status" role="status">{paymentMessage}</p>}
                <div
                  className="stripe-embedded-checkout"
                  ref={mountRef}
                  aria-label="Stripe secure payment form"
                />
                <p className="checkout-note">Your payment details are handled securely by Stripe. MemoriesMyStory does not receive or store your card number.</p>
              </>
            ) : (
              <div className="checkout-configuration-note" role="status">
                <strong>Secure payment is ready for Stripe staging configuration.</strong>
                <p>This environment does not have the Stripe publishable key and signed-in staging session required to show a real payment form. No card details are collected here.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="checkout-summary" aria-label="Purchase summary">
          <p className="lm-eyebrow">Your selection</p>
          <h2>{offer.name}</h2>
          <p>{offer.outcome}</p>
          {offer.includesMemoryCircle && <p className="checkout-memory-circle">Includes Memory Circle</p>}
          <div className="checkout-total"><span>Total</span><strong>{offer.priceLabel}</strong></div>
          <p className="checkout-trust">One-time price. Access is activated only after Stripe confirms payment.</p>
          <Link className="lm-text-link" to="/#pricing">Choose a different plan</Link>
        </aside>
      </section>
    </main>
  );
}

export function ThankYouExperience() {
  const { offerId } = useParams();
  const offer = isOfferId(offerId) ? livingMemoryOffers[offerId] : null;

  if (!offer) return <Navigate to="/" replace />;
  if (!clerkConfigured) return <UnverifiedThankYou offerId={offer.id} />;

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ProtectedThankYou offerId={offer.id} />
    </ClerkProvider>
  );
}

function ProtectedThankYou({ offerId }: { readonly offerId: OfferId }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return <ThankYouFrame offerId={offerId} state="checking" status={null} message={null} />;
  }
  if (!isSignedIn) {
    return <Navigate to={`/auth/protect?intent=checkout&offer=${offerId}`} replace />;
  }
  return <VerifiedThankYou offerId={offerId} />;
}

function VerifiedThankYou({ offerId }: { readonly offerId: OfferId }) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<"checking" | "processing" | "completed" | "failed">(
    sessionId ? "checking" : "failed"
  );
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);
  const [message, setMessage] = useState<string | null>(
    sessionId ? null : "This confirmation link does not include a Stripe Checkout Session."
  );

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    let retryTimer: number | null = null;
    let attempts = 0;

    async function check() {
      attempts += 1;
      try {
        const next = await getCheckoutStatus(sessionId);
        if (!active) return;
        setStatus(next);
        setMessage(null);
        setState(next.state);
        if (next.state === "processing" && attempts < 8) {
          retryTimer = window.setTimeout(() => void check(), 1500);
        }
      } catch (error) {
        if (!active) return;
        setState("failed");
        setMessage(error instanceof Error ? error.message : "Payment status could not be verified.");
      }
    }

    void check();
    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [sessionId]);

  return <ThankYouFrame offerId={offerId} state={state} status={status} message={message} />;
}

function UnverifiedThankYou({ offerId }: { readonly offerId: OfferId }) {
  return (
    <ThankYouFrame
      offerId={offerId}
      state="failed"
      status={null}
      message="This local environment cannot verify a Stripe payment. Purchased access is never granted from the page address alone."
    />
  );
}

function ThankYouFrame({
  offerId,
  state,
  status,
  message
}: {
  readonly offerId: OfferId;
  readonly state: "checking" | "processing" | "completed" | "failed";
  readonly status: CheckoutStatusResponse | null;
  readonly message: string | null;
}) {
  const offer = livingMemoryOffers[offerId];

  if (state === "completed" && status?.entitlement) {
    return (
      <main className="journey-page" id="main-content">
        <section className="thank-you-card" aria-labelledby="thank-you-title">
          <span className="thank-you-mark" aria-hidden="true">♥</span>
          <p className="lm-eyebrow">{offer.name} is ready</p>
          <h1 id="thank-you-title">You've made room for more of the story.</h1>
          <p className="journey-lede">Your {offer.name} is connected to your Family Archive. Start with the photograph you've been thinking about.</p>
          <div className="lm-action-row lm-action-row-center">
            <Link className="lm-primary-button" to="/create">Create a Living Memory</Link>
            <Link className="lm-secondary-button" to="/archive">Open My Family Archive</Link>
          </div>
          <p className="lm-trust-line">Payment verified. Access granted to this signed-in account.</p>
        </section>
      </main>
    );
  }

  if (state === "checking" || state === "processing") {
    return (
      <main className="journey-page" id="main-content">
        <section className="thank-you-card" aria-labelledby="thank-you-title">
          <span className="soft-loader" aria-hidden="true" />
          <p className="lm-eyebrow">Payment received</p>
          <h1 id="thank-you-title">We're finishing your {offer.name}.</h1>
          <p className="journey-lede">Stripe is confirming the payment and connecting your purchase to your Family Archive.</p>
          <p className="lm-trust-line" role="status">You do not need to purchase again.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="journey-page" id="main-content">
      <section className="thank-you-card" aria-labelledby="thank-you-title">
        <p className="lm-eyebrow">Payment not activated</p>
        <h1 id="thank-you-title">Your {offer.name} has not been activated yet.</h1>
        <p className="journey-lede">{message ?? "We could not confirm paid access for this checkout."}</p>
        <div className="lm-action-row lm-action-row-center">
          <Link className="lm-primary-button" to={`/checkout/${offerId}`}>Return to secure checkout</Link>
          <Link className="lm-secondary-button" to="/archive">Open My Family Archive</Link>
        </div>
        <p className="lm-trust-line">A browser return page never grants paid access by itself.</p>
      </section>
    </main>
  );
}
