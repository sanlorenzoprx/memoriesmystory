import { phase1Config } from "../../../config/phase-1";
import { useEffect, useRef, useState } from "react";
import type { FamilyArchiveIndex } from "../../domain/family-archive";
import type { FamilyInvite } from "../../domain/family-access";
import { familyAccessRequest } from "../../services/family-access";
import { t, notice, useLocale } from "../../localization/language";
export function FamilyInvitationsPanel({
  view,
  onDirty,
}: {
  view: FamilyArchiveIndex;
  onDirty: (dirty: boolean) => void;
}) {
  useLocale();
  const [grants, setGrants] = useState<FamilyInvite[] | null>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<"viewer" | "contributor">("viewer"),
    [scope, setScope] = useState<"memory" | "chapter" | "archive">("memory"),
    [scopeId, setScopeId] = useState(view.memories[0]?.id ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [link, setLink] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const key = useRef<string | null>(null);
  useEffect(() => () => onDirty(false), [onDirty]);
  function changed() {
    key.current = null;
    setLink(null);
    setCopied(false);
    onDirty(true);
  }
  async function refresh(more = false) {
    const result = await familyAccessRequest<{
      grants: FamilyInvite[];
      nextCursor: string | null;
    }>(
      `/grants?archiveId=${encodeURIComponent(view.archiveId!)}${more && cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`,
    );
    if (!Array.isArray(result.grants))
      throw new Error("Family access could not be opened. Please try again.");
    setGrants((old) =>
      more ? [...(old ?? []), ...result.grants] : result.grants,
    );
    setCursor(result.nextCursor);
  }
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
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
    <details className="memory-review-section">
      <summary>{t("Invite family")}</summary>
      <p>
        {t(
          "Choose exactly what this person can open. The invitation is for their verified email account; copying its link does not grant access.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={() => void action(() => refresh())}
      >
        {t("Review family access")}
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            key.current ??= `family_invite_${crypto.randomUUID()}`;
            const result = await familyAccessRequest<{
              id: string;
              version: number;
              joinPath: string;
            }>(
              "/grants",
              "POST",
              {
                archiveId: view.archiveId,
                scopeKind: scope,
                scopeId: scope === "archive" ? view.archiveId : scopeId,
                role,
                targetEmail: email,
              },
              key.current,
            );
            if (!/^\/family\/join\/[a-f0-9]{64}$/.test(result.joinPath))
              throw new Error(
                "Family access could not be opened. Please try again.",
              );
            await refresh();
            setLink(new URL(result.joinPath, window.location.origin).href);
            onDirty(false);
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {t("Their email address")}
            <input
              required
              type="email"
              value={email}
              maxLength={254}
              autoComplete="off"
              onChange={(e) => {
                setEmail(e.target.value);
                changed();
              }}
            />
          </label>
          <label>
            {t("Family permission")}
            <select
              aria-label={t("Family permission")}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as typeof role);
                changed();
              }}
            >
              <option value="viewer">{t("Can view")}</option>
              <option value="contributor">
                {t("Can view and contribute")}
              </option>
            </select>
          </label>
          <label>
            {t("What can they open?")}
            <select
              aria-label={t("What can they open?")}
              value={scope}
              onChange={(e) => {
                const value = e.target.value as typeof scope;
                setScope(value);
                setScopeId(
                  value === "chapter"
                    ? (view.chapters[0]?.id ?? "")
                    : (view.memories[0]?.id ?? ""),
                );
                changed();
              }}
            >
              <option value="memory">{t("One Living Memory")}</option>
              <option value="chapter" disabled={!view.chapters.length}>
                {t("One Chapter")}
              </option>
              <option value="archive">
                {t("Memories in this archive’s Chapters")}
              </option>
            </select>
          </label>
          {scope !== "archive" && (
            <label>
              {t("Choose the memory or Chapter")}
              <select
                required
                aria-label={t("Choose the memory or Chapter")}
                value={scopeId}
                onChange={(e) => {
                  setScopeId(e.target.value);
                  changed();
                }}
              >
                <option value="">{t("Choose one")}</option>
                {scope === "chapter"
                  ? view.chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))
                  : view.memories.map((m, index) => (
                      <option key={m.id} value={m.id}>
                        {m.title ||
                          t("Living Memory {number}", { number: index + 1 })}
                      </option>
                    ))}
              </select>
            </label>
          )}
          <p>
            {t(
              "They can open the selected original photographs and voices after accepting. This does not grant your other personal memories or external sharing rights.",
            )}
          </p>
          {scope !== "memory" && (
            <p>
              {t(
                "Memories you add to this Chapter or archive later will also be available to this person.",
              )}
            </p>
          )}
          <p>
            {t(
              "The invitation expires after {hours} hours. You can remove access at any time.",
              { hours: phase1Config.familyAccess.invitationHours },
            )}
          </p>
          <button
            type="submit"
            className="primary-action"
            disabled={scope !== "archive" && !scopeId}
          >
            {t("Create family invitation")}
          </button>
        </fieldset>
      </form>
      {link && (
        <div>
          <p role="status">{t("Your family invitation is ready.")}</p>
          <label htmlFor="family-invitation-link">
            {t("Private family invitation link")}
          </label>
          <input
            id="family-invitation-link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() => {
              if (!navigator.clipboard) {
                setError("Select and copy the invitation link above.");
                return;
              }
              void navigator.clipboard
                .writeText(link)
                .then(() => setCopied(true))
                .catch(() =>
                  setError("Select and copy the invitation link above."),
                );
            }}
          >
            {t(copied ? "Invitation link copied" : "Copy invitation link")}
          </button>
          <p>
            {t(
              "Send this link to the person you invited using your usual messaging app.",
            )}
          </p>
        </div>
      )}
      {grants && (
        <ul className="archive-list">
          {grants.map((grant) => (
            <li key={grant.id}>
              <strong>{grant.targetEmail}</strong>
              <p>
                {t(
                  grant.role === "viewer"
                    ? "Can view"
                    : "Can view and contribute",
                )}{" "}
                —{" "}
                {t(
                  grant.scopeKind === "memory"
                    ? "One Living Memory"
                    : grant.scopeKind === "chapter"
                      ? "One Chapter"
                      : "Memories in this archive’s Chapters",
                )}
              </p>
              <p>
                {t(
                  grant.state === "revoked"
                    ? "Access removed"
                    : grant.state === "accepted"
                      ? "Invitation accepted"
                      : new Date(grant.expiresAt).getTime() <= Date.now()
                        ? "Invitation expired"
                        : "Invitation pending",
                )}
              </p>
              {grant.state !== "revoked" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(t("Remove this person’s family access?"))
                    )
                      void action(async () => {
                        await familyAccessRequest(
                          `/grants/${grant.id}/revoke`,
                          "POST",
                          { version: grant.version },
                        );
                        await refresh();
                        setLink(null);
                      });
                  }}
                >
                  {t("Remove family access")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void action(() => refresh(true))}
        >
          {t("More family invitations")}
        </button>
      )}
    </details>
  );
}
