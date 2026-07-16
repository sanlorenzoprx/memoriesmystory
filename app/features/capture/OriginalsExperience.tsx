import { useEffect, useMemo, useRef, useState } from "react";

import { phase1Config } from "../../../config/phase-1";
import {
  attachLocalAudio,
  updateLocalUpload,
  type LocalMemoryDraft
} from "./local-draft";
import { createLocalAudio, preferredAudioMimeType } from "../../services/audio-capture";
import {
  MediaDurabilityError,
  retrieveOriginal,
  uploadOriginalAudio,
  uploadOriginalPhoto,
  verifyOriginalReceipts
} from "../../services/media-durability";
import { saveLocalDraft } from "../../services/local-draft-store";

type OriginalsPhase =
  | "photo-uploading"
  | "photo-needs-connection"
  | "voice-invitation"
  | "microphone-opening"
  | "microphone-denied"
  | "recording"
  | "audio-review"
  | "audio-uploading"
  | "audio-needs-connection"
  | "originals-durable";

function initialPhase(draft: LocalMemoryDraft): OriginalsPhase {
  if (draft.audioUpload?.status === "durable") return "originals-durable";
  if (draft.audioUpload?.status === "needs_connection") return "audio-needs-connection";
  if (draft.audio) return "audio-review";
  if (draft.photoUpload?.status === "durable") return "voice-invitation";
  if (draft.photoUpload?.status === "needs_connection") return "photo-needs-connection";
  return "photo-uploading";
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function secondsLabel(milliseconds: number): string {
  return `${Math.ceil(milliseconds / 1000)} seconds`;
}

export function OriginalsExperience({
  draft,
  onDraftChange,
  photoUrl,
  onChangePhoto
}: {
  readonly draft: LocalMemoryDraft;
  readonly onDraftChange: (draft: LocalMemoryDraft) => void;
  readonly photoUrl: string;
  readonly onChangePhoto: () => void;
}) {
  const [phase, setPhase] = useState<OriginalsPhase>(() => initialPhase(draft));
  const [message, setMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [preservedAudio, setPreservedAudio] = useState<Blob | null>(null);
  const busyRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const limitTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const localAudioUrl = useMemo(
    () => (draft.audio ? URL.createObjectURL(draft.audio.blob) : null),
    [draft.audio]
  );
  const preservedAudioUrl = useMemo(
    () => (preservedAudio ? URL.createObjectURL(preservedAudio) : null),
    [preservedAudio]
  );

  useEffect(() => {
    return () => {
      if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
      if (preservedAudioUrl) URL.revokeObjectURL(preservedAudioUrl);
    };
  }, [localAudioUrl, preservedAudioUrl]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    return () => {
      stopTracks(streamRef.current);
      if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
      if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
    };
  }, []);

  async function commit(next: LocalMemoryDraft): Promise<void> {
    await saveLocalDraft(next);
    onDraftChange(next);
  }

  async function preservePhoto(current = draft): Promise<void> {
    if (!current.photo || !current.photoUpload || busyRef.current) return;
    busyRef.current = true;
    setPhase("photo-uploading");
    setMessage(null);

    const uploading: LocalMemoryDraft = {
      ...current,
      photoUpload: updateLocalUpload(current.photoUpload, {
        status: "uploading",
        lastError: null
      }),
      updatedAt: new Date().toISOString()
    };

    try {
      await commit(uploading);
      const receipt = await uploadOriginalPhoto(uploading);
      const durable: LocalMemoryDraft = {
        ...uploading,
        photoUpload: updateLocalUpload(uploading.photoUpload!, {
          status: "durable",
          receipt,
          lastError: null
        }),
        updatedAt: new Date().toISOString()
      };
      await commit(durable);
      setPhase("voice-invitation");
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "The photograph is still on this device. Reconnect and try again.";
      const failed: LocalMemoryDraft = {
        ...uploading,
        photoUpload: updateLocalUpload(uploading.photoUpload!, {
          status: "needs_connection",
          lastError: reason
        }),
        updatedAt: new Date().toISOString()
      };
      await commit(failed);
      setMessage(reason);
      setPhase("photo-needs-connection");
    } finally {
      busyRef.current = false;
    }
  }

  async function loadPreservedAudio(current: LocalMemoryDraft): Promise<void> {
    const receipt = current.audioUpload?.receipt;
    if (!receipt) return;
    const status = await verifyOriginalReceipts(current);
    if (!status.originalsDurable) {
      throw new MediaDurabilityError(
        "Both preservation receipts are not visible yet. Retry safely.",
        true,
        "receipt"
      );
    }
    setPreservedAudio(await retrieveOriginal(current, receipt.assetId));
  }

  async function preserveAudio(current = draft): Promise<void> {
    if (!current.audio || !current.audioUpload || busyRef.current) return;
    busyRef.current = true;
    setPhase("audio-uploading");
    setMessage(null);

    const uploading: LocalMemoryDraft = {
      ...current,
      audioUpload: updateLocalUpload(current.audioUpload, {
        status: "uploading",
        lastError: null
      }),
      updatedAt: new Date().toISOString()
    };

    try {
      await commit(uploading);
      const receipt = await uploadOriginalAudio(uploading);
      const durable: LocalMemoryDraft = {
        ...uploading,
        audioUpload: updateLocalUpload(uploading.audioUpload!, {
          status: "durable",
          receipt,
          lastError: null
        }),
        updatedAt: new Date().toISOString()
      };
      await commit(durable);
      await loadPreservedAudio(durable);
      setPhase("originals-durable");
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "The recording is still on this device. Reconnect and try again.";
      const failed: LocalMemoryDraft = {
        ...uploading,
        audioUpload: updateLocalUpload(uploading.audioUpload!, {
          status: "needs_connection",
          lastError: reason
        }),
        updatedAt: new Date().toISOString()
      };
      await commit(failed);
      setMessage(reason);
      setPhase("audio-needs-connection");
    } finally {
      busyRef.current = false;
    }
  }

  useEffect(() => {
    if (draft.photoUpload?.status === "local") {
      void preservePhoto(draft);
    } else if (draft.photoUpload?.status === "uploading") {
      void preservePhoto({
        ...draft,
        photoUpload: updateLocalUpload(draft.photoUpload, { status: "needs_connection" })
      });
    } else if (draft.audioUpload?.status === "uploading") {
      void preserveAudio({
        ...draft,
        audioUpload: updateLocalUpload(draft.audioUpload, { status: "needs_connection" })
      });
    } else if (draft.audioUpload?.status === "durable" && !preservedAudio) {
      void loadPreservedAudio(draft).catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Playback is temporarily unavailable.");
      });
    }
    // A stable upload identity makes a repeated Strict Mode effect safe.
  }, []);

  useEffect(() => {
    const resume = () => {
      if (draft.photoUpload?.status === "needs_connection") void preservePhoto(draft);
      else if (draft.audioUpload?.status === "needs_connection") void preserveAudio(draft);
    };
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [draft]);

  async function openMicrophone() {
    setPhase("microphone-opening");
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
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const durationMs = Math.min(
          Date.now() - startedAtRef.current,
          phase1Config.entitlements.freeVoiceSecondsPerStory * 1000
        );
        stopTracks(streamRef.current);
        streamRef.current = null;
        if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
        if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);

        void createLocalAudio(chunksRef.current, recorder.mimeType, durationMs)
          .then((audio) => attachLocalAudio(draft, audio))
          .then(async (next) => {
            await commit(next);
            setElapsedMs(0);
            setPhase("audio-review");
          })
          .catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : "The recording could not be kept.");
            setPhase("voice-invitation");
          });
      });

      startedAtRef.current = Date.now();
      recorder.start(250);
      setElapsedMs(0);
      tickTimerRef.current = window.setInterval(
        () => setElapsedMs(Date.now() - startedAtRef.current),
        250
      );
      limitTimerRef.current = window.setTimeout(
        () => recorder.state !== "inactive" && recorder.stop(),
        phase1Config.entitlements.freeVoiceSecondsPerStory * 1000
      );
      setPhase("recording");
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setMessage(
        denied
          ? "Microphone access was not allowed. Your photograph is already preserved."
          : "The microphone is not available right now. Your photograph is already preserved."
      );
      setPhase("microphone-denied");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  }

  async function recordAgain() {
    const next: LocalMemoryDraft = {
      ...draft,
      audio: null,
      audioUpload: null,
      updatedAt: new Date().toISOString()
    };
    await commit(next);
    setPreservedAudio(null);
    setPhase("voice-invitation");
  }

  const remainingMs = Math.max(
    0,
    phase1Config.entitlements.freeVoiceSecondsPerStory * 1000 - elapsedMs
  );

  return (
    <section className={`capture-state originals-state phase-${phase}`}>
      {(phase === "photo-uploading" || phase === "photo-needs-connection") && (
        <>
          <p className="eyebrow">Your original photograph</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {phase === "photo-uploading" ? "Preserving your photograph…" : "Your photograph is still here."}
          </h1>
          <div className="ready-photo-wrap"><img src={photoUrl} alt="Your photograph" /></div>
          {phase === "photo-uploading" ? (
            <p className="preservation-status" role="status">Keep this page open while the original is backed up.</p>
          ) : (
            <>
              <p className="inline-error" role="status">{message ?? draft.photoUpload?.lastError}</p>
              <button className="primary-action" type="button" onClick={() => void preservePhoto()}>
                Try preserving again
              </button>
              <p className="local-only-note">The original remains recoverable on this device.</p>
            </>
          )}
        </>
      )}

      {phase === "voice-invitation" && (
        <>
          <p className="eyebrow">Now, the voice behind it</p>
          <h1 ref={headingRef} tabIndex={-1}>Tell the story you remember.</h1>
          <div className="story-photo-focus"><img src={photoUrl} alt="The photograph you are remembering" /></div>
          <p className="capture-lede">Take your time. Speak naturally for up to {phase1Config.entitlements.freeVoiceSecondsPerStory} seconds.</p>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => void openMicrophone()}>
              Start recording
            </button>
            <button className="secondary-action" type="button" onClick={onChangePhoto}>Change photograph</button>
          </div>
          <p className="permission-note">Your browser asks for microphone access only after you start.</p>
          {message && <p className="inline-error" role="alert">{message}</p>}
        </>
      )}

      {phase === "microphone-opening" && (
        <div className="centered-state" aria-live="polite">
          <h1 ref={headingRef} tabIndex={-1}>Opening your microphone…</h1>
          <p>Your browser may ask for permission now.</p>
        </div>
      )}

      {phase === "recording" && (
        <>
          <p className="eyebrow recording-eyebrow">Recording your real voice</p>
          <h1 ref={headingRef} tabIndex={-1}>Take your time.</h1>
          <div className="story-photo-focus recording-photo"><img src={photoUrl} alt="The photograph you are remembering" /></div>
          <div className="recording-status" role="timer" aria-live="off">
            <span className="recording-pulse" aria-hidden="true" />
            <strong>{Math.floor(elapsedMs / 1000)}s</strong>
            <span>{remainingMs <= 10_000 ? `${secondsLabel(remainingMs)} remaining` : "Tell the story this picture brings back."}</span>
          </div>
          <button className="stop-recording-action" type="button" onClick={stopRecording}>
            <span aria-hidden="true" /> Stop recording
          </button>
        </>
      )}

      {phase === "microphone-denied" && (
        <>
          <p className="eyebrow">Your photograph is preserved</p>
          <h1 ref={headingRef} tabIndex={-1}>The microphone stayed closed.</h1>
          <p className="capture-lede">{message}</p>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => void openMicrophone()}>Try microphone again</button>
          </div>
          <details className="settings-help">
            <summary>How to allow the microphone</summary>
            <p>Open this site’s settings in your browser, allow Microphone, then return and try again.</p>
          </details>
        </>
      )}

      {phase === "audio-review" && draft.audio && localAudioUrl && (
        <>
          <p className="eyebrow">Listen to your voice</p>
          <h1 ref={headingRef} tabIndex={-1}>Does this sound like the story you meant to keep?</h1>
          <div className="story-photo-focus compact-story-photo"><img src={photoUrl} alt="The photograph paired with your recording" /></div>
          <audio className="voice-player" controls src={localAudioUrl}>Your browser cannot play this recording.</audio>
          <p className="local-only-note">This recording is still only on this device.</p>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => void preserveAudio()}>Keep this recording</button>
            <button className="secondary-action" type="button" onClick={() => void recordAgain()}>Record again</button>
          </div>
        </>
      )}

      {(phase === "audio-uploading" || phase === "audio-needs-connection") && (
        <>
          <p className="eyebrow">Your original voice</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {phase === "audio-uploading" ? "Preserving your recording…" : "Your recording is still here."}
          </h1>
          <div className="story-photo-focus compact-story-photo"><img src={photoUrl} alt="The photograph paired with your recording" /></div>
          {draft.audio && localAudioUrl && <audio className="voice-player" controls src={localAudioUrl} />}
          {phase === "audio-uploading" ? (
            <p className="preservation-status" role="status">The original stays on this device until its private backup is confirmed.</p>
          ) : (
            <>
              <p className="inline-error" role="status">{message ?? draft.audioUpload?.lastError}</p>
              <button className="primary-action" type="button" onClick={() => void preserveAudio()}>Try preserving again</button>
            </>
          )}
        </>
      )}

      {phase === "originals-durable" && (
        <>
          <p className="eyebrow">Photograph and voice protected</p>
          <h1 ref={headingRef} tabIndex={-1}>Your originals are safely backed up.</h1>
          <div className="story-photo-focus"><img src={photoUrl} alt="Your privately preserved photograph" /></div>
          {preservedAudioUrl ? (
            <>
              <p className="preserved-player-label">Playing the preserved original</p>
              <audio className="voice-player" controls src={preservedAudioUrl}>Your browser cannot play the preserved recording.</audio>
            </>
          ) : (
            <p className="preservation-status" role="status">{message ?? "Retrieving the preserved recording…"}</p>
          )}
          <div className="durable-status" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Private originals confirmed</strong>
              <p>The photograph and real voice were independently found in your protected draft.</p>
            </div>
          </div>
          <p className="cross-device-note">Next, sign in to carry this Memory Story securely to your other devices.</p>
        </>
      )}
    </section>
  );
}
