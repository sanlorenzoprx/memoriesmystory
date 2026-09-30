import { appIdentity } from "../config/app-identity";
import { handleAgentRoute } from "./agent-routes";
import { handleAuthRoute } from "./auth-routes";
import { handleCompletionRoute } from "./completion";
import { handleDiscoveryRoute } from "./discovery-routes";
import { handleDeletionRoute } from "./deletion";
import { handleMediaRoute } from "./media-routes";
import { handleMuseRoute } from "./muse";
import { handleMuseConversationRoute } from "./muse-conversation";
import { handleMuseTtsRoute } from "./muse-tts";
import { handleMuseVoiceReplyRoute } from "./muse-voice-replies";
import { handleSharingRoute } from "./sharing";
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
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_MUSE_VOICE_ID?: string;
  ELEVENLABS_TTS_MODEL_ID?: string;
  SHARE_TOKEN_PEPPER?: string;
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

    const deletionResponse = await handleDeletionRoute(request, env);
    if (deletionResponse) return deletionResponse;

    const mediaResponse = await handleMediaRoute(request, env);
    if (mediaResponse) return mediaResponse;

    const transcriptionResponse = await handleTranscriptionRoute(request, env);
    if (transcriptionResponse) return transcriptionResponse;

    const museTtsResponse = await handleMuseTtsRoute(request, env);
    if (museTtsResponse) return museTtsResponse;

    const museVoiceReplyResponse = await handleMuseVoiceReplyRoute(request, env);
    if (museVoiceReplyResponse) return museVoiceReplyResponse;

    const museConversationResponse = await handleMuseConversationRoute(request, env);
    if (museConversationResponse) return museConversationResponse;

    const museResponse = await handleMuseRoute(request, env);
    if (museResponse) return museResponse;

    const completionResponse = await handleCompletionRoute(request, env);
    if (completionResponse) return completionResponse;

    const sharingResponse = await handleSharingRoute(request, env);
    if (sharingResponse) return sharingResponse;

    return env.ASSETS.fetch(request);
  },

  async queue(batch, env) {
    await processTranscriptionBatch(batch, env);
  }
};

export default handler;
