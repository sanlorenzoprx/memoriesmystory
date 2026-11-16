import { phase1Config } from "../../config/phase-1";
import { isThirdPartyModel, modelText } from "./model-output";

export type MuseTextRequest = {
  readonly system: string;
  readonly user: string;
  readonly maxTokens: number;
  readonly temperature: number;
};

export interface MuseTextProvider {
  readonly provider: string;
  readonly modelId: string;
  generate(request: MuseTextRequest): Promise<string>;
}

export type MuseProviderEnv = {
  readonly AI: Ai;
  /** AI Gateway that carries third-party models (Gemini); Cloudflare creates "default" on first use. */
  readonly AI_GATEWAY_ID?: string;
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
    const input = {
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user }
      ],
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
  const gateway = env.AI_GATEWAY_ID?.trim() || "default";
  return new FallbackMuseTextProvider([
    new CloudflareMuseTextProvider(env.AI, phase1Config.ai.museModelId, gateway),
    new CloudflareMuseTextProvider(env.AI, phase1Config.ai.museFallbackModelId, gateway)
  ]);
}
