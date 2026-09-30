import { phase1Config } from "../../config/phase-1";

export type TranscriptionProviderInput = {
  readonly audio: Uint8Array;
  readonly contentType: string;
  readonly fileName: string;
};

export type TranscriptionProviderResult = {
  readonly text: string;
  readonly locale: string | null;
  readonly languageProbability: number | null;
};

export interface TranscriptionProvider {
  readonly provider: string;
  readonly modelId: string;
  transcribe(input: TranscriptionProviderInput): Promise<TranscriptionProviderResult>;
}

export type TranscriptionProviderEnv = {
  readonly ELEVENLABS_API_KEY?: string;
};

type ElevenLabsResponse = {
  readonly text?: unknown;
  readonly language_code?: unknown;
  readonly language_probability?: unknown;
};

export class ElevenLabsTranscriptionProvider implements TranscriptionProvider {
  readonly provider = "elevenlabs";
  readonly modelId = phase1Config.ai.transcriptionModelId;

  constructor(
    private readonly apiKey: string,
    private readonly transport: typeof fetch = (input, init) => fetch(input, init)
  ) {}

  async transcribe(input: TranscriptionProviderInput): Promise<TranscriptionProviderResult> {
    if (!this.apiKey.trim()) {
      throw new Error("ELEVENLABS_API_KEY is required for transcription.");
    }

    const audioBuffer = input.audio.buffer.slice(
      input.audio.byteOffset,
      input.audio.byteOffset + input.audio.byteLength
    ) as ArrayBuffer;
    const form = new FormData();
    form.set(
      "file",
      new Blob([audioBuffer], { type: input.contentType || "application/octet-stream" }),
      input.fileName
    );
    form.set("model_id", this.modelId);
    form.set("diarize", "false");
    form.set("tag_audio_events", "false");

    const response = await this.transport(phase1Config.ai.transcriptionEndpoint, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey
      },
      body: form
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs transcription failed with HTTP ${response.status}.`);
    }

    const body = await response.json() as ElevenLabsResponse;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const locale = typeof body.language_code === "string" ? body.language_code.trim() || null : null;
    const languageProbability =
      typeof body.language_probability === "number" ? body.language_probability : null;

    return { text, locale, languageProbability };
  }
}

export function createTranscriptionProvider(
  env: TranscriptionProviderEnv
): TranscriptionProvider {
  switch (phase1Config.ai.transcriptionProvider) {
    case "elevenlabs":
      return new ElevenLabsTranscriptionProvider(env.ELEVENLABS_API_KEY ?? "");
  }
}
