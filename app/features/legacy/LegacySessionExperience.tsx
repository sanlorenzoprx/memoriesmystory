import { LegacyRemoteCall } from "./LegacyRemoteCall";
import { LegacyRecordingPanel } from "./LegacyRecordingPanel";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { phase1Config } from "../../../config/phase-1";
import type {
  LegacyMode,
  LegacySessionView,
} from "../../domain/our-living-legacy";
import {
  LegacyApiError,
  createLegacySession,
  legacyRequest,
  legacyPath,
  loadLegacySession,
} from "../../services/legacy-api";
import { t, notice, useLocale } from "../../localization/language";
function Frame({ children }: { children: React.ReactNode }) {
  useLocale();
  return (
    <div className="quiet-page" id="main-content">
      <section className="capture-introduction archive-card">
        <p className="eyebrow">{t("Our Living Legacy")}</p>
        {children}
        <Link className="secondary-action" to="/archive">
          {t("Return to my archive")}
        </Link>
      </section>
    </div>
  );
}
export function NewLegacySession() {
  useLocale();
  const [search] = useSearchParams(),
    navigate = useNavigate(),
    [displayName, setName] = useState(""),
    [mode, setMode] = useState<LegacyMode>("in_person"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const memoryId = search.get("memoryId") ?? "";
  const [sessions, setSessions] = useState<
    { id: string; mode: LegacyMode; status: string; createdAt: string }[]
  >([]);
  useEffect(() => {
    let active = true;
    void legacyRequest<{ sessions: typeof sessions }>(
      `/resources/legacy-sessions?memoryId=${encodeURIComponent(memoryId)}`,
    )
      .then((value) => {
        if (active) setSessions(value.sessions);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Our Living Legacy could not continue. Please try again.",
          );
      });
    return () => {
      active = false;
    };
  }, [memoryId]);
  const key = useRef(`legacy_create_${crypto.randomUUID()}`);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createLegacySession(
        { memoryId: search.get("memoryId") ?? "", displayName, mode },
        key.current,
      );
      await navigate(`/legacy/${result.sessionId}`, {
        state: { joinPath: result.joinPath },
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Our Living Legacy could not continue. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <Frame>
      <h1>{t("Remember together around this photograph.")}</h1>
      <p>
        {t(
          "Invite one person. Your private archive stays private; this session shares only its selected photograph and agreed session material.",
        )}
      </p>
      {sessions.length > 0 && (
        <section>
          <h2>{t("Continue a private conversation")}</h2>
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                <Link className="secondary-action" to={`/legacy/${session.id}`}>
                  {session.mode === "remote"
                    ? t("At a distance")
                    : t("In person")}{" "}
                  · {new Date(session.createdAt).toLocaleDateString()}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label className="memory-field">
          <span>{t("Your name for this conversation")}</span>
          <input
            value={displayName}
            onChange={(event) => setName(event.target.value)}
            maxLength={phase1Config.legacy.maxNameCharacters}
            required
            disabled={busy}
          />
        </label>
        <label className="memory-field">
          <span>{t("How will you remember together?")}</span>
          <select
            value={mode}
            disabled={busy}
            onChange={(event) => setMode(event.target.value as LegacyMode)}
          >
            <option value="in_person">{t("In person")}</option>
            <option value="remote">{t("At a distance")}</option>
          </select>
        </label>
        {error && <p role="alert">{notice(error)}</p>}
        <button className="primary-action" disabled={busy} type="submit">
          {busy ? t("Opening…") : t("Create our private session")}
        </button>
      </form>
    </Frame>
  );
}
export function JoinLegacySession() {
  useLocale();
  const { sessionId = "" } = useParams(),
    navigate = useNavigate(),
    [displayName, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [token] = useState(() => window.location.hash.slice(1)),
    key = useRef(`legacy_join_${crypto.randomUUID()}`);
  async function join() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await legacyRequest(
        legacyPath(sessionId, false, "/join"),
        "POST",
        { inviteToken: token, displayName },
        key.current,
      );
      await navigate(`/legacy/${sessionId}?as=guest`, { replace: true });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Our Living Legacy could not continue. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <Frame>
      <h1>{t("You are invited to remember together.")}</h1>
      <p>
        {t(
          "This invitation opens one private conversation. It does not grant access to the host's archive. You choose whether your voice and video may be recorded.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void join();
        }}
      >
        <label className="memory-field">
          <span>{t("Your name for this conversation")}</span>
          <input
            required
            maxLength={phase1Config.legacy.maxNameCharacters}
            value={displayName}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {error && <p role="alert">{notice(error)}</p>}
        <button
          type="submit"
          className="primary-action"
          disabled={busy || !/^[A-Za-z0-9_-]{43}$/.test(token)}
        >
          {busy ? t("Opening…") : t("Join this private conversation")}
        </button>
      </form>
      <Link className="secondary-action" to={`/legacy/${sessionId}?as=guest`}>
        {t("Reopen my joined conversation")}
      </Link>
    </Frame>
  );
}

export function LegacySessionExperience() {
  useLocale();
  const { sessionId = "" } = useParams(),
    [search] = useSearchParams(),
    guest = search.get("as") === "guest";
  const [view, setView] = useState<LegacySessionView | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [agreed, setAgreed] = useState(false);
  const [joinPath, setJoinPath] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!guest)
      void legacyRequest<{ joinPath: string | null }>(
        legacyPath(sessionId, false, "/invitation"),
      )
        .then((value) => {
          if (active) setJoinPath(value.joinPath);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [sessionId, guest]);
  useEffect(() => {
    let active = true,
      pending = false;
    setView(null);setError(null);setAgreed(false);
    async function refresh() {
      if (!active || pending) return;
      pending = true;
      try {
        const next = await loadLegacySession(sessionId, guest);
        if (active) {
          setView(next);
          setError(null);
        }
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "Our Living Legacy could not continue. Please try again.",
          );
          if (
            e instanceof LegacyApiError &&
            [401, 403, 404].includes(e.status)
          ) {
            setView(null);
            active = false;
            clearInterval(timer);
          }
        }
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = setInterval(
      () => void refresh(),
      phase1Config.legacy.pollIntervalMs,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId, guest]);
  async function consent(agree: boolean) {
    if (!view || busy) return;
    setBusy(true);
    try {
      await legacyRequest(legacyPath(sessionId, guest, "/consent"), "POST", {
        agree,
        version: view.consentVersion,
      });
      setView(await loadLegacySession(sessionId, guest));
      setAgreed(false);
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
  async function revoke(participantId: string) {
    if (
      busy ||
      !window.confirm(
        t("Remove this participant's access to this conversation?"),
      )
    )
      return;
    setBusy(true);
    try {
      await legacyRequest(legacyPath(sessionId, false, "/revoke"), "POST", {
        participantId,
      });
      setView(await loadLegacySession(sessionId, guest));
      setJoinPath(null);
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
  const mine = view?.participants.find((p) => p.id === view.actorId);
  return (
    <Frame>
      <h1>{t("One photograph. Two people's memories.")}</h1>
      {error && <p role="alert">{notice(error)}</p>}
      {!view && !error && (
        <p role="status">{t("Opening your private conversation…")}</p>
      )}
      {view && (
        <>
          <div className="story-photo-focus">
            <img
              src={view.photoUrl}
              alt={t("The photograph selected for this conversation")}
            />
          </div>
          <ul>
            {view.participants.map((p) => (
              <li key={p.id}>
                <strong>{p.displayName ?? t("Invited participant")}</strong> —{" "}
                {p.revoked
                  ? t("Access removed")
                  : !p.joined
                    ? t("Waiting to join")
                    : p.consent === "accepted"
                      ? t("Recording consent given")
                      : p.consent === "declined"
                        ? t("Recording declined")
                        : t("Recording choice pending")}
                {view.actorRole === "host" &&
                  p.role === "guest" &&
                  !p.revoked && (
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={busy}
                      onClick={() => void revoke(p.id)}
                    >
                      {t("Remove access")}
                    </button>
                  )}
              </li>
            ))}
          </ul>
          {view.actorRole === "host" && joinPath && (
            <label className="memory-field">
              <span>{t("Private invitation for one person")}</span>
              <input
                readOnly
                value={new URL(joinPath, window.location.origin).toString()}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          )}
          <section className="memory-review-section">
            <h2>{t("Your recording choice")}</h2>
            <p>
              {view.mode === "remote"
                ? t(
                    "A remote session can record your own voice and video. Recording needs both people's agreement. The session stays private.",
                  )
                : t(
                    "An in-person session can record your voices on one microphone. Individual speakers stay unconfirmed until people label their own words.",
                  )}
            </p>
            <p>
              {t(
                "You can decline recording or withdraw your agreement. No recording starts until both people agree.",
              )}
            </p>
            {mine?.consent !== "accepted" ? (
              <>
                <label className="share-option">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    disabled={busy}
                  />
                  {t("I agree to recording this private conversation.")}
                </label>
                <button
                  type="button"
                  className="primary-action"
                  disabled={!agreed || busy}
                  onClick={() => void consent(true)}
                >
                  {t("Give my recording consent")}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => void consent(false)}
                >
                  {t("Decline recording")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="secondary-action"
                disabled={busy}
                onClick={() => void consent(false)}
              >
                {t("Withdraw my recording consent")}
              </button>
            )}
          </section>
          {view.mode === "remote" && <LegacyRemoteCall key={`${view.id}:${view.actorId}:call`} view={view} healthy={!error} />}
          <LegacyRecordingPanel key={`${view.id}:${view.actorId}`} view={view} healthy={!error}/>
          <p role="status">
            {view.canRecord
              ? t("Both of you have agreed to recording.")
              : t(
                  "Recording is not permitted until both people join and agree.",
                )}
          </p>
        </>
      )}
    </Frame>
  );
}
