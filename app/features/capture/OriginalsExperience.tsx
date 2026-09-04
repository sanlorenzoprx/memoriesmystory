import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { phase1Config } from "../../../config/phase-1";
import {
  acceptLocalAudio,
  attachLocalAudio,
  type LocalMemoryDraft
} from "./local-draft";
import { createLocalAudio, preferredAudioMimeType } from "../../services/audio-capture";
import {
  MediaDurabilityError,
  retrieveOriginal,
  verifyOriginalReceipts
} from "../../services/media-durability";
import {
  needsOriginalSync,
  syncAcceptedOriginalsInBackground
} from "../../services/media-background-sync";
import { saveLocalDraft } from "../../services/local-draft-store";

type OriginalsPhase =
  | "voice-invitation"
  | "microphone-opening"
  | "microphone-denied"
  | "recording"
  | "audio-review"
  | "story-local"
  | "originals-durable";

function initialPhase(draft: LocalMemoryDraft): OriginalsPhase {
  if (draft.audioUpload?.status === "durable") return "originals-durable";
  if (draft.audio?.acceptedAt) return "story-local";
  if (draft.audio) return "audio-review";
  return "voice-invitation";
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
  const [isBackingUp, setIsBackingUp] = useState(false);
  const draftRef = useRef(draft);
  const syncBusyRef = useRef(false);
  const syncRequestedRef = useRef(false);
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
    draftRef.current = next;
    await saveLocalDraft(next);
    onDraftChange(next);
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

  async function runBackgroundSync(): Promise<void> {
    if (!needsOriginalSync(draftRef.current)) return;
    if (syncBusyRef.current) {
      syncRequestedRef.current = true;
      return;
    }

    syncBusyRef.current = true;
    setIsBackingUp(true);
    try {
      const synced = await syncAcceptedOriginalsInBackground({
        getDraft: () => draftRef.current,
        commit
      });
      if (synced.audioUpload?.status === "durable") {
        setPhase("originals-durable");
        void loadPreservedAudio(synced).catch(() => undefined);
      }
    } catch {
      // The originals remain in IndexedDB. Reconnect, reload, or the next online
      // event resumes the same immutable operations without interrupting the story.
    } finally {
      syncBusyRef.current = false;
      setIsBackingUp(false);
      if (syncRequestedRef.current) {
        syncRequestedRef.current = false;
        void runBackgroundSync();
      }
    }
  }

  useEffect(() => {
    draftRef.current = draft;
    if (needsOriginalSync(draft)) void runBackgroundSync();
  }, [draft.photo?.acceptedAt, draft.audio?.acceptedAt]);

  useEffect(() => {
    if (draft.audioUpload?.status === "durable" && !preservedAudio) {
      void loadPreservedAudio(draft).catch(() => undefined);
    }
  }, [draft.audioUpload?.status]);

  useEffect(() => {
    const resume = () => void runBackgroundSync();
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, []);

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
          .then((audio) => attachLocalAudio(draftRef.current, audio))
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
          ? "Microphone access was not allowed. Your photograph is safe on this device."
          : "The microphone is not available right now. Your photograph is safe on this device."
      );
      setPhase("microphone-denied");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  }

  async function recordAgain() {
    const next: LocalMemoryDraft = {
      ...draftRef.current,
      audio: null,
      audioUpload: null,
      updatedAt: new Date().toISOString()
    };
    await commit(next);
    setPreservedAudio(null);
    setPhase("voice-invitation");
  }

  async function keepRecording() {
    const next = acceptLocalAudio(draftRef.current);
    await commit(next);
    setPhase("story-local");
    void runBackgroundSync();
  }

  const remainingMs = Math.max(
    0,
    phase1Config.entitlements.freeVoiceSecondsPerStory * 1000 - elapsedMs
  );

  return (
    <section className={`capture-state originals-state phase-${phase}`}>
      {phase === "voice-invitation" && (
        <>
          <p className="eyebrow">Now, the voice behind it</p>
          <h1 ref={headingRef} tabIndex={-1}>Tell the story you remember.</h1>
          <div className="story-photo-focus"><img src={photoUrl} alt="The photograph you are remembering" /></div>
          <p className="capture-lede">Take your time. Speak naturally for up to {phase1Config.entitlements.freeVoiceSecondsPerStory} seconds. Say the names, places, jokes, and details the photograph cannot carry by itself.</p>
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
          <p className="eyebrow">Your photograph is safe</p>
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
          <p className="local-only-note">Your recording is safe on this device while you decide.</p>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => void keepRecording()}>Keep this recording</button>
            <button className="secondary-action" type="button" onClick={() => void recordAgain()}>Record again</button>
          </div>
        </>
      )}

      {phase === "story-local" && draft.audio && localAudioUrl && (
        <>
          <p className="eyebrow">Your memory is safe</p>
          <h1 ref={headingRef} tabIndex={-1}>Your story stays with you.</h1>
          <div className="story-photo-focus compact-story-photo"><img src={photoUrl} alt="The photograph paired with your recording" /></div>
          <audio className="voice-player" controls src={localAudioUrl} />
          <p className="capture-lede">Your photograph and voice are together on this device. You can leave this page; we’ll finish protecting both when a connection is available.</p>
        </>
      )}

      {phase === "originals-durable" && (
        <>
          <p className="eyebrow">Photograph and voice protected</p>
          <h1 ref={headingRef} tabIndex={-1}>We have your back.</h1>
          <p className="capture-lede">Your photograph and real voice are preserved together in your family archive, so the story does not have to live in someone’s memory alone.</p>
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
              <p>Your photograph and real voice are safely backed up.</p>
            </div>
          </div>
          <p className="cross-device-note">Come back to this Memory Story from your phone, tablet, or computer without starting over.</p>
          <Link className="primary-action" to={`/auth/protect?draftId=${encodeURIComponent(draft.id)}`}>
            Protect this Memory Story
          </Link>
        </>
      )}

      {phase !== "originals-durable" && draft.photo?.acceptedAt && (
        <div className="background-backup" role="status" aria-live="polite">
          <span className={isBackingUp ? "backup-pulse" : "backup-device"} aria-hidden="true" />
          <p>
            {isBackingUp
              ? "Preserving quietly in the background…"
              : "Safe on this device. Backup will continue when a connection is available."}
          </p>
        </div>
      )}
    </section>
  );
}
