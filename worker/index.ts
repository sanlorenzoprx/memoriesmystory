import { appIdentity } from "../config/app-identity";
import { handleAgentRoute } from "./agent-routes";
import { handleAuthRoute } from "./auth-routes";
import { handleDiscoveryRoute } from "./discovery-routes";
import { handleMediaRoute } from "./media-routes";
import { handleMuseRoute } from "./muse";
import {
  handleTranscriptionRoute,
  processTranscriptionBatch
} from "./transcription";
import type { TranscriptionQueueMessage } from "../app/domain";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  AI: Ai;
  PROCESSING_QUEUE: Queue<TranscriptionQueueMessage>;
  APP_NAME?: string;
  PUBLIC_BRAND_NAME?: string;
  SESSION_SECRET?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
}

const handler: ExportedHandler<Env, TranscriptionQueueMessage> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        app: env.APP_NAME ?? appIdentity.technicalName,
        brand: env.PUBLIC_BRAND_NAME ?? appIdentity.brandName
      });
    }

    const discoveryResponse = handleDiscoveryRoute(request);
    if (discoveryResponse) return discoveryResponse;

    const agentResponse = await handleAgentRoute(request, env);
    if (agentResponse) return agentResponse;

    const authResponse = await handleAuthRoute(request, env);
    if (authResponse) return authResponse;

    const mediaResponse = await handleMediaRoute(request, env);
    if (mediaResponse) return mediaResponse;

    const transcriptionResponse = await handleTranscriptionRoute(request, env);
    if (transcriptionResponse) return transcriptionResponse;

    const museResponse = await handleMuseRoute(request, env);
    if (museResponse) return museResponse;

    return env.ASSETS.fetch(request);
  },

  async queue(batch, env) {
    await processTranscriptionBatch(batch, env);
  }
};

export default handler;
