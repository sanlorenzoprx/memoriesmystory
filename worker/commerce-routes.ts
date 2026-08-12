import {
  CommerceServiceError,
  checkoutStatusForRequest,
  createCheckoutForRequest,
  entitlementsForRequest,
  type CommerceServiceEnv,
  type StripeCheckoutGateway
} from "./commerce-service";
import { processStripeEvent, type StripeEvent } from "./stripe-event-service";
import { StripeWebhookError, verifyStripeWebhookSignature } from "./stripe-webhook";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

async function handleStripeWebhook(
  request: Request,
  env: CommerceServiceEnv,
  stripe?: StripeCheckoutGateway
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  }

  const payload = await request.text();
  await verifyStripeWebhookSignature(
    payload,
    request.headers.get("Stripe-Signature"),
    env.STRIPE_WEBHOOK_SECRET
  );

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return json({ ok: false, error: { code: "invalid_payload", message: "Invalid Stripe event payload." } }, 400);
  }

  const result = await processStripeEvent(env, event, stripe);
  return json({ ok: true, eventId: event.id, ...result });
}

export async function handleCommerceRoute(
  request: Request,
  env: CommerceServiceEnv,
  stripe?: StripeCheckoutGateway
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const isCommerce = pathname.startsWith("/api/commerce/");
  const isWebhook = pathname === "/api/webhooks/stripe";
  const isEntitlements = pathname === "/api/entitlements";
  if (!isCommerce && !isWebhook && !isEntitlements) return null;

  try {
    if (isWebhook) return await handleStripeWebhook(request, env, stripe);

    if (pathname === "/api/commerce/checkout-session" && request.method === "POST") {
      const checkout = await createCheckoutForRequest(request, env, stripe);
      return json({ ok: true, checkout }, checkout.replayed ? 200 : 201);
    }
    if (pathname === "/api/commerce/checkout-status" && request.method === "GET") {
      const checkout = await checkoutStatusForRequest(request, env, stripe);
      return json({ ok: true, checkout });
    }
    if (isEntitlements && request.method === "GET") {
      const entitlements = await entitlementsForRequest(request, env);
      return json({ ok: true, entitlements });
    }
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    if (error instanceof StripeWebhookError) {
      const status = error.code === "webhook_unconfigured" ? 503 : 400;
      return json({ ok: false, error: { code: error.code, message: error.message } }, status);
    }
    const routeError = error instanceof CommerceServiceError
      ? error
      : new CommerceServiceError(500, "The commerce request could not be completed.", "internal");
    return json({ ok: false, error: { code: routeError.code, message: routeError.message } }, routeError.status);
  }
}
