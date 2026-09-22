import { phase1Config } from "../../config/phase-1";

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
};

export class CloudflareMuseTextProvider implements MuseTextProvider {
  readonly provider = "cloudflare-workers-ai";
  readonly modelId = phase1Config.ai.museModelId;

  constructor(private readonly ai: Ai) {}

  async generate(request: MuseTextRequest): Promise<string> {
    const result = await this.ai.run(this.modelId, {
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user }
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature
    });

    if (!result || typeof result !== "object") return "";
    const response = (result as Record<string, unknown>).response;
    return typeof response === "string" ? response : "";
  }
}

export function createMuseTextProvider(env: MuseProviderEnv): MuseTextProvider {
  return new CloudflareMuseTextProvider(env.AI);
}
