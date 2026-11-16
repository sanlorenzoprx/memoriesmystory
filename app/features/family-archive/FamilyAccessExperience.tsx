import { FamilyContributionsPanel } from './FamilyContributionsPanel';
import { FamilySearchPanel } from './FamilySearchPanel';
import { FamilyArchivePanel } from './FamilyArchivePanel';
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import type {
  FamilyMembership,
  FamilySharedMemory,
} from "../../domain/family-access";
import { familyAccessRequest } from "../../services/family-access";
import { t, notice, useLocale } from "../../localization/language";
export function FamilyAccessExperience() {
  useLocale();
  const { token } = useParams(),
    [memberships, setMemberships] = useState<FamilyMembership[]>([]),
    [membershipCursor, setMembershipCursor] = useState<string | null>(null),
    [selected, setSelected] = useState<FamilyMembership | null>(null),
    [memories, setMemories] = useState<FamilySharedMemory[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [preview, setPreview] = useState<{
      role: string;
      scopeKind: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [loaded, setLoaded] = useState(false);
  const activeRequest = useRef(0);
  const returnPath =
    token && /^[a-f0-9]{64}$/.test(token) ? `/family/join/${token}` : "/family";
  useEffect(() => {
    let active = true;
    setSelected(null);
    setMemories([]);
    setCursor(null);
    setPreview(null);
    setMemberships([]);
    setMembershipCursor(null);
    setError(null);
    setLoaded(false);
    const path = token
      ? `/invite/${encodeURIComponent(token)}`
      : "/memberships";
    void familyAccessRequest<{
      role: string;
      scopeKind: string;
      memberships: FamilyMembership[];
      nextCursor: string | null;
    }>(path)
      .then((value) => {
        if (!active) return;
        if (token) setPreview(value);
        else {
          if (!Array.isArray(value.memberships))
            throw new Error(
              "Family access could not be opened. Please try again.",
            );
          setMemberships(value.memberships);
          setMembershipCursor(value.nextCursor);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setError("Family access could not be opened. Please try again.");
      });
    return () => {
      active = false;
      activeRequest.current++;
    };
  }, [token]);
  async function open(membership: FamilyMembership, more = false) {
    const sequence = ++activeRequest.current;
    setBusy(true);
    setError(null);
    if (!more) {
      setSelected(null);
      setMemories([]);
      setCursor(null);
    }
    try {
      const value = await familyAccessRequest<{
        membership: FamilyMembership;
        memories: FamilySharedMemory[];
        nextCursor: string | null;
      }>(
        `/memberships/${membership.id}/view${more && cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
      );
      if (sequence !== activeRequest.current) return;
      if (!Array.isArray(value.memories) || !value.membership)
        throw new Error("Family access could not be opened. Please try again.");
      setSelected(value.membership);
      setMemories((old) =>
        more ? [...old, ...value.memories] : value.memories,
      );
      setCursor(value.nextCursor);
    } catch {
      if (sequence === activeRequest.current) {
        setMemories([]);
        setSelected(null);
        setError("Family access could not be opened. Please try again.");
      }
    } finally {
      if (sequence === activeRequest.current) setBusy(false);
    }
  }
  async function accept() {
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await familyAccessRequest<{ id: string; version: number }>(
        `/invite/${encodeURIComponent(token)}/accept`,
        "POST",
        {},
      );
      setPreview(null);
      await open({
        id: result.id,
        role: preview?.role === "contributor" ? "contributor" : "viewer",
        scopeKind: (preview?.scopeKind ??
          "memory") as FamilyMembership["scopeKind"],
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Family access could not be opened. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="quiet-page" id="main-content">
      <h1>{t("Remember with your family")}</h1>
      <p>
        {t(
          "Only the memories deliberately shared with your account appear here.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      <Link
        className="secondary-action"
        to={`/auth/protect?returnTo=${encodeURIComponent(returnPath)}`}
      >
        {t("Sign in with your invited email")}
      </Link>
      {token && preview && (
        <section>
          <h2>{t("Your family invitation")}</h2>
          <p>
            {t(
              preview.role === "contributor"
                ? "Can view and contribute"
                : "Can view",
            )}{" "}
            —{" "}
            {t(
              preview.scopeKind === "memory"
                ? "One Living Memory"
                : preview.scopeKind === "chapter"
                  ? "One Chapter"
                  : "Memories in this album’s Chapters",
            )}
          </p>
          <p>
            {t(
              "Use the verified email account your family member invited. Accepting does not share your own memories.",
            )}
          </p>
          <button
            type="button"
            className="primary-action"
            disabled={busy}
            onClick={() => void accept()}
          >
            {t("Accept family invitation")}
          </button>
        </section>
      )}
      {!token &&
        memberships.map((membership, index) => (
          <button
            key={membership.id}
            type="button"
            className="secondary-action"
            disabled={busy}
            onClick={() => void open(membership)}
          >
            {membership.label ||
              t("Open family memories {number}", { number: index + 1 })}
          </button>
        ))}
      {membershipCursor && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void familyAccessRequest<{
              memberships: FamilyMembership[];
              nextCursor: string | null;
            }>(`/memberships?after=${encodeURIComponent(membershipCursor)}`)
              .then((value) => {
                if (!Array.isArray(value.memberships)) throw new Error();
                setMemberships((old) => [...old, ...value.memberships]);
                setMembershipCursor(value.nextCursor);
              })
              .catch(() =>
                setError(
                  "Family access could not be opened. Please try again.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {t("More family invitations")}
        </button>
      )}
      {loaded && !memberships.length && (
        <p>
          {t("No family invitations have been accepted by this account yet.")}
        </p>
      )}
      {selected && (
        <section aria-label={t("Shared family memories")}>
          <h2>{t("Shared family memories")}</h2>
          <FamilySearchPanel grantId={selected.id} />
          {selected.canOrganizeAlbums && (
            <section aria-label={t("Albums you can make")}>
              <h3>{t("Albums you can make")}</h3>
              <p>
                {t(
                  "The archive owner lets you make albums from the memories shared with you. Your albums stay in their family archive, and they can change or remove them.",
                )}
              </p>
              <FamilyArchivePanel
                key={`albums_${selected.id}`}
                grantId={selected.id}
              />
            </section>
          )}
          {!memories.length && (
            <p>
              {t(
                "No complete memories are available in this invitation’s scope right now.",
              )}
            </p>
          )}
          {memories.map((memory, index) => (
            <article className="memory-review-section" key={memory.id}>
              <h3>
                {memory.title ||
                  t("Living Memory {number}", { number: index + 1 })}
              </h3>
              {memory.photoUrl ? (
                <img
                  className="memory-photo"
                  src={memory.photoUrl}
                  alt={t("Shared original photograph")}
                />
              ) : (
                <p>{t("The original photograph is unavailable right now.")}</p>
              )}
              {memory.audioUrl ? (
                <>
                  <p>{t("Original voice")}</p>
                  <audio controls preload="none" src={memory.audioUrl} />
                </>
              ) : (
                <p>{t("The original voice is unavailable right now.")}</p>
              )}
            <FamilyContributionsPanel key={`${selected.id}:${memory.id}`} memoryId={memory.id} grantId={selected.id}/>
            </article>
          ))}
          {cursor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void open(selected, true)}
            >
              {t("More shared memories")}
            </button>
          )}
        </section>
      )}
      <Link className="secondary-action" to="/archive">
        {t("My private archive")}
      </Link>
      {token && (
        <Link className="secondary-action" to="/family">
          {t("All my family invitations")}
        </Link>
      )}
    </div>
  );
}
