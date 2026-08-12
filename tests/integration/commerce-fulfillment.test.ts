/// <reference types="@cloudflare/workers-types" />

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { createAppSession } from "../../worker/auth-session";
import { handleCommerceRoute } from "../../worker/commerce-routes";
import type { CommerceServiceEnv, StripeCheckoutGateway } from "../../worker/commerce-service";
import type { StripeCheckoutSession } from "../../worker/stripe-client";
import { TestD1 } from "../helpers/test-d1";

const sessionSecret = "commerce-fulfillment-session-secret-more-than-32-characters";
const webhookSecret = "whsec_commerce_test_secret";
const userId = "user_paid_001";
const orderId = "order_paid_001";
const sessionId = "cs_test_paid_001";

function paidSession(overrides: Partial<StripeCheckoutSession> = {}): StripeCheckoutSession {
  return {
    id: sessionId,
    client_secret: "cs_test_paid_001_secret_demo",
    payment_status: "paid",
    status: "complete",
    payment_intent: "pi_test_paid_001",
    customer: "cus_test_paid_001",
    amount_total: 24700,
    currency: "usd",
    metadata: { order_id: orderId, account_id: userId, offer_id: "chapter" },
    ...overrides
  };
}

function gateway(session: StripeCheckoutSession = paidSession()): StripeCheckoutGateway {
  return {
    async create() {
      throw new Error("create should not run during fulfillment tests");
    },
    async retrieve(_env, requestedSessionId) {
      expect(requestedSessionId).toBe(session.id);
      return session;
    }
  };
}

function webhookRequest(type: string, eventId: string, signature = true): Request {
  const payload = JSON.stringify({ id: eventId, type, data: { object: { id: sessionId } } });
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return new Request("https://memories.example.test/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": `t=${timestamp},v1=${signature ? digest : "0".repeat(64)}`
    },
    body: payload
  });
}

describe("money to entitlement", () => {
  let d1: TestD1;
  let env: CommerceServiceEnv;
  let cookie: string;

  beforeEach(async () => {
    d1 = new TestD1();
    const now = "2026-08-12T12:00:00.000Z";
    d1.database.prepare(
      "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).run(userId, "paid@example.test", now, now);
    d1.database.prepare(
      `INSERT INTO commerce_orders (
        id, account_id, offer_id, stripe_checkout_session_id, amount_total,
        currency, status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, 'chapter', ?, 24700, 'usd', 'checkout_open', ?, ?, ?)`
    ).run(orderId, userId, sessionId, "checkout_fulfillment_001", now, now);

    const appSession = await createAppSession(
      { DB: d1 as unknown as D1Database, SESSION_SECRET: sessionSecret },
      userId
    );
    cookie = appSession.cookie.split(";", 1)[0] ?? "";
    env = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: sessionSecret,
      STRIPE_SECRET_KEY: "sk_test_not_used_by_fake_gateway",
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      STRIPE_CHAPTER_PRICE_ID: "price_1U3cMABTT872MnyPDenlV4Ae",
      STRIPE_LIFE_PRICE_ID: "price_1U3cMBBTT872MnyPnnnvXXNh",
      STRIPE_FAMILY_PRICE_ID: "price_1U3cMBBTT872MnyPgcq4FgXd"
    };
  });

  it("grants exactly one Chapter entitlement for a verified paid event, even when replayed", async () => {
    const first = await handleCommerceRoute(
      webhookRequest("checkout.session.completed", "evt_paid_001"),
      env,
      gateway()
    );
    expect(first?.status).toBe(200);
    const firstBody = await first!.json() as { replayed: boolean; status: string };
    expect(firstBody).toMatchObject({ replayed: false, status: "processed" });

    const replay = await handleCommerceRoute(
      webhookRequest("checkout.session.completed", "evt_paid_001"),
      env,
      gateway()
    );
    expect(replay?.status).toBe(200);
    const replayBody = await replay!.json() as { replayed: boolean };
    expect(replayBody.replayed).toBe(true);

    const order = d1.database.prepare(
      "SELECT status, paid_at, fulfilled_at, stripe_payment_intent_id FROM commerce_orders WHERE id = ?"
    ).get(orderId) as Record<string, unknown>;
    expect(order.status).toBe("fulfilled");
    expect(order.paid_at).toBeTruthy();
    expect(order.fulfilled_at).toBeTruthy();
    expect(order.stripe_payment_intent_id).toBe("pi_test_paid_001");

    const grants = d1.database.prepare(
      "SELECT offer_id, living_memory_limit, voice_seconds_per_memory, memory_circle_enabled FROM entitlement_grants WHERE source_order_id = ?"
    ).all(orderId) as Array<Record<string, unknown>>;
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      offer_id: "chapter",
      living_memory_limit: 25,
      voice_seconds_per_memory: 600,
      memory_circle_enabled: 0
    });

    const events = d1.database.prepare(
      "SELECT processing_status FROM stripe_events WHERE stripe_event_id = 'evt_paid_001'"
    ).all() as Array<Record<string, unknown>>;
    expect(events).toEqual([{ processing_status: "processed" }]);
  });

  it("rejects an invalid webhook signature before recording or fulfilling the event", async () => {
    const response = await handleCommerceRoute(
      webhookRequest("checkout.session.completed", "evt_bad_sig", false),
      env,
      gateway()
    );
    expect(response?.status).toBe(400);
    const eventCount = d1.database.prepare("SELECT COUNT(*) AS count FROM stripe_events").get() as { count: number };
    const grantCount = d1.database.prepare("SELECT COUNT(*) AS count FROM entitlement_grants").get() as { count: number };
    expect(eventCount.count).toBe(0);
    expect(grantCount.count).toBe(0);
  });

  it("does not grant access when Checkout completes before delayed payment is paid", async () => {
    const response = await handleCommerceRoute(
      webhookRequest("checkout.session.completed", "evt_processing_001"),
      env,
      gateway(paidSession({ payment_status: "unpaid", status: "complete" }))
    );
    expect(response?.status).toBe(200);
    const grantCount = d1.database.prepare("SELECT COUNT(*) AS count FROM entitlement_grants").get() as { count: number };
    expect(grantCount.count).toBe(0);
    const order = d1.database.prepare("SELECT status FROM commerce_orders WHERE id = ?").get(orderId) as { status: string };
    expect(order.status).toBe("checkout_open");
  });

  it("can reconcile a paid Stripe Session from the thank-you status check without trusting the redirect", async () => {
    const response = await handleCommerceRoute(
      new Request(
        `https://memories.example.test/api/commerce/checkout-status?session_id=${sessionId}`,
        { headers: { Cookie: cookie } }
      ),
      env,
      gateway()
    );
    expect(response?.status).toBe(200);
    const body = await response!.json() as {
      checkout: { state: string; orderStatus: string; entitlement: { offerId: string } | null }
    };
    expect(body.checkout).toMatchObject({ state: "completed", orderStatus: "fulfilled" });
    expect(body.checkout.entitlement?.offerId).toBe("chapter");
  });

  it("marks asynchronous payment failure without granting an entitlement", async () => {
    const response = await handleCommerceRoute(
      webhookRequest("checkout.session.async_payment_failed", "evt_failed_001"),
      env,
      gateway()
    );
    expect(response?.status).toBe(200);
    const order = d1.database.prepare("SELECT status FROM commerce_orders WHERE id = ?").get(orderId) as { status: string };
    expect(order.status).toBe("payment_failed");
    const grantCount = d1.database.prepare("SELECT COUNT(*) AS count FROM entitlement_grants").get() as { count: number };
    expect(grantCount.count).toBe(0);
  });
});
