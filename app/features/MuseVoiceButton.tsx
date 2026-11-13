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
  const urlRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const generation = useRef(0);

  function dispose() {
    generation.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }

  function stop() {
    dispose();
    setStatus("idle");
  }

  async function play() {
    if (!text.trim() || requestRef.current || audioRef.current) return;
    const current = ++generation.current;
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    try {
      const blob = await loadMuseSpeech({ draftId, text, draftToken, signal: controller.signal });
      if (current !== generation.current) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => {
        if (current !== generation.current) return;
        dispose();
        setStatus("idle");
      }, { once: true });
      audio.addEventListener("error", () => {
        if (current !== generation.current) return;
        dispose();
        setStatus("unavailable");
      }, { once: true });
      await audio.play();
      if (current === generation.current) setStatus("playing");
    } catch {
      if (current !== generation.current) return;
      dispose();
      setStatus("unavailable");
    } finally {
      if (current === generation.current) requestRef.current = null;
    }
  }

  useEffect(() => {
    dispose();
    setStatus("idle");
    if (autoPlay && text.trim()) {
      void play();
    }
    return dispose;
  }, [draftId, draftToken, autoPlay, text]);

  const canStop = status === "playing" || status === "loading";
  return (
    <button
      className="muse-voice-action"
      type="button"
      onClick={() => canStop ? stop() : void play()}
      aria-label={canStop ? "Stop Muse" : "Hear Muse"}
      title={status === "unavailable" ? "Muse voice is unavailable. You can read the words or try again." : undefined}
    >
      <span aria-hidden="true">{canStop ? "◼" : "🔊"}</span>
      {status === "loading"
        ? "Stop loading voice"
        : status === "playing"
          ? "Stop Muse"
          : status === "unavailable"
            ? "Try Muse voice again"
            : "Hear Muse"}
    </button>
  );
}
