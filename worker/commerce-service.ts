import { authenticateAppSession, type AuthSessionEnv } from "./auth-session";
import {
  commerceOffers,
  isCommerceOfferId,
  stripePriceIdForOffer,
  type CommerceCatalogEnv,
  type CommerceOfferId
} from "./commerce-catalog";
import { fulfillCheckoutSession } from "./commerce-fulfillment";
import { activeEntitlementsForAccount, entitlementForOrder } from "./entitlement-service";
import {
  createEmbeddedCheckoutSession,
  retrieveCheckoutSession,
  type StripeCheckoutSession,
  type StripeClientEnv
} from "./stripe-client";

export type CommerceServiceEnv = AuthSessionEnv & CommerceCatalogEnv & StripeClientEnv & {
  readonly MEMORIES_PUBLIC_ORIGIN?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
};

export class CommerceServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

type CheckoutBody = {
  readonly offerId?: unknown;
  readonly attemptId?: unknown;
};

type OrderRow = {
  readonly id: string;
  readonly account_id: string;
  readonly offer_id: CommerceOfferId;
  readonly stripe_checkout_session_id: string | null;
  readonly amount_total: number;
  readonly currency: string;
  readonly status: string;
  readonly idempotency_key: string;
};

type CheckoutStatusRow = {
  readonly id: string;
  readonly account_id: string;
  readonly offer_id: CommerceOfferId;
  readonly stripe_checkout_session_id: string;
  readonly status: "created" | "checkout_open" | "paid" | "fulfilled" | "expired" | "payment_failed" | "refunded";
  readonly paid_at: string | null;
  readonly fulfilled_at: string | null;
};

export type StripeCheckoutGateway = {
  create(env: StripeClientEnv, input: Parameters<typeof createEmbeddedCheckoutSession>[1]): Promise<StripeCheckoutSession>;
  retrieve(env: StripeClientEnv, sessionId: string): Promise<StripeCheckoutSession>;
};

const defaultStripeGateway: StripeCheckoutGateway = {
  create: createEmbeddedCheckoutSession,
  retrieve: retrieveCheckoutSession
};

const attemptPattern = /^checkout_[A-Za-z0-9-]{16,120}$/;
const checkoutSessionPattern = /^cs_[A-Za-z0-9_]+$/;

function assertMutationRequest(request: Request): void {
  if (request.headers.get("X-Memories-Request") !== "commerce-v1") {
    throw new CommerceServiceError(403, "The checkout request could not be verified.", "csrf");
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new CommerceServiceError(403, "The checkout origin is not allowed.", "origin");
  }
}

async function requireAccountSession(request: Request, env: CommerceServiceEnv) {
  const session = await authenticateAppSession(request, env);
  if (!session) {
    throw new CommerceServiceError(401, "Sign in is required.", "session_required");
  }
  return session;
}

function publicOrigin(request: Request, env: CommerceServiceEnv): string {
  const configured = env.MEMORIES_PUBLIC_ORIGIN?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new CommerceServiceError(503, "The public application origin is invalid.", "origin_config");
    }
    return url.origin;
  }
  return new URL(request.url).origin;
}

async function accountEmail(env: CommerceServiceEnv, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(accountId)
    .first<{ email: string | null }>();
  return row?.email ?? null;
}

async function existingOrder(env: CommerceServiceEnv, attemptId: string): Promise<OrderRow | null> {
  return env.DB.prepare(
    `SELECT id, account_id, offer_id, stripe_checkout_session_id, amount_total, currency, status, idempotency_key
     FROM commerce_orders WHERE idempotency_key = ?`
  ).bind(attemptId).first<OrderRow>();
}

export async function createCheckoutForRequest(
  request: Request,
  env: CommerceServiceEnv,
  stripe: StripeCheckoutGateway = defaultStripeGateway
): Promise<{
  readonly orderId: string;
  readonly offerId: CommerceOfferId;
  readonly sessionId: string;
  readonly clientSecret: string;
  readonly amountTotal: number;
  readonly currency: string;
  readonly replayed: boolean;
}> {
  assertMutationRequest(request);
  const session = await requireAccountSession(request, env);

  const body = await request.json().catch(() => null) as CheckoutBody | null;
  if (!body || !isCommerceOfferId(body.offerId)) {
    throw new CommerceServiceError(400, "Choose a valid Memories: My Story offer.", "invalid_offer");
  }
  if (typeof body.attemptId !== "string" || !attemptPattern.test(body.attemptId)) {
    throw new CommerceServiceError(400, "The checkout attempt is invalid.", "invalid_attempt");
  }

  const offer = commerceOffers[body.offerId];
  let order = await existingOrder(env, body.attemptId);
  let replayed = Boolean(order);

  if (order) {
    if (order.account_id !== session.userId || order.offer_id !== body.offerId) {
      throw new CommerceServiceError(409, "That checkout attempt belongs to another purchase.", "attempt_conflict");
    }
    if (order.stripe_checkout_session_id) {
      const stripeSession = await stripe.retrieve(env, order.stripe_checkout_session_id);
      if (!stripeSession.client_secret) {
        throw new CommerceServiceError(409, "That checkout can no longer be resumed.", "checkout_not_resumable");
      }
      return {
        orderId: order.id,
        offerId: order.offer_id,
        sessionId: stripeSession.id,
        clientSecret: stripeSession.client_secret,
        amountTotal: order.amount_total,
        currency: order.currency,
        replayed: true
      };
    }
  } else {
    const now = new Date().toISOString();
    const orderId = `order_${crypto.randomUUID()}`;
    try {
      await env.DB.prepare(
        `INSERT INTO commerce_orders (
          id, account_id, offer_id, amount_total, currency, status,
          idempotency_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'created', ?, ?, ?)`
      ).bind(
        orderId,
        session.userId,
        offer.id,
        offer.amountTotal,
        offer.currency,
        body.attemptId,
        now,
        now
      ).run();
    } catch {
      order = await existingOrder(env, body.attemptId);
      if (!order || order.account_id !== session.userId || order.offer_id !== body.offerId) {
        throw new CommerceServiceError(409, "The checkout changed while it was opening. Retry safely.", "checkout_conflict");
      }
      replayed = true;
    }
    order ??= await existingOrder(env, body.attemptId);
  }

  if (!order) {
    throw new CommerceServiceError(500, "The checkout order could not be prepared.", "order_missing");
  }

  const priceId = stripePriceIdForOffer(env, offer.id);
  const returnUrl = `${publicOrigin(request, env)}/thank-you/${offer.id}?session_id={CHECKOUT_SESSION_ID}`;
  const stripeSession = await stripe.create(env, {
    priceId,
    returnUrl,
    orderId: order.id,
    accountId: session.userId,
    offerId: offer.id,
    idempotencyKey: `memoriesmystory:${order.id}`,
    customerEmail: await accountEmail(env, session.userId)
  });

  if (!stripeSession.client_secret) {
    throw new CommerceServiceError(502, "Stripe did not return an embedded checkout secret.", "stripe_client_secret");
  }
  if (stripeSession.amount_total !== null && stripeSession.amount_total !== offer.amountTotal) {
    throw new CommerceServiceError(502, "Stripe returned an unexpected checkout amount.", "stripe_amount_mismatch");
  }
  if (stripeSession.currency && stripeSession.currency.toLowerCase() !== offer.currency) {
    throw new CommerceServiceError(502, "Stripe returned an unexpected checkout currency.", "stripe_currency_mismatch");
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE commerce_orders
     SET stripe_checkout_session_id = ?, stripe_customer_id = ?, status = 'checkout_open', updated_at = ?
     WHERE id = ? AND stripe_checkout_session_id IS NULL`
  ).bind(stripeSession.id, stripeSession.customer, now, order.id).run();

  return {
    orderId: order.id,
    offerId: offer.id,
    sessionId: stripeSession.id,
    clientSecret: stripeSession.client_secret,
    amountTotal: offer.amountTotal,
    currency: offer.currency,
    replayed
  };
}

export async function checkoutStatusForRequest(
  request: Request,
  env: CommerceServiceEnv,
  stripe: Pick<StripeCheckoutGateway, "retrieve"> = defaultStripeGateway
) {
  const session = await requireAccountSession(request, env);
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !checkoutSessionPattern.test(sessionId)) {
    throw new CommerceServiceError(400, "The checkout session is invalid.", "invalid_session");
  }

  let order = await env.DB.prepare(
    `SELECT id, account_id, offer_id, stripe_checkout_session_id, status, paid_at, fulfilled_at
     FROM commerce_orders WHERE stripe_checkout_session_id = ? AND account_id = ?`
  ).bind(sessionId, session.userId).first<CheckoutStatusRow>();
  if (!order) {
    throw new CommerceServiceError(404, "That checkout was not found for this account.", "checkout_not_found");
  }

  if (order.status !== "fulfilled" && order.status !== "expired" &&
      order.status !== "payment_failed" && order.status !== "refunded") {
    try {
      await fulfillCheckoutSession(env, sessionId, stripe);
    } catch (error) {
      throw new CommerceServiceError(
        502,
        error instanceof Error ? error.message : "Stripe payment status could not be verified.",
        "stripe_status"
      );
    }
    order = await env.DB.prepare(
      `SELECT id, account_id, offer_id, stripe_checkout_session_id, status, paid_at, fulfilled_at
       FROM commerce_orders WHERE id = ?`
    ).bind(order.id).first<CheckoutStatusRow>();
    if (!order) throw new CommerceServiceError(500, "The checkout order disappeared.", "order_missing");
  }

  const grant = await entitlementForOrder(env, order.id);
  const state = order.status === "fulfilled" && grant
    ? "completed"
    : order.status === "expired" || order.status === "payment_failed" || order.status === "refunded"
      ? "failed"
      : "processing";

  return {
    sessionId,
    orderId: order.id,
    offerId: order.offer_id,
    state,
    orderStatus: order.status,
    paidAt: order.paid_at,
    fulfilledAt: order.fulfilled_at,
    entitlement: grant
  } as const;
}

export async function entitlementsForRequest(request: Request, env: CommerceServiceEnv) {
  const session = await requireAccountSession(request, env);
  return activeEntitlementsForAccount(env, session.userId);
}
