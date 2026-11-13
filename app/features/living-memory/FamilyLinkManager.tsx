import { t, notice, useLocale, getLocale } from "../../localization/language";
import { useEffect, useRef, useState } from "react";

import { listFamilyLinks, revokeFamilyLink, type FamilyLink } from "../../services/living-memory-api";

export function FamilyLinkManager({ livingMemoryId, onRevoked }: {
  readonly livingMemoryId: string;
  readonly onRevoked?: () => void;
}) {
  useLocale();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<readonly FamilyLink[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef(false);
  const panel = useRef<HTMLElement | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    return () => { generation.current += 1; };
  }, [livingMemoryId]);

  async function load(before?: string) {
    if (pending.current) return;
    pending.current = true;
    const current = generation.current;
    setBusy(true);
    setMessage(null);
    try {
      const page = await listFamilyLinks(livingMemoryId, before);
      if (current !== generation.current) return;
      setLinks((previous) => before ? [...previous, ...page.shares] : page.shares);
      setCursor(page.nextCursor);
    } catch (error) {
      if (current === generation.current) {
        setMessage(error instanceof Error ? error.message : "Family links could not be loaded. Try again.");
      }
    } finally {
      pending.current = false;
      if (current === generation.current) setBusy(false);
    }
  }

  async function revoke(link: FamilyLink) {
    if (pending.current || !window.confirm(t("Revoke this family link? Anyone using it will lose access. Downloaded copies cannot be recalled."))) return;
    pending.current = true;
    const current = generation.current;
    setBusy(true);
    setMessage(null);
    try {
      await revokeFamilyLink(livingMemoryId, link.shareId);
      if (current !== generation.current) return;
      onRevoked?.();
      panel.current?.focus();
      const page = await listFamilyLinks(livingMemoryId);
      if (current !== generation.current) return;
      setLinks(page.shares);
      setCursor(page.nextCursor);
      setMessage("Family link revoked. Its page, photograph and voice are no longer available through that link.");
    } catch (error) {
      if (current === generation.current) {
        setMessage(error instanceof Error ? error.message : "The link status could not be confirmed. Refresh and try again.");
      }
    } finally {
      pending.current = false;
      if (current === generation.current) setBusy(false);
    }
  }

  return (
    <section ref={panel} tabIndex={-1} className="memory-review-section" aria-label={t("Manage family links")}>
      <button className="secondary-action" type="button" aria-expanded={open}
        onClick={() => { setOpen(!open); if (!open) void load(); }}>{t("Manage family links")}</button>
      {open && <>
        <p>{t("Anyone with a family link can open it without signing in. Revoke a link to stop future access; copies already downloaded or shared elsewhere cannot be recalled.")}</p>
        <p>{t("For your privacy, previous link addresses are not shown here. To share again, create a new link from Share with family.")}</p>
        {busy && <p role="status">{t("Updating family links…")}</p>}
        {message && <p role="status">{notice(message)}</p>}
        <button type="button" className="light-text-action" disabled={busy} onClick={() => void load()}>{t("Refresh family links")}</button>
        {!busy && links.length === 0 && !message && <p>{t("No family links have been created.")}</p>}
        <ul className="family-link-list">
          {links.map((link) => <li key={link.shareId}>
            <p><strong>{link.revokedAt ? t("Revoked") : t("Active")}</strong> {t("· Created")} {new Date(link.createdAt).toLocaleString(getLocale())}</p>
            <p>{t("Photograph")}{link.selection.includeVoice ? t(", original voice") : ""}{link.selection.includeCaptions ? t(", captions") : ""}</p>
            {link.revokedAt ? <p>{t("Revoked")} {new Date(link.revokedAt).toLocaleString(getLocale())}</p> :
              <button type="button" className="secondary-action" disabled={busy} onClick={() => void revoke(link)}>{t("Revoke family link")}</button>}
          </li>)}
        </ul>
        {cursor && <button type="button" className="secondary-action" disabled={busy} onClick={() => void load(cursor)}>{t("Load older links")}</button>}
      </>}
    </section>
  );
}
