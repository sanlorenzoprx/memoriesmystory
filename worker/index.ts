import { appIdentity } from "../config/app-identity";
import { handleAuthRoute } from "./auth-routes";
import { handleCommerceRoute } from "./commerce-routes";
import { handleMediaRoute } from "./media-routes";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  APP_NAME?: string;
  PUBLIC_BRAND_NAME?: string;
  SESSION_SECRET?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_CHAPTER_PRICE_ID?: string;
  STRIPE_LIFE_PRICE_ID?: string;
  STRIPE_FAMILY_PRICE_ID?: string;
  MEMORIES_PUBLIC_ORIGIN?: string;
}

const handler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        app: env.APP_NAME ?? appIdentity.technicalName,
        brand: env.PUBLIC_BRAND_NAME ?? appIdentity.brandName
      });
    }

    const authResponse = await handleAuthRoute(request, env);
    if (authResponse) return authResponse;

    const commerceResponse = await handleCommerceRoute(request, env);
    if (commerceResponse) return commerceResponse;

    const mediaResponse = await handleMediaRoute(request, env);
    if (mediaResponse) return mediaResponse;

    return env.ASSETS.fetch(request);
  }
};

export default handler;
