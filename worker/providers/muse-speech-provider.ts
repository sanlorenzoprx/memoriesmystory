import { phase1Config } from "../../config/phase-1";

export type MuseSpeechRequest = {
  readonly text: string;
};

export interface MuseSpeechProvider {
  readonly provider: string;
  readonly modelId: string;
  readonly voiceId: string;
  synthesize(request: MuseSpeechRequest): Promise<Response>;
}

export type MuseSpeechProviderEnv = {
  readonly ELEVENLABS_API_KEY?: string;
  readonly ELEVENLABS_MUSE_VOICE_ID?: string;
  readonly ELEVENLABS_TTS_MODEL_ID?: string;
};

export class ElevenLabsMuseSpeechProvider implements MuseSpeechProvider {
  readonly provider = "elevenlabs";
  readonly modelId: string;

  constructor(
    private readonly apiKey: string,
    readonly voiceId: string,
    modelId?: string,
    private readonly transport: typeof fetch = (input, init) => fetch(input, init)
  ) {
    this.modelId = modelId?.trim() || phase1Config.ai.museTtsModelId;
  }

  async synthesize(request: MuseSpeechRequest): Promise<Response> {
    if (!this.apiKey.trim()) {
      throw new Error("ELEVENLABS_API_KEY is required for Muse speech.");
    }
    if (!this.voiceId.trim()) {
      throw new Error("ELEVENLABS_MUSE_VOICE_ID is required for Muse speech.");
    }

    return this.transport(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}?output_format=${phase1Config.ai.museTtsOutputFormat}&enable_logging=false`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text: request.text,
          model_id: this.modelId,
          voice_settings: {
            stability: 0.62,
            similarity_boost: 0.72,
            style: 0,
            use_speaker_boost: true,
            speed: 0.96
          }
        })
      }
    );
  }
}

export function createMuseSpeechProvider(
  env: MuseSpeechProviderEnv
): MuseSpeechProvider {
  switch (phase1Config.ai.museTtsProvider) {
    case "elevenlabs":
      return new ElevenLabsMuseSpeechProvider(
        env.ELEVENLABS_API_KEY ?? "",
        env.ELEVENLABS_MUSE_VOICE_ID ?? "",
        env.ELEVENLABS_TTS_MODEL_ID
      );
  }
}
