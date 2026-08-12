export type StripeClientEnv = {
  readonly STRIPE_SECRET_KEY?: string;
};

export type StripeCheckoutSession = {
  readonly id: string;
  readonly client_secret: string | null;
  readonly payment_status: "paid" | "unpaid" | "no_payment_required";
  readonly status: "open" | "complete" | "expired" | null;
  readonly payment_intent: string | null;
  readonly customer: string | null;
  readonly amount_total: number | null;
  readonly currency: string | null;
  readonly metadata: Record<string, string>;
};

export type CreateEmbeddedCheckoutInput = {
  readonly priceId: string;
  readonly returnUrl: string;
  readonly orderId: string;
  readonly accountId: string;
  readonly offerId: string;
  readonly idempotencyKey: string;
  readonly customerEmail?: string | null;
};

export class StripeClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly stripeCode?: string
  ) {
    super(message);
  }
}

function secretKey(env: StripeClientEnv): string {
  const key = env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) {
    throw new StripeClientError("Stripe is not configured in this environment.", 503, "stripe_unconfigured");
  }
  return key;
}

async function stripeRequest<T>(
  env: StripeClientEnv,
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey(env)}`,
      ...init.headers
    }
  });

  const body = await response.json().catch(() => null) as
    | T
    | { error?: { message?: string; code?: string } }
    | null;

  if (!response.ok) {
    const stripeError = body && typeof body === "object" && "error" in body ? body.error : undefined;
    throw new StripeClientError(
      stripeError?.message ?? "Stripe could not complete the request.",
      response.status,
      stripeError?.code
    );
  }
  return body as T;
}

export async function createEmbeddedCheckoutSession(
  env: StripeClientEnv,
  input: CreateEmbeddedCheckoutInput
): Promise<StripeCheckoutSession> {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("ui_mode", "embedded");
  params.set("redirect_on_completion", "always");
  params.set("customer_creation", "always");
  params.set("line_items[0][price]", input.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("return_url", input.returnUrl);
  params.set("metadata[order_id]", input.orderId);
  params.set("metadata[account_id]", input.accountId);
  params.set("metadata[offer_id]", input.offerId);
  if (input.customerEmail) params.set("customer_email", input.customerEmail);

  return stripeRequest<StripeCheckoutSession>(env, "/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey
    },
    body: params
  });
}

export async function retrieveCheckoutSession(
  env: StripeClientEnv,
  sessionId: string
): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    env,
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET" }
  );
}
