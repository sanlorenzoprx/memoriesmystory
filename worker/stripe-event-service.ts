import type { CommerceServiceEnv, StripeCheckoutGateway } from "./commerce-service";
import { fulfillCheckoutSession, markCheckoutTerminalState } from "./commerce-fulfillment";

type StripeEvent = {
  readonly id: string;
  readonly type: string;
  readonly data: { readonly object: { readonly id?: string } };
};

type EventRow = {
  readonly stripe_event_id: string;
  readonly processing_status: "received" | "processed" | "ignored" | "failed";
};

export async function processStripeEvent(
  env: CommerceServiceEnv,
  event: StripeEvent,
  stripe?: Pick<StripeCheckoutGateway, "retrieve">,
  now = new Date().toISOString()
): Promise<{ readonly replayed: boolean; readonly status: "processed" | "ignored" }> {
  if (!event.id || !event.type) throw new Error("Stripe event is missing its identity.");

  await env.DB.prepare(
    `INSERT OR IGNORE INTO stripe_events (
      stripe_event_id, event_type, received_at, processing_status
    ) VALUES (?, ?, ?, 'received')`
  ).bind(event.id, event.type, now).run();

  const stored = await env.DB.prepare(
    "SELECT stripe_event_id, processing_status FROM stripe_events WHERE stripe_event_id = ?"
  ).bind(event.id).first<EventRow>();
  if (stored?.processing_status === "processed" || stored?.processing_status === "ignored") {
    return { replayed: true, status: stored.processing_status };
  }

  try {
    const sessionId = event.data?.object?.id;
    if (!sessionId) throw new Error("Stripe checkout event is missing the Checkout Session ID.");

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await fulfillCheckoutSession(env, sessionId, stripe, now);
      await env.DB.prepare(
        `UPDATE stripe_events
         SET processing_status = 'processed', processed_at = ?, error = NULL
         WHERE stripe_event_id = ?`
      ).bind(now, event.id).run();
      return { replayed: false, status: "processed" };
    }

    if (event.type === "checkout.session.async_payment_failed") {
      await markCheckoutTerminalState(env, sessionId, "payment_failed", now);
      await env.DB.prepare(
        `UPDATE stripe_events
         SET processing_status = 'processed', processed_at = ?, error = NULL
         WHERE stripe_event_id = ?`
      ).bind(now, event.id).run();
      return { replayed: false, status: "processed" };
    }

    if (event.type === "checkout.session.expired") {
      await markCheckoutTerminalState(env, sessionId, "expired", now);
      await env.DB.prepare(
        `UPDATE stripe_events
         SET processing_status = 'processed', processed_at = ?, error = NULL
         WHERE stripe_event_id = ?`
      ).bind(now, event.id).run();
      return { replayed: false, status: "processed" };
    }

    await env.DB.prepare(
      `UPDATE stripe_events
       SET processing_status = 'ignored', processed_at = ?, error = NULL
       WHERE stripe_event_id = ?`
    ).bind(now, event.id).run();
    return { replayed: false, status: "ignored" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe event processing failed.";
    await env.DB.prepare(
      `UPDATE stripe_events
       SET processing_status = 'failed', processed_at = ?, error = ?
       WHERE stripe_event_id = ?`
    ).bind(now, message.slice(0, 500), event.id).run();
    throw error;
  }
}

export type { StripeEvent };
