/// <reference types="@cloudflare/workers-types" />

import { beforeEach, describe, expect, it } from "vitest";

import { createAppSession } from "../../worker/auth-session";
import { handleCommerceRoute } from "../../worker/commerce-routes";
import type { CommerceServiceEnv, StripeCheckoutGateway } from "../../worker/commerce-service";
import type { StripeCheckoutSession } from "../../worker/stripe-client";
import { TestD1 } from "../helpers/test-d1";

const sessionSecret = "commerce-test-session-secret-that-is-longer-than-32-characters";
const priceIds = {
  STRIPE_CHAPTER_PRICE_ID: "price_1U3cMABTT872MnyPDenlV4Ae",
  STRIPE_LIFE_PRICE_ID: "price_1U3cMBBTT872MnyPnnnvXXNh",
  STRIPE_FAMILY_PRICE_ID: "price_1U3cMBBTT872MnyPgcq4FgXd"
} as const;

function stripeSession(overrides: Partial<StripeCheckoutSession> = {}): StripeCheckoutSession {
  return {
    id: "cs_test_chapter_001",
    client_secret: "cs_test_chapter_001_secret_demo",
    payment_status: "unpaid",
    status: "open",
    payment_intent: null,
    customer: "cus_test_001",
    amount_total: 24700,
    currency: "usd",
    metadata: {},
    ...overrides
  };
}

describe("commerce foundation", () => {
  let d1: TestD1;
  let env: CommerceServiceEnv;
  let cookie: string;

  beforeEach(async () => {
    d1 = new TestD1();
    const now = "2026-08-12T12:00:00.000Z";
    d1.database.prepare(
      "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).run("user_commerce_001", "buyer@example.test", now, now);
    const appSession = await createAppSession(
      { DB: d1 as unknown as D1Database, SESSION_SECRET: sessionSecret },
      "user_commerce_001"
    );
    cookie = appSession.cookie.split(";", 1)[0] ?? "";
    env = {
      DB: d1 as unknown as D1Database,
      SESSION_SECRET: sessionSecret,
      STRIPE_SECRET_KEY: "sk_test_not_used_by_fake_gateway",
      ...priceIds,
      MEMORIES_PUBLIC_ORIGIN: "https://memories.example.test"
    };
  });

  it("maps the approved offer and price on the server and ignores browser amount claims", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const gateway: StripeCheckoutGateway = {
      async create(_env, input) {
        calls.push({ ...input });
        return stripeSession();
      },
      async retrieve() {
        throw new Error("retrieve should not run on the first attempt");
      }
    };

    const response = await handleCommerceRoute(
      new Request("https://memories.example.test/api/commerce/checkout-session", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "https://memories.example.test",
          "Content-Type": "application/json",
          "X-Memories-Request": "commerce-v1"
        },
        body: JSON.stringify({
          offerId: "chapter",
          attemptId: "checkout_12345678-1234-1234-1234-123456789abc",
          amountTotal: 247
        })
      }),
      env,
      gateway
    );

    expect(response?.status).toBe(201);
    const body = await response!.json() as {
      checkout: { offerId: string; amountTotal: number; currency: string; clientSecret: string }
    };
    expect(body.checkout).toMatchObject({
      offerId: "chapter",
      amountTotal: 24700,
      currency: "usd",
      clientSecret: "cs_test_chapter_001_secret_demo"
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      priceId: priceIds.STRIPE_CHAPTER_PRICE_ID,
      offerId: "chapter",
      accountId: "user_commerce_001",
      customerEmail: "buyer@example.test"
    });
    expect(String(calls[0]?.returnUrl)).toContain(
      "/thank-you/chapter?session_id={CHECKOUT_SESSION_ID}"
    );

    const order = d1.database.prepare(
      "SELECT offer_id, amount_total, currency, status, stripe_checkout_session_id FROM commerce_orders"
    ).get() as Record<string, unknown>;
    expect(order).toMatchObject({
      offer_id: "chapter",
      amount_total: 24700,
      currency: "usd",
      status: "checkout_open",
      stripe_checkout_session_id: "cs_test_chapter_001"
    });
  });

  it("replays the same checkout attempt instead of creating another Stripe Session", async () => {
    let creates = 0;
    let retrieves = 0;
    const gateway: StripeCheckoutGateway = {
      async create() {
        creates += 1;
        return stripeSession();
      },
      async retrieve(_env, sessionId) {
        retrieves += 1;
        return stripeSession({ id: sessionId });
      }
    };
    const request = () => new Request("https://memories.example.test/api/commerce/checkout-session", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://memories.example.test",
        "Content-Type": "application/json",
        "X-Memories-Request": "commerce-v1"
      },
      body: JSON.stringify({
        offerId: "chapter",
        attemptId: "checkout_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
      })
    });

    expect((await handleCommerceRoute(request(), env, gateway))?.status).toBe(201);
    expect((await handleCommerceRoute(request(), env, gateway))?.status).toBe(200);
    expect(creates).toBe(1);
    expect(retrieves).toBe(1);
    const count = d1.database.prepare("SELECT COUNT(*) AS count FROM commerce_orders").get() as { count: number };
    expect(count.count).toBe(1);
  });

  it("rejects checkout without an authenticated app session", async () => {
    const response = await handleCommerceRoute(
      new Request("https://memories.example.test/api/commerce/checkout-session", {
        method: "POST",
        headers: {
          Origin: "https://memories.example.test",
          "Content-Type": "application/json",
          "X-Memories-Request": "commerce-v1"
        },
        body: JSON.stringify({
          offerId: "chapter",
          attemptId: "checkout_12345678-1234-1234-1234-123456789abc"
        })
      }),
      env,
      {
        create: async () => stripeSession(),
        retrieve: async () => stripeSession()
      }
    );
    expect(response?.status).toBe(401);
  });
});
