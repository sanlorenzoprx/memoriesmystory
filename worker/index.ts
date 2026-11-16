import { handleFamilyContributionRoute } from './family-contributions';
import { handleFamilySearchRoute } from "./family-search";
import { handleArchiveExportRoute } from "./archive-export";
import { handleFamilyTimelineRoute } from "./family-timeline";
import { handleFamilyAccessRoute } from './family-access-routes';
import { handleArchiveRoute } from "./archive-routes";
import { handlePeopleRoute } from "./people-routes";
import { handleRemoteRecordingRoute } from "./legacy-remote-recording-route";
export { LegacyRecorder } from "./legacy-recorder";
import { handleLegacyRemoteRoute } from "./legacy-remote";
import type { RealtimeKitEnv } from "./realtimekit";
import { enforceRateLimit, type RateLimitEnv } from "./rate-limit";
import { enforceDailyCeiling } from "./usage-ceilings";
import { runFixityPass } from "./fixity";
import { handleServerExportRoute, processServerExportStep, purgeServerExports, type ServerExportMessage } from "./server-export";
import type { ViewingImagesBinding } from "./private-media";
import { runFamilyUpdatePass, runOwnerReminderPass } from "./notifications";
import { handleEmailPreferenceRoute } from "./email-preferences";
import { handleReferralRoute } from "./referral";
import { handleShareAgreementRoute } from "./share-agreement";
import type { EmailProviderEnv } from "./providers/email-provider";
import { appIdentity } from "../config/app-identity";
import { handleLegacyRecordingRoute } from "./legacy-recordings";
import { handleLegacySessionRoute } from "./legacy-sessions";
import { handleAgentRoute } from "./agent-routes";
import { handleAuthRoute } from "./auth-routes";
import { handleCompletionRoute } from "./completion";
import { handleDiscoveryRoute } from "./discovery-routes";
import { handleDeletionRoute } from "./deletion";
import { handlePhotoScanRoute } from "./photo-scans";
import { handleMediaRoute } from "./media-routes";
import { handleMuseRoute } from "./muse";
import { handleMuseConversationRoute } from "./muse-conversation";
import { handleMuseTtsRoute } from "./muse-tts";
import { handleMuseVoiceReplyRoute } from "./muse-voice-replies";
import { handleStoryReviewRoute } from "./story-review";
import { handleSharingRoute } from "./sharing";
import {
  handleTranscriptionRoute,
  processTranscriptionBatch
} from "./transcription";
import type { TranscriptionQueueMessage } from "../app/domain";

export interface Env extends RealtimeKitEnv, RateLimitEnv, EmailProviderEnv {
  LEGACY_RECORDERS?: DurableObjectNamespace;
  LEGACY_REMOTE_RECORDING_ENABLED?: string;
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  AI: Ai;
  AI_GATEWAY_ID?: string;
  PROCESSING_QUEUE: Queue<TranscriptionQueueMessage>;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_MUSE_VOICE_ID?: string;
  ELEVENLABS_TTS_MODEL_ID?: string;
  SHARE_TOKEN_PEPPER?: string;
  STORY_REVIEW_WRITES_PAUSED?: string;
  APP_NAME?: string;
  PUBLIC_BRAND_NAME?: string;
  SESSION_SECRET?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  PUBLIC_APP_ORIGIN?: string;
  IMAGES?: ViewingImagesBinding;
}

const handler: ExportedHandler<Env, TranscriptionQueueMessage | ServerExportMessage> = {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch {
      // Last line of defence (review finding F9): no stack, message or private
      // detail leaves the Worker; the client maps the stable code to its own copy.
      return Response.json(
        { error: { code: "unavailable" } },
        {
          status: 503,
          headers: {
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
  },

  async queue(batch, env) {
    // Export steps and transcriptions share one queue; each kind is handled on its own.
    const isExport = (message: Message<unknown>): message is Message<ServerExportMessage> =>
      (message.body as { type?: unknown } | null)?.type === "server_export";
    for (const message of batch.messages.filter(isExport)) {
      try {
        await processServerExportStep(env, message.body.jobId);
        message.ack();
      } catch {
        message.retry();
      }
    }
    const transcriptions = batch.messages.filter((message) => !isExport(message)) as Message<TranscriptionQueueMessage>[];
    if (transcriptions.length)
      await processTranscriptionBatch({ ...batch, messages: transcriptions } as MessageBatch<TranscriptionQueueMessage>, env);
  },

  // Daily integrity pass over stored originals and sources (worker/fixity.ts).
  async scheduled(_controller, env, context) {
    context.waitUntil(
      runFixityPass(env).then((result) => {
        console.log("Fixity pass finished", result);
      }),
    );
    // Counts only; no address or content is logged.
    context.waitUntil(
      runFamilyUpdatePass(env).then((result) => {
        console.log("Family update pass finished", result);
      }),
    );
    context.waitUntil(
      runOwnerReminderPass(env).then((result) => {
        console.log("Owner reminder pass finished", result);
      }),
    );
    context.waitUntil(
      purgeServerExports(env, { expiredBefore: new Date().toISOString() }).then((removed) => {
        console.log("Expired server exports removed", { removed });
      }),
    );
  }
};

async function route(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        app: env.APP_NAME ?? appIdentity.technicalName,
        brand: env.PUBLIC_BRAND_NAME ?? appIdentity.brandName
      });
    }

    const limited = await enforceRateLimit(request, env);
    if (limited) return limited;
    const overCeiling = await enforceDailyCeiling(request, env);
    if (overCeiling) return overCeiling;

    const discoveryResponse = handleDiscoveryRoute(request);
    if (discoveryResponse) return discoveryResponse;

    const agentResponse = await handleAgentRoute(request, env);
    if (agentResponse) return agentResponse;

    const authResponse = await handleAuthRoute(request, env);
    if (authResponse) return authResponse;

    const emailPreferenceResponse = await handleEmailPreferenceRoute(request, env);
    if (emailPreferenceResponse) return emailPreferenceResponse;

    const referralResponse = await handleReferralRoute(request, env);
    if (referralResponse) return referralResponse;

    const shareAgreementResponse = await handleShareAgreementRoute(request, env);
    if (shareAgreementResponse) return shareAgreementResponse;

    const archiveResponse=await handleArchiveRoute(request,env);
    if(archiveResponse)return archiveResponse;
    const familyContributionResponse=await handleFamilyContributionRoute(request,env);
    if(familyContributionResponse)return familyContributionResponse;
    const serverExportResponse = await handleServerExportRoute(request, env);
    if (serverExportResponse) return serverExportResponse;
    const archiveExportResponse = await handleArchiveExportRoute(request, env);
    if (archiveExportResponse) return archiveExportResponse;
    const familyTimelineResponse = await handleFamilyTimelineRoute(request, env);
    if (familyTimelineResponse) return familyTimelineResponse;
    const familySearchResponse = await handleFamilySearchRoute(request, env);
    if (familySearchResponse) return familySearchResponse;
    const familyAccessResponse=await handleFamilyAccessRoute(request,env);
    if(familyAccessResponse)return familyAccessResponse;
    const peopleResponse=await handlePeopleRoute(request,env);
    if(peopleResponse)return peopleResponse;

    const remoteRecordingResponse = await handleRemoteRecordingRoute(request, env);
    if (remoteRecordingResponse) return remoteRecordingResponse;

    const remoteResponse = await handleLegacyRemoteRoute(request, env);
    if (remoteResponse) return remoteResponse;

    const recordingResponse = await handleLegacyRecordingRoute(request, env);
    if(recordingResponse)return recordingResponse;

    const legacyResponse = await handleLegacySessionRoute(request, env);
    if (legacyResponse) return legacyResponse;

    const deletionResponse = await handleDeletionRoute(request, env);
    if (deletionResponse) return deletionResponse;

    const scanResponse = await handlePhotoScanRoute(request, env);
    if (scanResponse) return scanResponse;

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

    const reviewResponse = await handleStoryReviewRoute(request, env);
    if (reviewResponse) return reviewResponse;

    const completionResponse = await handleCompletionRoute(request, env);
    if (completionResponse) return completionResponse;

    const sharingResponse = await handleSharingRoute(request, env);
    if (sharingResponse) return sharingResponse;

    return env.ASSETS.fetch(request);
}

export default handler;
