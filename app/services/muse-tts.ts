export class MuseSpeechError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

export async function loadMuseSpeech({
  draftId,
  text,
  draftToken = null
}: {
  readonly draftId: string;
  readonly text: string;
  readonly draftToken?: string | null;
}): Promise<Blob> {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Memories-Request": "muse-tts-v1"
  });
  if (draftToken) headers.set("X-Draft-Token", draftToken);

  const response = await fetch(
    `/resources/drafts/${encodeURIComponent(draftId)}/muse-tts`,
    {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify({ text })
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new MuseSpeechError(
      body.error?.message ?? "Muse could not speak right now.",
      body.error?.code ?? "muse_tts_failed",
      response.status
    );
  }

  return response.blob();
}
