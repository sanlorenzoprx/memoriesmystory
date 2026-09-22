import { describe, expect, it, vi } from "vitest";

import { phase1Config } from "../../config/phase-1";
import { ElevenLabsTranscriptionProvider } from "../../worker/providers/transcription-provider";

describe("ElevenLabs transcription provider boundary", () => {
  it("contains provider-specific HTTP details and returns a provider-neutral result", async () => {
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(phase1Config.ai.transcriptionEndpoint);
      expect(new Headers(init?.headers).get("xi-api-key")).toBe("test-key");

      const form = init?.body as FormData;
      expect(form.get("model_id")).toBe("scribe_v2");
      expect(form.get("diarize")).toBe("false");
      expect(form.get("tag_audio_events")).toBe("false");
      expect(form.has("language_code")).toBe(false);

      const file = form.get("file");
      expect(file).toBeInstanceOf(File);
      expect((file as File).type).toBe("audio/webm");

      return Response.json({
        text: "Mi abuela made this every Sunday.",
        language_code: "es",
        language_probability: 0.91
      });
    });

    const provider = new ElevenLabsTranscriptionProvider(
      "test-key",
      transport as typeof fetch
    );

    await expect(
      provider.transcribe({
        audio: Uint8Array.from([1, 2, 3, 4]),
        contentType: "audio/webm",
        fileName: "memory-audio.webm"
      })
    ).resolves.toEqual({
      text: "Mi abuela made this every Sunday.",
      locale: "es",
      languageProbability: 0.91
    });

    expect(transport).toHaveBeenCalledOnce();
  });

  it("fails before any provider request when the runtime secret is absent", async () => {
    const transport = vi.fn();
    const provider = new ElevenLabsTranscriptionProvider(
      "",
      transport as typeof fetch
    );

    await expect(
      provider.transcribe({
        audio: Uint8Array.from([1]),
        contentType: "audio/webm",
        fileName: "memory-audio.webm"
      })
    ).rejects.toThrow("ELEVENLABS_API_KEY");

    expect(transport).not.toHaveBeenCalled();
  });
});
