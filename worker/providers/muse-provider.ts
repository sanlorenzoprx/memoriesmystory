import { phase1Config } from "../../config/phase-1";
import { isThirdPartyModel, modelText } from "./model-output";

export type MuseTextRequest = {
  readonly system: string;
  readonly user: string;
  readonly maxTokens: number;
  readonly temperature: number;
  /** A photograph for Muse to look at (decision 2026-11-16): JPEG, PNG or WebP, base64. */
  readonly image?: { readonly mimeType: string; readonly base64: string };
};

/** Chat messages in the OpenAI-compatible shape both Gemini routes accept. */
function chatMessages(request: MuseTextRequest) {
  return [
    { role: "system", content: request.system },
    {
      role: "user",
      content: request.image
        ? [
            { type: "text", text: request.user },
            { type: "image_url", image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` } }
          ]
        : request.user
    }
  ];
}

export interface MuseTextProvider {
  readonly provider: string;
  readonly modelId: string;
  generate(request: MuseTextRequest): Promise<string>;
}

export type MuseProviderEnv = {
  readonly AI: Ai;
  /** AI Gateway that carries third-party models (Gemini); Cloudflare creates "default" on first use. */
  readonly AI_GATEWAY_ID?: string;
  /** The owner's own Gemini API key (Worker secret). When set, Muse calls Google directly. */
  readonly GEMINI_API_KEY?: string;
};

export class MuseModelRefused extends Error {}

/**
 * One model reached through the Workers AI binding. A third-party model goes
 * through AI Gateway and must be on the zero-data-retention list: a family's
 * words never go to a provider that keeps them (decision 2026-11-16, Talk with Muse).
 */
export class CloudflareMuseTextProvider implements MuseTextProvider {
  readonly provider = "cloudflare-ai";

  constructor(
    private readonly ai: Ai,
    readonly modelId: string,
    private readonly gatewayId = "default"
  ) {}

  async generate(request: MuseTextRequest): Promise<string> {
    const thirdParty = isThirdPartyModel(this.modelId);
    if (thirdParty && !(phase1Config.ai.museZeroRetentionModels as readonly string[]).includes(this.modelId))
      throw new MuseModelRefused("Model is not on the zero-data-retention list");
    // The Workers AI fallback reads text only; a photograph is never sent to it.
    if (!thirdParty && request.image) throw new MuseModelRefused("Model cannot look at photographs");
    const input = {
      messages: chatMessages(request),
      // Gemini reasons before answering and those tokens count against the
      // limit; the guard still trims what the storyteller sees to one question.
      max_tokens: thirdParty ? request.maxTokens + phase1Config.ai.museReasoningTokenAllowance : request.maxTokens,
      temperature: request.temperature
    };
    const result = thirdParty
      ? await this.ai.run(this.modelId as never, input as never, { gateway: { id: this.gatewayId } } as never)
      : await this.ai.run(this.modelId as never, input as never);
    return modelText(result);
  }
}

/**
 * Gemini called directly on Google's OpenAI-compatible endpoint with the
 * owner's own key, so usage is billed to their Gemini credits. The key is
 * sent only to Google, never logged, and never returned.
 */
export class DirectGeminiMuseTextProvider implements MuseTextProvider {
  readonly provider = "google-gemini-direct";
  readonly modelId = phase1Config.ai.museDirectGeminiModel;

  constructor(private readonly apiKey: string) {}

  async generate(request: MuseTextRequest): Promise<string> {
    const response = await fetch(phase1Config.ai.museDirectGeminiEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelId,
        messages: chatMessages(request),
        max_tokens: request.maxTokens + phase1Config.ai.museReasoningTokenAllowance,
        temperature: request.temperature,
        // Muse asks one short question; keep Gemini's thinking short too.
        reasoning_effort: "low"
      }),
      signal: AbortSignal.timeout(phase1Config.ai.museDirectTimeoutMs)
    });
    // Only the status leaves this function on failure: no body, no key.
    if (!response.ok) throw new Error(`Gemini answered ${response.status}`);
    return modelText(await response.json().catch(() => null));
  }
}

/** Tries the primary model, then the fallback, so Muse keeps listening during an outage. */
export class FallbackMuseTextProvider implements MuseTextProvider {
  readonly provider = "cloudflare-ai";
  constructor(private readonly chain: readonly MuseTextProvider[]) {}
  get modelId() {
    return this.chain[0]!.modelId;
  }
  async generate(request: MuseTextRequest): Promise<string> {
    let lastError: unknown = new Error("No Muse model configured");
    for (const provider of this.chain) {
      try {
        const text = await provider.generate(request);
        if (text.trim()) return text;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}

export function createMuseTextProvider(env: MuseProviderEnv): MuseTextProvider {
  const gateway = env.AI_GATEWAY_ID?.trim() || "default",
    key = env.GEMINI_API_KEY?.trim();
  if (key)
    return new FallbackMuseTextProvider([
      new DirectGeminiMuseTextProvider(key),
      new CloudflareMuseTextProvider(env.AI, phase1Config.ai.museFallbackModelId, gateway)
    ]);
  return new FallbackMuseTextProvider([
    new CloudflareMuseTextProvider(env.AI, phase1Config.ai.museModelId, gateway),
    new CloudflareMuseTextProvider(env.AI, phase1Config.ai.museFallbackModelId, gateway)
  ]);
}
