import { useEffect, useRef, useState } from "react";
import type {
  LegacyRecording,
  LegacySessionView,
} from "../../domain/our-living-legacy";
import { phase1Config } from "../../../config/phase-1";
import { t, notice, useLocale, getLocale } from "../../localization/language";
import {
  legacyPath,
  legacyRequest,
  loadLegacySession,
} from "../../services/legacy-api";
import {
  captureLegacyAudio,
  type LegacyCapture,
} from "../../services/legacy-audio-capture";
import {
  loadLegacyTakes,
  legacyDeletionChannel,
  recoverLegacyTake,
  holdLegacyTakeLock,
  loadLegacyBlob,
  storeLegacyTake,
  storeLegacyChunk,
  removeLegacyTake,
  type LocalLegacyTake,
} from "../../services/legacy-recording-store";
import {
  loadLegacyRecordings,
  preserveLegacyRecording,
} from "../../services/legacy-recordings";
export function LegacyRecordingPanel({
  view,
  healthy,
}: {
  view: LegacySessionView;
  healthy: boolean;
}) {
  useLocale();
  const [takes, setTakes] = useState<LocalLegacyTake[]>([]),
    [recordings, setRecordings] = useState<LegacyRecording[]>([]),
    [phase, setPhase] = useState<
      "idle" | "requesting" | "recording" | "paused" | "stopping"
    >("idle"),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [localReady, setLocalReady] = useState(false),
    [deleted, setDeleted] = useState(false),
    [seconds, setSeconds] = useState(0);
  const mounted = useRef(true),
    capture = useRef<LegacyCapture | null>(null),
    generation = useRef(0),
    latest = useRef({ view, healthy }),
    volatile = useRef(new Map<string, Blob>()),
    epoch = useRef<number | null>(null),
    heldDraftLocks = useRef(new Map<string, () => void>()),
    deletion = useRef(false),
    takeSnapshot = useRef(takes);
  takeSnapshot.current = takes;
  const photoFocus = useRef<HTMLDivElement | null>(null),
    stopControl = useRef<HTMLButtonElement | null>(null),
    previousPhase = useRef(phase);
  useEffect(() => {
    if (phase === "recording" && previousPhase.current === "requesting") {
      photoFocus.current?.scrollIntoView({ block: "start" });
      stopControl.current?.focus({ preventScroll: true });
    }
    previousPhase.current = phase;
  }, [phase]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(legacyDeletionChannel);
    channel.onmessage = (event) => {
      if (!view.memoryId || event.data?.memoryId !== view.memoryId) return;
      deletion.current = true;
      setDeleted(true);
      generation.current++;
      capture.current?.stop(true);
      volatile.current.clear();
      for (const take of takeSnapshot.current)
        void removeLegacyTake(take.id).catch(() => undefined);
      for (const release of heldDraftLocks.current.values()) release();
      heldDraftLocks.current.clear();
    };
    return () => channel.close();
  }, [view.memoryId]);
  latest.current = { view, healthy };
  async function refreshLocal() {
    const found = await loadLegacyTakes(view.id, view.actorId);
    const recovered = await Promise.all(
      found.map((take) =>
        take.stage === "recording"
          ? recoverLegacyTake(take)
          : Promise.resolve(take),
      ),
    );
    if (mounted.current) {
      setTakes(
        recovered.filter((take): take is LocalLegacyTake => Boolean(take)),
      );
      setLocalReady(recovered.every(Boolean));
      if (recovered.some((take) => !take))
        setError(
          "Another tab is keeping this recording. Return there or recheck after it closes.",
        );
    }
  }
  useEffect(() => {
    mounted.current = true;
    if (view.actorRole === "host" && view.mode === "in_person")
      void refreshLocal().catch(() =>
        setError("This browser cannot keep a recoverable local draft."),
      );
    return () => {
      mounted.current = false;
      generation.current++;
      capture.current?.stop(true);
      capture.current = null;
      for (const release of heldDraftLocks.current.values()) release();
      heldDraftLocks.current.clear();
    };
  }, [view.id, view.actorId]);
  useEffect(() => {
    let active = true;
    void loadLegacyRecordings(view.id, view.actorRole === "guest")
      .then((result) => {
        if (active) setRecordings(result.recordings);
      })
      .catch(() => {
        if (active)
          setError(
            "The private recordings could not be opened. Please try again.",
          );
      });
    return () => {
      active = false;
    };
  }, [view.id, view.actorRole, view.version]);
  useEffect(() => {
    if (
      capture.current &&
      (!healthy || !view.canRecord || view.consentEpoch !== epoch.current)
    ) {
      capture.current.stop(true);
      setPhase("stopping");
      setError(
        "Recording stopped because agreement or connection changed. Review the part kept on this device.",
      );
    }
  }, [healthy, view.canRecord, view.consentEpoch]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (capture.current)
        setSeconds(Math.floor(capture.current.elapsed() / 1000));
    }, 250);
    const offline = () => {
      capture.current?.stop(true);
      if (capture.current)
        setError(
          "Recording stopped because agreement or connection changed. Review the part kept on this device.",
        );
    };
    const hidden = () => {
      if (document.hidden) offline();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("pagehide", offline);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("pagehide", offline);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  async function start() {
    if (
      deletion.current ||
      phase !== "idle" ||
      busy ||
      !healthy ||
      !view.canRecord
    )
      return;
    const attempt = ++generation.current;
    setPhase("requesting");
    setError(null);
    let stream: MediaStream | undefined;
    let take: LocalLegacyTake | undefined;
    let releaseLock: (() => void) | undefined;
    let recordingStarted = false;
    try {
      if (
        typeof MediaRecorder === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      )
        throw new Error(
          "This browser cannot record audio. Try another browser.",
        );
      if (!view.memoryId)
        throw new Error(
          "This conversation is not available with your current access.",
        );
      const lease = await legacyRequest<{
        recordingId: string;
        consentEpoch: number;
      }>(
        legacyPath(view.id, false, "/recordings"),
        "POST",
        {},
        `recording_start_${crypto.randomUUID()}`,
      );
      take = {
        id: lease.recordingId,
        sessionId: view.id,
        memoryId: view.memoryId,
        actorId: view.actorId,
        consentEpoch: lease.consentEpoch,
        startedAt: new Date().toISOString(),
        mimeType: "audio/webm",
        durationMs: 0,
        interrupted: false,
        stage: "recording",
        receipt: null,
      };
      releaseLock = await holdLegacyTakeLock(take.id);
      await storeLegacyTake(take);
      if (attempt !== generation.current || !mounted.current) {
        await removeLegacyTake(take.id);
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (attempt !== generation.current || !mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        await removeLegacyTake(take.id);
        return;
      }
      const fresh = await loadLegacySession(view.id);
      if (
        !fresh.canRecord ||
        fresh.consentEpoch !== lease.consentEpoch ||
        !latest.current.healthy
      )
        throw new Error(
          "Recording choices changed. Review this conversation again.",
        );
      if (attempt !== generation.current || !mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        await removeLegacyTake(take.id);
        return;
      }
      let queue = Promise.resolve(),
        storageFailed = false;
      const current = take;
      epoch.current = lease.consentEpoch;
      capture.current = captureLegacyAudio(stream, {
        chunk: (blob, index, elapsed, mime) => {
          current.durationMs = elapsed;
          current.mimeType = mime;
          const snapshot = { ...current };
          queue = queue
            .then(() => storeLegacyChunk(snapshot, index, blob))
            .catch(() => {
              storageFailed = true;
              capture.current?.stop(true);
              if (mounted.current)
                setError(
                  "Some recording bytes could not be kept on this device. Keep this page open and back up now.",
                );
            });
        },
        stopped: (blob, duration, interrupted) => {
          capture.current = null;
          const finished = {
            ...current,
            mimeType: blob.type,
            durationMs: duration,
            interrupted: interrupted || storageFailed,
            stage: "local" as const,
          };
          volatile.current.set(finished.id, blob);
          void queue
            .then(async () => {
              if (deletion.current) {
                volatile.current.delete(finished.id);
                await removeLegacyTake(finished.id);
                return;
              }
              if (!storageFailed) await storeLegacyTake(finished);
              if (mounted.current) {
                setTakes((previous) => [
                  ...previous.filter((x) => x.id !== finished.id),
                  finished,
                ]);
                setPhase("idle");
                setSeconds(0);
              }
            })
            .catch(() => {
              storageFailed = true;
              if (mounted.current) {
                setTakes((previous) => [
                  ...previous.filter((x) => x.id !== finished.id),
                  finished,
                ]);
                setPhase("idle");
                setError(
                  "Some recording bytes could not be kept on this device. Keep this page open and back up now.",
                );
              }
            })
            .finally(() => {
              if (
                storageFailed &&
                mounted.current &&
                !deletion.current &&
                releaseLock
              )
                heldDraftLocks.current.set(finished.id, releaseLock);
              else releaseLock?.();
            });
        },
      });
      recordingStarted = true;
      setPhase("recording");
      setSeconds(0);
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop());
      if (take) await removeLegacyTake(take.id).catch(() => undefined);
      if (mounted.current && attempt === generation.current) {
        setError(
          e instanceof Error
            ? e.message
            : "The microphone could not open. Please try again.",
        );
        setPhase("idle");
      }
    } finally {
      if (!recordingStarted) releaseLock?.();
    }
  }
  async function keep(take: LocalLegacyTake) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob =
        volatile.current.get(take.id) ?? (await loadLegacyBlob(take));
      const receipt = await preserveLegacyRecording(take, blob);
      if (deletion.current) {
        await removeLegacyTake(take.id);
        return;
      }
      setTakes((previous) =>
        previous.map((x) =>
          x.id === take.id ? { ...take, stage: "durable", receipt } : x,
        ),
      );
      heldDraftLocks.current.get(take.id)?.();
      heldDraftLocks.current.delete(take.id);
      await storeLegacyTake({ ...take, stage: "durable", receipt }).catch(() =>
        setError(
          "Backup is confirmed, but this device could not update its local status.",
        ),
      );
      if (deletion.current) {
        await removeLegacyTake(take.id);
        return;
      }
      setRecordings((await loadLegacyRecordings(view.id, false)).recordings);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This recording's backup was not confirmed. Keep your device copy and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function discard(take: LocalLegacyTake) {
    if (
      busy ||
      !window.confirm(
        t(
          "Discard this device recording? A recording without confirmed backup cannot be recovered.",
        ),
      )
    )
      return;
    setBusy(true);
    try {
      await removeLegacyTake(take.id);
      volatile.current.delete(take.id);
      heldDraftLocks.current.get(take.id)?.();
      heldDraftLocks.current.delete(take.id);
      setTakes((previous) => previous.filter((x) => x.id !== take.id));
    } catch {
      setError("This device recording could not be removed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (deleted)
    return (
      <p role="alert">
        {t("This conversation was deleted. Recording has stopped.")}
      </p>
    );
  const pending = takes.filter(
    (take) =>
      take.stage !== "durable" &&
      !recordings.some((source) => source.recordingId === take.id),
  );
  return (
    <section className="memory-review-section">
      <h2>{t("Our original conversation")}</h2>
      {error && <p role="alert">{notice(error)}</p>}
      {(phase !== "idle" || pending.length > 0 || recordings.length > 0) && (
        <div className="legacy-recording-focus" ref={photoFocus}>
          <img
            src={view.photoUrl}
            alt={t("Photograph we are remembering together")}
          />
        </div>
      )}
      {view.actorRole === "host" && view.mode === "in_person" && (
        <>
          {!localReady && (
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setError(null);
                void refreshLocal().catch(() =>
                  setError(
                    "This browser cannot keep a recoverable local draft.",
                  ),
                );
              }}
            >
              {t("Recheck device recordings")}
            </button>
          )}
          <p>
            {t(
              "One microphone keeps your voices together. Speaker names stay unconfirmed until each person identifies their own words.",
            )}
          </p>
          <p>
            {t(
              "Each recording can last up to {minutes} minutes. You can make another afterward.",
              { minutes: phase1Config.legacy.maxRecordingSeconds / 60 },
            )}
          </p>
          {phase === "idle" && pending.length === 0 && (
            <button
              type="button"
              className="primary-action"
              disabled={!healthy || !view.canRecord || busy || !localReady}
              onClick={() => void start()}
            >
              {t("Record our conversation")}
            </button>
          )}
          {phase === "requesting" && (
            <>
              <p role="status">
                {t("Opening the microphone after both people's agreement…")}
              </p>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  generation.current++;
                  setPhase("idle");
                }}
              >
                {t("Cancel microphone request")}
              </button>
            </>
          )}
          {(phase === "recording" || phase === "paused") && (
            <>
              <p role="status">
                {phase === "paused"
                  ? t("Conversation recording paused")
                  : t("Recording your conversation")}
              </p>
              <p
                role="timer"
                aria-live="off"
                aria-label={t("Recording duration")}
              >
                {t("{seconds} seconds", { seconds })}
              </p>
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  if (phase === "recording") {
                    capture.current?.pause();
                    setPhase("paused");
                  } else {
                    capture.current?.resume();
                    setPhase("recording");
                  }
                }}
              >
                {phase === "paused"
                  ? t("Resume conversation recording")
                  : t("Pause conversation recording")}
              </button>
              <button
                ref={stopControl}
                type="button"
                className="primary-action"
                onClick={() => {
                  setPhase("stopping");
                  capture.current?.stop();
                }}
              >
                {t("Stop and listen together")}
              </button>
            </>
          )}
          {phase === "stopping" && (
            <p role="status">
              {t("Keeping the recorded part on this device…")}
            </p>
          )}
          {pending.map((take) => (
            <div key={take.id}>
              <p role="status">
                {take.interrupted
                  ? t(
                      "An interrupted recording was recovered. Only the recorded part is available; its backup is not confirmed.",
                    )
                  : t(
                      "Your conversation is kept on this device. Its backup is not confirmed yet.",
                    )}
              </p>
              <LocalTakePlayer
                take={take}
                blob={volatile.current.get(take.id)}
              />
              <button
                className="primary-action"
                type="button"
                disabled={busy || phase !== "idle"}
                onClick={() => void keep(take)}
              >
                {busy ? t("Backing up…") : t("Back up this original recording")}
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={busy || phase !== "idle"}
                onClick={() => void discard(take)}
              >
                {t("Discard device recording")}
              </button>
            </div>
          ))}
        </>
      )}
      {takes
        .filter(
          (take) =>
            take.stage === "durable" &&
            !recordings.some((source) => source.recordingId === take.id),
        )
        .map((take) => (
          <p key={take.id} role="status">
            {t("Original conversation backed up privately")}
          </p>
        ))}
      {recordings.map((recording) => (
        <RecordingReplay
          key={recording.recordingId}
          recording={recording}
          view={view}
          onChanged={async () =>
            setRecordings(
              (await loadLegacyRecordings(view.id, view.actorRole === "guest"))
                .recordings,
            )
          }
        />
      ))}
      {recordings.length === 0 && view.actorRole === "guest" && (
        <p>
          {t(
            "A backed-up conversation will appear here after the host preserves it.",
          )}
        </p>
      )}
    </section>
  );
}
function LocalTakePlayer({
  take,
  blob,
}: {
  take: LocalLegacyTake;
  blob?: Blob;
}) {
  useLocale();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true,
      current: string | undefined;
    void (blob ? Promise.resolve(blob) : loadLegacyBlob(take)).then((value) => {
      if (active && value.size) {
        current = URL.createObjectURL(value);
        setUrl(current);
      }
    });
    return () => {
      active = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [take.id, blob]);
  return url ? (
    <audio
      controls
      src={url}
      className="voice-player"
      aria-label={t("Listen to this device recording")}
    />
  ) : (
    <p>
      {t(
        "No playable recording bytes were recovered. Your photograph is unchanged.",
      )}
    </p>
  );
}
function RecordingReplay({
  recording,
  view,
  onChanged,
}: {
  recording: LegacyRecording;
  view: LegacySessionView;
  onChanged: () => Promise<void>;
}) {
  useLocale();
  const [start, setStart] = useState("0"),
    [end, setEnd] = useState(String(recording.durationMs / 1000)),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    key = useRef(`speaker_${crypto.randomUUID()}`);
  const player = useRef<HTMLAudioElement | null>(null);
  async function identify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await legacyRequest(
        legacyPath(
          view.id,
          view.actorRole === "guest",
          `/recordings/${recording.recordingId}/claims`,
        ),
        "POST",
        {
          startMs: Math.round(Number(start) * 1000),
          endMs: Math.round(Number(end) * 1000),
          note,
        },
        key.current,
      );
      key.current = `speaker_${crypto.randomUUID()}`;
      setNote("");
      await onChanged();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your speaker note could not be kept. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article>
      <p className="durable-status" role="status">
        {t("Original conversation backed up privately")}
      </p>
      {recording.interrupted && (
        <p>{t("Partial recording: the conversation was interrupted.")}</p>
      )}
      <audio
        className="voice-player"
        controls
        preload="metadata"
        ref={player}
        src={recording.mediaUrl}
        aria-label={t("Replay the original conversation")}
      />
      <p>
        {t(
          "Speaker attribution is unconfirmed outside people's own identified sections.",
        )}
      </p>
      <ul>
        {recording.claims.map((claim) => (
          <li key={claim.id}>
            <strong>
              {t("Self-identified by {name}", { name: claim.displayName })}
            </strong>{" "}
            · {(claim.startMs / 1000).toLocaleString(getLocale())}–
            {(claim.endMs / 1000).toLocaleString(getLocale())} {t("seconds")}
            {claim.note && <p>{claim.note}</p>}
          </li>
        ))}
      </ul>
      <details>
        <summary>{t("Identify my own words")}</summary>
        <p>
          {t(
            "Listen first, then mark only your own voice. Your note stays separate from the recording and other people's memories.",
          )}
        </p>
        <p>
          {t("Use playback to find your words, then mark their start and end.")}
        </p>
        <button
          className="secondary-action"
          type="button"
          onClick={() =>
            setStart(
              String(
                Math.floor((player.current?.currentTime ?? 0) * 1000) / 1000,
              ),
            )
          }
        >
          {t("My words start here")}
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={() =>
            setEnd(
              String(
                Math.floor((player.current?.currentTime ?? 0) * 1000) / 1000,
              ),
            )
          }
        >
          {t("My words end here")}
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void identify();
          }}
        >
          <label className="memory-field">
            <span>{t("My voice starts at (seconds)")}</span>
            <input
              type="number"
              min="0"
              max={recording.durationMs / 1000}
              step="0.001"
              value={start}
              required
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="memory-field">
            <span>{t("My voice ends at (seconds)")}</span>
            <input
              type="number"
              min="0.001"
              max={recording.durationMs / 1000}
              step="0.001"
              required
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
          <label className="memory-field">
            <span>
              {t("My separate recollection or speaker note (optional)")}
            </span>
            <textarea
              value={note}
              maxLength={phase1Config.legacy.maxSpeakerNoteCharacters}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {error && <p role="alert">{notice(error)}</p>}
          <button type="submit" className="secondary-action" disabled={busy}>
            {t("Keep my speaker note")}
          </button>
        </form>
      </details>
    </article>
  );
}
