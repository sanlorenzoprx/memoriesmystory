import { useEffect, useRef, useState } from "react";
import type { LegacySessionView } from "../../domain/our-living-legacy";
import type { RemoteRecordingView } from "../../domain/legacy-remote-recording";
import { legacyPath, legacyRequest } from "../../services/legacy-api";
import { notice, t, useLocale } from "../../localization/language";
export function RemoteRecordingPanel({
  view,
  healthy,
  onCaptureChange,
}: {
  view: LegacySessionView;
  healthy: boolean;
  onCaptureChange: (active: boolean) => void;
}) {
  useLocale();
  const guest = view.actorRole === "guest";
  const [recordings, setRecordings] = useState<RemoteRecordingView[]>([]),
    [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null),
    pending = useRef(false),
    attemptedAt = useRef(0);
  const base = legacyPath(view.id, guest, "/remote-recordings");
  useEffect(() => {
    let active = true,
      loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const next = await legacyRequest<{
          recordings: RemoteRecordingView[];
          available: boolean;
        }>(base);
        if (active) {
          if (
            next.recordings.some(
              (item) =>
                Date.parse(item.requestedAt) >= attemptedAt.current - 1000,
            )
          )
            pending.current = false;
          setRecordings(next.recordings);
          setAvailable(next.available);
          onCaptureChange(
            pending.current ||
              next.recordings.some((item) => !item.captureStopped),
          );
        }
      } catch {
        if (active)
          setError(
            "Recording status could not be checked. Keep your microphone and camera off if you withdrew consent.",
          );
      } finally {
        loading = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [base, onCaptureChange]);
  const activeRecording = recordings.find(
    (item) =>
      !item.captureStopped ||
      ![
        "preserved",
        "partial_preserved",
        "needs_review",
        "failed",
        "discarded",
      ].includes(item.phase),
  );
  async function action(suffix: string, start = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (start) {
      if (!requestKey.current) attemptedAt.current = Date.now();
      pending.current = true;
      onCaptureChange(true);
      requestKey.current ??= `remote_start_${crypto.randomUUID()}`;
    }
    try {
      await legacyRequest(
        base.split("?")[0] + suffix + (guest ? "?as=guest" : ""),
        "POST",
        {},
        start ? requestKey.current! : undefined,
      );
      if (start) requestKey.current = null;
      const next = await legacyRequest<{ recordings: RemoteRecordingView[] }>(
        base,
      );
      setRecordings(next.recordings);
      pending.current = false;
      onCaptureChange(next.recordings.some((item) => !item.captureStopped));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Our Living Legacy could not continue. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="memory-review-section"
      aria-label={t("Private conversation recordings")}
    >
      <h2>{t("Keep this conversation")}</h2>
      <p>
        {t(
          "Recording keeps a conversation video and a separate audio source from each participant's microphone. Names and speakers need your review.",
        )}
      </p>
      {!available && (
        <p>
          {t(
            "Conversation recording is not available yet. You can still join the call.",
          )}
        </p>
      )}
      {error && <p role="alert">{notice(error)}</p>}
      {!guest && available && !activeRecording && (
        <button
          className="primary-action"
          type="button"
          disabled={busy || !healthy || !view.canRecord}
          onClick={() => void action("", true)}
        >
          {t("Start recording our conversation")}
        </button>
      )}
      {!view.canRecord && (
        <p>{t("Both people must agree before recording can start.")}</p>
      )}
      {activeRecording && !activeRecording.captureStopped && (
        <button
          className="primary-action"
          type="button"
          disabled={busy}
          onClick={() => void action(`/${activeRecording.id}/stop`)}
        >
          {t("Stop conversation recording")}
        </button>
      )}
      {recordings.map((recording) => (
        <article key={recording.id}>
          <p role="status">
            {t(
              recording.phase === "preserved"
                ? "Conversation originals are saved privately. Review the playback for completeness."
                : recording.phase === "partial_preserved"
                  ? "Only part of this conversation was saved. Review each available original."
                  : recording.phase === "recording"
                    ? "This conversation is being recorded."
                    : recording.phase === "processing"
                      ? "Recording stopped. Verifying the private originals…"
                      : recording.phase === "stopping"
                        ? "Stopping recording. Keep your microphone and camera off if you withdrew consent."
                        : ["needs_review", "failed", "discarded"].includes(
                              recording.phase,
                            )
                          ? "This recording needs attention. A complete archive has not been confirmed."
                          : "Preparing recording. Archive backup is not confirmed yet.",
            )}
          </p>
          {recording.sources.map((source) => (
            <div key={source.id}>
              <p>
                {source.kind === "composite_video"
                  ? t("Conversation video")
                  : source.participantId === view.actorId
                    ? t("Audio from your microphone")
                    : t("Audio from your conversation partner's microphone")}
              </p>
              {source.kind === "composite_video" ? (
                <video
                  controls
                  playsInline
                  preload="none"
                  src={source.mediaUrl}
                  aria-label={t("Conversation video")}
                  style={{ width: "100%" }}
                />
              ) : (
                <audio
                  controls
                  preload="none"
                  src={source.mediaUrl}
                  aria-label={t("Original participant audio")}
                />
              )}
              {source.kind === "participant_audio" &&
                source.participantId === view.actorId && (
                  <SpeakerConfirmation
                    source={source}
                    view={view}
                    onConfirmed={() =>
                      setRecordings((items) =>
                        items.map((item) => ({
                          ...item,
                          sources: item.sources.map((value) =>
                            value.id === source.id
                              ? { ...value, speakerConfirmed: true }
                              : value,
                          ),
                        })),
                      )
                    }
                  />
                )}
            </div>
          ))}
          {!guest &&
            recording.captureStopped &&
            ["needs_review", "failed"].includes(recording.phase) && (
              <button
                type="button"
                className="secondary-action"
                disabled={busy}
                onClick={() => void action(`/${recording.id}/retry`)}
              >
                {t("Retry preserving existing recordings")}
              </button>
            )}
        </article>
      ))}
    </section>
  );
}
function SpeakerConfirmation({
  source,
  view,
  onConfirmed,
}: {
  source: RemoteRecordingView["sources"][number];
  view: LegacySessionView;
  onConfirmed: () => void;
}) {
  const [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const key = useRef(`speaker_claim_${crypto.randomUUID()}`);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await legacyRequest(
        `${source.mediaUrl.split("?")[0]}/claim${view.actorRole === "guest" ? "?as=guest" : ""}`,
        "POST",
        { confirm: true, note },
        key.current,
      );
      onConfirmed();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Our Living Legacy could not continue. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return source.speakerConfirmed ? (
    <p>
      {t(
        "You identified your own voice. This note remains separate from the original.",
      )}
    </p>
  ) : (
    <div>
      <p>
        {t(
          "A microphone identifies the recording source, not every voice nearby. Listen before identifying yourself.",
        )}
      </p>
      <label>
        {t("My voice identification note")}
        <textarea
          value={note}
          maxLength={2000}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        {t("I listened and this is my voice.")}
      </label>
      <button
        type="button"
        className="secondary-action"
        disabled={busy || !confirmed || !note.trim()}
        onClick={() => void save()}
      >
        {t("Keep my voice identification")}
      </button>
      {error && <p role="alert">{notice(error)}</p>}
    </div>
  );
}
