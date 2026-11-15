import { useEffect, useMemo, useRef, useState } from "react";
import { t, useLocale } from "../../localization/language";
import {
  createLocalAudio,
  preferredAudioMimeType,
} from "../../services/audio-capture";
import type { LocalAudio } from "../capture/local-draft";

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Records one relative's own voice on this device. Nothing is sent from here:
 * the parent submits the reviewed recording and reports confirmed preservation.
 */
export function ContributionVoiceRecorder({
  audio,
  disabled,
  maximumSeconds,
  onChange,
}: {
  readonly audio: LocalAudio | null;
  readonly disabled: boolean;
  readonly maximumSeconds: number;
  readonly onChange: (audio: LocalAudio | null) => void;
}) {
  useLocale();
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording">(
      "idle",
    ),
    [elapsed, setElapsed] = useState(0),
    [failed, setFailed] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    chunks = useRef<Blob[]>([]),
    started = useRef(0),
    stopTimer = useRef<number | null>(null),
    tick = useRef<number | null>(null),
    alive = useRef(true),
    cancelled = useRef(false);
  const url = useMemo(
    () => (audio ? URL.createObjectURL(audio.blob) : null),
    [audio],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  function clearTimers() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (tick.current) window.clearInterval(tick.current);
    stopTimer.current = tick.current = null;
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelled.current = true;
      clearTimers();
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      stopTracks(stream.current);
    };
  }, []);

  async function start() {
    if (disabled || phase !== "idle") return;
    setPhase("requesting");
    setFailed(false);
    cancelled.current = false;
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !("MediaRecorder" in window)
      )
        throw new Error("unsupported");
      const granted = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      // A grant that arrives after the panel closed must not keep the microphone open.
      if (!alive.current || cancelled.current) return stopTracks(granted);
      stream.current = granted;
      const mimeType = preferredAudioMimeType(),
        active = new MediaRecorder(
          granted,
          mimeType ? { mimeType } : undefined,
        );
      recorder.current = active;
      chunks.current = [];
      started.current = Date.now();
      setElapsed(0);
      active.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      });
      active.addEventListener(
        "stop",
        () => {
          const durationMs = Math.max(
            100,
            Math.min(Date.now() - started.current, maximumSeconds * 1000),
          );
          clearTimers();
          stopTracks(stream.current);
          stream.current = recorder.current = null;
          if (!alive.current || cancelled.current) return;
          void createLocalAudio(
            chunks.current,
            active.mimeType || mimeType || "audio/webm",
            durationMs,
          )
            .then((recorded) => {
              if (!alive.current) return;
              onChange(recorded);
              setPhase("idle");
            })
            .catch(() => {
              if (!alive.current) return;
              setFailed(true);
              setPhase("idle");
            });
        },
        { once: true },
      );
      active.start(1000);
      setPhase("recording");
      tick.current = window.setInterval(
        () => setElapsed(Date.now() - started.current),
        250,
      );
      stopTimer.current = window.setTimeout(() => {
        if (active.state !== "inactive") active.stop();
      }, maximumSeconds * 1000);
    } catch {
      stopTracks(stream.current);
      stream.current = recorder.current = null;
      if (!alive.current) return;
      setFailed(true);
      setPhase("idle");
    }
  }

  return (
    <section aria-label={t("Voice recollection")}>
      <h3>{t("Or record your recollection in your own voice")}</h3>
      {failed && (
        <p role="alert">
          {t(
            "The microphone could not be used. You can write your recollection instead.",
          )}
        </p>
      )}
      {!audio && phase !== "recording" && (
        <button
          type="button"
          className="secondary-action"
          disabled={disabled || phase === "requesting"}
          onClick={() => void start()}
        >
          {t("Record my voice")}
        </button>
      )}
      {phase === "recording" && (
        <>
          <p role="status">
            {t("Recording… {seconds} of {limit} seconds", {
              seconds: Math.min(maximumSeconds, Math.floor(elapsed / 1000)),
              limit: maximumSeconds,
            })}
          </p>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              if (recorder.current?.state !== "inactive")
                recorder.current?.stop();
            }}
          >
            {t("Stop recording")}
          </button>
        </>
      )}
      {audio && url && (
        <>
          <p>{t("Listen to your recording before submitting it.")}</p>
          <audio controls preload="metadata" src={url} />
          <p role="status">
            {t(
              "Your unsent recording is only in this open page. Keep it open until submission is confirmed.",
            )}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (
                window.confirm(
                  t("Discard this unsent recording and record again?"),
                )
              )
                onChange(null);
            }}
          >
            {t("Record again")}
          </button>
        </>
      )}
    </section>
  );
}
