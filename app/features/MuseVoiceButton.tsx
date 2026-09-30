import { useEffect, useRef, useState } from "react";

import { loadMuseSpeech } from "../services/muse-tts";

export function MuseVoiceButton({
  draftId,
  text,
  draftToken = null,
  autoPlay = false
}: {
  readonly draftId: string;
  readonly text: string;
  readonly draftToken?: string | null;
  readonly autoPlay?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "unavailable">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAutoTextRef = useRef<string | null>(null);

  async function play() {
    if (!text.trim() || status === "loading") return;
    setStatus("loading");
    try {
      audioRef.current?.pause();
      const blob = await loadMuseSpeech({ draftId, text, draftToken });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        setStatus("idle");
      }, { once: true });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        setStatus("unavailable");
      }, { once: true });
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("unavailable");
    }
  }

  useEffect(() => {
    if (!autoPlay || !text.trim() || lastAutoTextRef.current === text) return;
    lastAutoTextRef.current = text;
    void play();
  }, [autoPlay, text]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return (
    <button
      className="muse-voice-action"
      type="button"
      onClick={() => void play()}
      disabled={status === "loading"}
      aria-label={status === "playing" ? "Replay Muse" : "Hear Muse"}
      title={status === "unavailable" ? "Muse voice is not available yet" : undefined}
    >
      <span aria-hidden="true">{status === "playing" ? "◼" : "🔊"}</span>
      {status === "loading"
        ? "Loading voice…"
        : status === "playing"
          ? "Muse is speaking"
          : status === "unavailable"
            ? "Voice unavailable"
            : "Hear Muse"}
    </button>
  );
}
