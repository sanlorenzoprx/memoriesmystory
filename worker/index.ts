import { appIdentity } from "../config/app-identity";

export interface Env {
  ASSETS: Fetcher;
  APP_NAME?: string;
  PUBLIC_BRAND_NAME?: string;
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

    return env.ASSETS.fetch(request);
  }
};

export default handler;
