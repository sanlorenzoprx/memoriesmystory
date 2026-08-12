import { commerceOffers, type CommerceOfferId } from "./commerce-catalog";
import type { CommerceServiceEnv, StripeCheckoutGateway } from "./commerce-service";
import { grantPaidOrderEntitlement, type EntitlementGrant } from "./entitlement-service";
import { retrieveCheckoutSession } from "./stripe-client";

type OrderRow = {
  readonly id: string;
  readonly account_id: string;
  readonly offer_id: CommerceOfferId;
  readonly stripe_checkout_session_id: string | null;
  readonly amount_total: number;
  readonly currency: string;
  readonly status: string;
  readonly paid_at: string | null;
  readonly fulfilled_at: string | null;
};

const retrieveOnlyGateway: Pick<StripeCheckoutGateway, "retrieve"> = {
  retrieve: retrieveCheckoutSession
};

async function orderForSession(
  env: CommerceServiceEnv,
  sessionId: string,
  metadataOrderId?: string
): Promise<OrderRow | null> {
  const bySession = await env.DB.prepare(
    `SELECT id, account_id, offer_id, stripe_checkout_session_id, amount_total,
            currency, status, paid_at, fulfilled_at
     FROM commerce_orders WHERE stripe_checkout_session_id = ?`
  ).bind(sessionId).first<OrderRow>();
  if (bySession) return bySession;
  if (!metadataOrderId) return null;
  return env.DB.prepare(
    `SELECT id, account_id, offer_id, stripe_checkout_session_id, amount_total,
            currency, status, paid_at, fulfilled_at
     FROM commerce_orders WHERE id = ?`
  ).bind(metadataOrderId).first<OrderRow>();
}

export async function fulfillCheckoutSession(
  env: CommerceServiceEnv,
  sessionId: string,
  stripe: Pick<StripeCheckoutGateway, "retrieve"> = retrieveOnlyGateway,
  now = new Date().toISOString()
): Promise<{
  readonly state: "processing" | "fulfilled";
  readonly orderId: string;
  readonly offerId: CommerceOfferId;
  readonly grant: EntitlementGrant | null;
  readonly replayed: boolean;
}> {
  const session = await stripe.retrieve(env, sessionId);
  const order = await orderForSession(env, session.id, session.metadata?.order_id);
  if (!order) throw new Error("Stripe checkout is not linked to a Memories: My Story order.");

  if (session.metadata?.order_id && session.metadata.order_id !== order.id) {
    throw new Error("Stripe checkout order metadata does not match the stored order.");
  }
  if (session.metadata?.account_id && session.metadata.account_id !== order.account_id) {
    throw new Error("Stripe checkout account metadata does not match the stored order.");
  }
  if (session.metadata?.offer_id && session.metadata.offer_id !== order.offer_id) {
    throw new Error("Stripe checkout offer metadata does not match the stored order.");
  }

  const offer = commerceOffers[order.offer_id];
  if (session.amount_total !== offer.amountTotal || session.amount_total !== order.amount_total) {
    throw new Error("Stripe checkout amount does not match the approved order.");
  }
  if (!session.currency || session.currency.toLowerCase() !== offer.currency || order.currency !== offer.currency) {
    throw new Error("Stripe checkout currency does not match the approved order.");
  }

  if (session.payment_status !== "paid") {
    return {
      state: "processing",
      orderId: order.id,
      offerId: order.offer_id,
      grant: null,
      replayed: order.status === "fulfilled"
    };
  }

  await env.DB.prepare(
    `UPDATE commerce_orders
     SET stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, ?),
         stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?),
         stripe_customer_id = COALESCE(stripe_customer_id, ?),
         status = CASE WHEN status = 'fulfilled' THEN 'fulfilled' ELSE 'paid' END,
         paid_at = COALESCE(paid_at, ?),
         updated_at = ?
     WHERE id = ?`
  ).bind(
    session.id,
    session.payment_intent,
    session.customer,
    now,
    now,
    order.id
  ).run();

  const result = await grantPaidOrderEntitlement(env, order.id, now);
  return {
    state: "fulfilled",
    orderId: order.id,
    offerId: order.offer_id,
    grant: result.grant,
    replayed: result.replayed
  };
}

export async function markCheckoutTerminalState(
  env: CommerceServiceEnv,
  sessionId: string,
  status: "expired" | "payment_failed",
  now = new Date().toISOString()
): Promise<void> {
  await env.DB.prepare(
    `UPDATE commerce_orders
     SET status = CASE WHEN status = 'fulfilled' THEN status ELSE ? END, updated_at = ?
     WHERE stripe_checkout_session_id = ?`
  ).bind(status, now, sessionId).run();
}
