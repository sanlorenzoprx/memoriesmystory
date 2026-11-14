import { useEffect, useRef, useState } from "react";
import type RealtimeKitClient from "@cloudflare/realtimekit";
import type { RTKParticipant, RTKSelf } from "@cloudflare/realtimekit";
import type { LegacySessionView } from "../../domain/our-living-legacy";
import { legacyPath, legacyRequest } from "../../services/legacy-api";
import { notice, t, useLocale } from "../../localization/language";

function CallVideo({
  peer,
  local,
}: {
  peer: RTKParticipant | RTKSelf;
  local: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => {
      if (video.current) {
        video.current.srcObject =
          peer.videoEnabled && peer.videoTrack
            ? new MediaStream([peer.videoTrack])
            : null;
      }
      refresh((n) => n + 1);
    };
    update();
    const events = peer as RTKParticipant;
    events.on("videoUpdate", update);
    return () => {
      events.removeListener("videoUpdate", update);
      if (video.current) video.current.srcObject = null;
    };
  }, [peer]);
  return (
    <div>
      <p>{local ? t("You") : t("Your conversation partner")}</p>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label={local ? t("Your camera") : t("Your conversation partner")}
        style={{
          width: "100%",
          maxHeight: "12rem",
          background: "#222",
          borderRadius: "0.75rem",
        }}
      />
      {!peer.videoEnabled && <p>{t("Camera off. You can still talk.")}</p>}
    </div>
  );
}

export function LegacyRemoteCall({
  view,
  healthy,
}: {
  view: LegacySessionView;
  healthy: boolean;
}) {
  useLocale();
  const guest = view.actorRole === "guest";
  const meetingRef = useRef<RealtimeKitClient | null>(null);
  const mounted = useRef(true);
  const joining = useRef(false);
  const [meeting, setMeeting] = useState<RealtimeKitClient | null>(null);
  const [peers, setPeers] = useState<RTKParticipant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Join when you are ready.");
  const [audio, setAudio] = useState(false);
  const [video, setVideo] = useState(false);
  const generation = useRef(0);
  const listeners = useRef<(() => void) | null>(null);
  const mayJoin = healthy && view.status !== "closed";

  async function leave() {
    generation.current++;
    listeners.current?.();
    listeners.current = null;
    const current = meetingRef.current;
    meetingRef.current = null;
    if (mounted.current) {
      setMeeting(null);
      setPeers([]);
      setStatus("You have left the call.");
    }
    if (current) {
      await Promise.allSettled([
        current.self.disableAudio(),
        current.self.disableVideo(),
      ]);
      await current.leave().catch(() => {});
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void leave();
    };
  }, []);
  useEffect(() => {
    if (!mayJoin) void leave();
  }, [mayJoin]);

  async function join() {
    if (joining.current || meetingRef.current || !mayJoin) return;
    joining.current = true;
    setBusy(true);
    setError(null);
    setStatus("Connecting your call…");
    const attempt = ++generation.current;
    let client: RealtimeKitClient | null = null;
    try {
      const { authToken } = await legacyRequest<{ authToken: string }>(
        legacyPath(view.id, guest, "/call"),
        "POST",
        {},
      );
      const { default: Client } = await import("@cloudflare/realtimekit");
      if (!mounted.current || attempt !== generation.current) return;
      client = await Client.init({
        authToken,
        defaults: { audio: false, video: false },
      });
      if (!mounted.current || attempt !== generation.current) {
        await client.leave();
        return;
      }
      meetingRef.current = client;
      const current = client;
      const changed = () => {
        if (mounted.current && meetingRef.current === current) {
          setPeers(current.participants.joined.toArray());
          setAudio(current.self.audioEnabled);
          setVideo(current.self.videoEnabled);
        }
      };
      const connected = () => {
        if (!mounted.current || meetingRef.current !== current) return;
        const states = [
          current.meta.mediaState.send.state,
          current.meta.mediaState.recv.state,
        ];
        setStatus(
          states.some((state) =>
            ["failed", "reconnecting", "disconnected"].includes(state),
          )
            ? "Connection interrupted. Trying to reconnect…"
            : "You are connected. This call is not being recorded.",
        );
      };
      const lost = () => {
        void leave();
      };
      const poor = () => {
        void current.self
          .disableVideo()
          .then(changed)
          .catch(() => {});
        if (mounted.current)
          setStatus("Connection is weak. Continue with audio.");
      };
      const socket = ({ state }: { state: string }) => {
        if (!mounted.current) return;
        if (state === "connected") connected();
        else setStatus("Connection interrupted. Trying to reconnect…");
      };
      current.participants.joined.on("participantsUpdate", changed);
      current.self.on("audioUpdate", changed);
      current.self.on("videoUpdate", changed);
      current.self.on("roomLeft", lost);
      current.self.on("roomJoined", connected);
      current.meta.on("mediaConnectionUpdate", connected);
      current.meta.on("poorConnection", poor);
      current.meta.on("socketConnectionUpdate", socket);
      listeners.current = () => {
        current.participants.joined.removeListener(
          "participantsUpdate",
          changed,
        );
        current.self.removeListener("audioUpdate", changed);
        current.self.removeListener("videoUpdate", changed);
        current.self.removeListener("roomLeft", lost);
        current.self.removeListener("roomJoined", connected);
        current.meta.removeListener("mediaConnectionUpdate", connected);
        current.meta.removeListener("poorConnection", poor);
        current.meta.removeListener("socketConnectionUpdate", socket);
      };
      await current.join();
      if (!mounted.current || attempt !== generation.current) {
        await leave();
        return;
      }
      setMeeting(current);
      changed();
      connected();
    } catch (e) {
      if (client && meetingRef.current !== client)
        await client.leave().catch(() => {});
      await leave();
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "Your call could not connect. Please try again.",
        );
    } finally {
      joining.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function toggle(kind: "audio" | "video") {
    const current = meetingRef.current;
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "audio") {
        if (current.self.audioEnabled) await current.self.disableAudio();
        else await current.self.enableAudio();
      } else {
        if (current.self.videoEnabled) await current.self.disableVideo();
        else await current.self.enableVideo();
      }
      if (!mounted.current || meetingRef.current !== current) {
        await Promise.allSettled([
          current.self.disableAudio(),
          current.self.disableVideo(),
        ]);
        return;
      }
      setAudio(current.self.audioEnabled);
      setVideo(current.self.videoEnabled);
    } catch {
      setError(
        "Your microphone or camera could not start. Check your browser permissions and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="memory-review-section"
      aria-label={t("Your private call")}
    >
      <h2>{t("Talk around this photograph")}</h2>
      <p>
        {t(
          "Joining does not give recording consent. This call is not being recorded.",
        )}
      </p>
      <p role="status">{t(status)}</p>
      {error && <p role="alert">{notice(error)}</p>}
      {!meeting ? (
        <button
          type="button"
          className="primary-action"
          disabled={busy || !mayJoin}
          onClick={() => void join()}
        >
          {busy ? t("Connecting your call…") : t("Join the call")}
        </button>
      ) : (
        <>
          <CallVideo peer={meeting.self} local />
          {peers.map((peer) => (
            <CallVideo peer={peer} local={false} key={peer.id} />
          ))}
          {peers.length === 0 && (
            <p>{t("Waiting for your conversation partner.")}</p>
          )}
          <button
            type="button"
            className="secondary-action"
            disabled={busy}
            onClick={() => void toggle("audio")}
          >
            {audio ? t("Mute microphone") : t("Turn on microphone")}
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={busy}
            onClick={() => void toggle("video")}
          >
            {video ? t("Turn off camera") : t("Turn on camera")}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() =>
              void meeting.audio
                .play()
                .catch(() =>
                  setError("Tap again to hear your conversation partner."),
                )
            }
          >
            {t("Hear my conversation partner")}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => void leave()}
          >
            {t("Leave call")}
          </button>
        </>
      )}
    </section>
  );
}
