import "../styles/commerce.css";

type EmbeddedCheckout = {
  mount(location: HTMLElement | string): void;
  unmount(): void;
  destroy(): void;
};

type StripeInstance = {
  createEmbeddedCheckoutPage(options: {
    clientSecret?: string;
    fetchClientSecret?: () => Promise<string>;
    onComplete?: () => void;
  }): Promise<EmbeddedCheckout>;
};

type StripeFactory = (publishableKey: string) => StripeInstance;

declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

const stripeScriptUrl = "https://js.stripe.com/dahlia/stripe.js";
let stripeScriptPromise: Promise<void> | null = null;

function loadStripeScript(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  if (stripeScriptPromise) return stripeScriptPromise;

  stripeScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${stripeScriptUrl}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Stripe.js could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = stripeScriptUrl;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Stripe.js could not be loaded.")), { once: true });
    document.head.append(script);
  }).then(() => {
    if (!window.Stripe) throw new Error("Stripe.js loaded without exposing Stripe.");
  });

  return stripeScriptPromise;
}

export async function mountEmbeddedCheckout(options: {
  readonly publishableKey: string;
  readonly clientSecret: string;
  readonly target: HTMLElement;
  readonly onComplete?: () => void;
}): Promise<EmbeddedCheckout> {
  if (!/^pk_(test|live)_/.test(options.publishableKey)) {
    throw new Error("The Stripe publishable key is not configured correctly.");
  }
  await loadStripeScript();
  const stripe = window.Stripe?.(options.publishableKey);
  if (!stripe) throw new Error("Stripe could not be initialized.");

  const checkout = await stripe.createEmbeddedCheckoutPage({
    clientSecret: options.clientSecret,
    onComplete: options.onComplete
  });
  checkout.mount(options.target);
  return checkout;
}
