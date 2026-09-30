import { useEffect, useMemo, useRef, useState } from "react";

import { phase1Config } from "../../config/phase-1";
import { createLocalAudio, preferredAudioMimeType } from "../services/audio-capture";
import {
  makeMuseVoiceReplyIdentity,
  retryMuseVoiceReplyTranscription,
  uploadMuseVoiceReply,
  type MuseVoiceReplyUploadIdentity,
  type MuseVoiceReplyView
} from "../services/muse-voice-replies";
import type { LocalAudio } from "./capture/local-draft";

type RecorderPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "review"
  | "uploading"
  | "transcription_pending"
  | "transcript"
  | "error";

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function MuseVoiceReplyRecorder({
  draftId,
  replyToTurnId,
  disabled,
  onSend
}: {
  readonly draftId: string;
  readonly replyToTurnId: string;
  readonly disabled: boolean;
  readonly onSend: (
    answer: string,
    state: "stated" | "approximate",
    voiceReplyAssetId: string
  ) => Promise<void>;
}) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audio, setAudio] = useState<LocalAudio | null>(null);
  const [identity, setIdentity] = useState<MuseVoiceReplyUploadIdentity | null>(null);
  const [preserved, setPreserved] = useState<MuseVoiceReplyView | null>(null);
  const [transcript, setTranscript] = useState("");
  const [approximate, setApproximate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);

  const localAudioUrl = useMemo(
    () => (audio ? URL.createObjectURL(audio.blob) : null),
    [audio]
  );

  useEffect(() => {
    return () => {
      if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    };
  }, [localAudioUrl]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      stopTracks(streamRef.current);
    };
  }, []);

  useEffect(() => {
    setPhase("idle");
    setElapsedMs(0);
    setAudio(null);
    setIdentity(null);
    setPreserved(null);
    setTranscript("");
    setApproximate(false);
    setMessage(null);
  }, [replyToTurnId]);

  async function startRecording() {
    if (disabled || phase === "requesting" || phase === "recording") return;
    setPhase("requesting");
    setMessage(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
        throw new DOMException("Microphone unavailable", "NotSupportedError");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      streamRef.current = stream;
      const mimeType = preferredAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setElapsedMs(0);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      recorder.addEventListener(
        "stop",
        () => {
          const durationMs = Math.max(
            100,
            Math.min(
              Date.now() - startedAtRef.current,
              phase1Config.entitlements.freeVoiceSecondsPerStory * 1000
            )
          );
          const chunks = [...chunksRef.current];
          const recorderMimeType =
            recorder.mimeType || mimeType || "audio/webm";
          stopTracks(streamRef.current);
          streamRef.current = null;
          recorderRef.current = null;
          if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
          if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
          stopTimerRef.current = null;
          tickTimerRef.current = null;

          void createLocalAudio(chunks, recorderMimeType, durationMs)
            .then((nextAudio) => {
              setAudio(nextAudio);
              setPhase("review");
            })
            .catch((error) => {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "That reply could not be recorded."
              );
              setPhase("error");
            });
        },
        { once: true }
      );

      recorder.start(250);
      setPhase("recording");
      tickTimerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      stopTimerRef.current = window.setTimeout(
        () => recorder.state !== "inactive" && recorder.stop(),
        phase1Config.entitlements.freeVoiceSecondsPerStory * 1000
      );
    } catch {
      stopTracks(streamRef.current);
      streamRef.current = null;
      setMessage(
        "Microphone access is needed only when you choose to answer Muse by voice. You can still type your reply."
      );
      setPhase("error");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current?.stop();
    }
  }

  function recordAgain() {
    setAudio(null);
    setIdentity(null);
    setPreserved(null);
    setTranscript("");
    setApproximate(false);
    setMessage(null);
    setElapsedMs(0);
    setPhase("idle");
  }

  async function preserveAndTranscribe() {
    if (!audio || disabled) return;
    const nextIdentity =
      identity ?? makeMuseVoiceReplyIdentity(draftId, replyToTurnId);
    setIdentity(nextIdentity);
    setPhase("uploading");
    setMessage(null);

    try {
      const result = await uploadMuseVoiceReply({
        draftId,
        replyToTurnId,
        identity: nextIdentity,
        audio
      });
      setPreserved(result.voiceReply);
      if (result.state === "ready" && result.voiceReply.transcript) {
        setTranscript(result.voiceReply.transcript);
        setPhase("transcript");
      } else {
        setPhase("transcription_pending");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The voice reply could not be preserved yet."
      );
      setPhase("error");
    }
  }

  async function retryTranscription() {
    if (!preserved) {
      await preserveAndTranscribe();
      return;
    }
    setMessage(null);
    setPhase("uploading");
    try {
      const result = await retryMuseVoiceReplyTranscription(
        draftId,
        preserved.assetId
      );
      setPreserved(result.voiceReply);
      if (result.state === "ready" && result.voiceReply.transcript) {
        setTranscript(result.voiceReply.transcript);
        setPhase("transcript");
      } else {
        setPhase("transcription_pending");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Muse still needs another try to read the words."
      );
      setPhase("transcription_pending");
    }
  }

  async function sendToMuse() {
    if (!preserved || !transcript.trim() || disabled) return;
    setMessage(null);
    try {
      await onSend(
        transcript.trim(),
        approximate ? "approximate" : "stated",
        preserved.assetId
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Muse could not continue from that reply yet."
      );
    }
  }

  if (phase === "error" && audio && localAudioUrl) {
    return (
      <div className="muse-voice-reply review">
        <strong>Your reply is still on this device.</strong>
        <audio controls src={localAudioUrl}>
          Your browser cannot play this voice reply.
        </audio>
        {message && <p className="muse-voice-note" role="status">{message}</p>}
        <div className="muse-voice-reply-actions">
          <button
            className="primary-action"
            type="button"
            disabled={disabled}
            onClick={() => void preserveAndTranscribe()}
          >
            Retry preserve
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={disabled}
            onClick={recordAgain}
          >
            Record again
          </button>
        </div>
      </div>
    );
  }

  if (phase === "idle" || phase === "error") {
    return (
      <div className="muse-voice-reply">
        <button
          className="muse-voice-reply-start"
          type="button"
          disabled={disabled}
          onClick={() => void startRecording()}
        >
          <span aria-hidden="true">●</span>
          Answer with voice
        </button>
        {message && <p className="muse-voice-note" role="status">{message}</p>}
      </div>
    );
  }

  if (phase === "requesting") {
    return (
      <div className="muse-voice-reply" role="status">
        <p className="muse-voice-note">Opening the microphone…</p>
      </div>
    );
  }

  if (phase === "recording") {
    const seconds = Math.floor(elapsedMs / 1000);
    return (
      <div className="muse-voice-reply recording" role="status">
        <div className="muse-voice-recording-status">
          <span className="recording-dot" aria-hidden="true" />
          <strong>Answering Muse</strong>
          <span>{seconds}s / {phase1Config.entitlements.freeVoiceSecondsPerStory}s</span>
        </div>
        <button
          className="stop-recording-action compact-stop"
          type="button"
          onClick={stopRecording}
        >
          <span aria-hidden="true" /> Stop
        </button>
      </div>
    );
  }

  if (phase === "review" && audio && localAudioUrl) {
    return (
      <div className="muse-voice-reply review">
        <strong>Listen before you send it</strong>
        <audio controls src={localAudioUrl}>
          Your browser cannot play this voice reply.
        </audio>
        <div className="muse-voice-reply-actions">
          <button
            className="primary-action"
            type="button"
            disabled={disabled}
            onClick={() => void preserveAndTranscribe()}
          >
            Use this voice reply
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={disabled}
            onClick={recordAgain}
          >
            Record again
          </button>
        </div>
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div className="muse-voice-reply" role="status">
        <p className="muse-voice-note">
          Preserving your real voice, then letting Muse read the words…
        </p>
      </div>
    );
  }

  if (phase === "transcription_pending") {
    return (
      <div className="muse-voice-reply">
        <strong>Your voice reply is safe.</strong>
        <p className="muse-voice-note">
          Muse needs another try to read the words. You do not need to record again.
        </p>
        <button
          className="secondary-action"
          type="button"
          disabled={disabled}
          onClick={() => void retryTranscription()}
        >
          Try transcript again
        </button>
        {message && <p className="muse-voice-note" role="status">{message}</p>}
      </div>
    );
  }

  return (
    <div className="muse-voice-reply transcript-review">
      <strong>Muse heard:</strong>
      {localAudioUrl && (
        <audio controls src={localAudioUrl}>
          Your browser cannot play this voice reply.
        </audio>
      )}
      <label>
        <span className="sr-only">Review the transcript Muse heard</span>
        <textarea
          rows={3}
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
        />
      </label>
      <span className="muse-voice-note">
        Correct the words if transcription missed something. Your preserved audio is never changed.
      </span>
      <label className="muse-approximate-choice">
        <input
          type="checkbox"
          checked={approximate}
          onChange={(event) => setApproximate(event.target.checked)}
        />
        I'm not completely sure
      </label>
      <button
        className="primary-action"
        type="button"
        disabled={disabled || !transcript.trim()}
        onClick={() => void sendToMuse()}
      >
        Send voice reply to Muse
      </button>
      {message && <p className="muse-voice-note" role="status">{message}</p>}
    </div>
  );
}
