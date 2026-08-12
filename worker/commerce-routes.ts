import {
  CommerceServiceError,
  createCheckoutForRequest,
  type CommerceServiceEnv,
  type StripeCheckoutGateway
} from "./commerce-service";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export async function handleCommerceRoute(
  request: Request,
  env: CommerceServiceEnv,
  stripe?: StripeCheckoutGateway
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/api/commerce/")) return null;

  try {
    if (pathname === "/api/commerce/checkout-session" && request.method === "POST") {
      const checkout = await createCheckoutForRequest(request, env, stripe);
      return json({ ok: true, checkout }, checkout.replayed ? 200 : 201);
    }
    return json({ ok: false, error: { code: "method", message: "Method not allowed." } }, 405);
  } catch (error) {
    const routeError = error instanceof CommerceServiceError
      ? error
      : new CommerceServiceError(500, "The checkout could not be opened.", "internal");
    return json({ ok: false, error: { code: routeError.code, message: routeError.message } }, routeError.status);
  }
}
