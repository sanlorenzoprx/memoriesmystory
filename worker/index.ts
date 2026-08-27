import { appIdentity } from "../config/app-identity";
import { handleAgentRoute } from "./agent-routes";
import { handleAuthRoute } from "./auth-routes";
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

    // ASC-01 is a public, privacy-bounded acquisition surface. It is evaluated
    // before authenticated archive/media routing and has no path into either.
    const agentResponse = await handleAgentRoute(request, env);
    if (agentResponse) return agentResponse;

    const authResponse = await handleAuthRoute(request, env);
    if (authResponse) return authResponse;

    const mediaResponse = await handleMediaRoute(request, env);
    if (mediaResponse) return mediaResponse;

    return env.ASSETS.fetch(request);
  }
};

export default handler;
