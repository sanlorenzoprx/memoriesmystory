import { useEffect, useRef, useState } from "react";

import { listFamilyLinks, revokeFamilyLink, type FamilyLink } from "../../services/living-memory-api";

export function FamilyLinkManager({ livingMemoryId, onRevoked }: {
  readonly livingMemoryId: string;
  readonly onRevoked?: () => void;
}) {
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
    if (pending.current || !window.confirm("Revoke this family link? Anyone using it will lose access. Downloaded copies cannot be recalled.")) return;
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
    <section ref={panel} tabIndex={-1} className="memory-review-section" aria-label="Manage family links">
      <button className="secondary-action" type="button" aria-expanded={open}
        onClick={() => { setOpen(!open); if (!open) void load(); }}>
        Manage family links
      </button>
      {open && <>
        <p>Anyone with a family link can open it without signing in. Revoke a link to stop future access; copies already downloaded or shared elsewhere cannot be recalled.</p>
        <p>For your privacy, previous link addresses are not shown here. To share again, create a new link from Share with family.</p>
        {busy && <p role="status">Updating family links…</p>}
        {message && <p role="status">{message}</p>}
        <button type="button" className="light-text-action" disabled={busy} onClick={() => void load()}>Refresh family links</button>
        {!busy && links.length === 0 && !message && <p>No family links have been created.</p>}
        <ul className="family-link-list">
          {links.map((link) => <li key={link.shareId}>
            <p><strong>{link.revokedAt ? "Revoked" : "Active"}</strong> · Created {new Date(link.createdAt).toLocaleString()}</p>
            <p>Photograph{link.selection.includeVoice ? ", original voice" : ""}{link.selection.includeCaptions ? ", captions" : ""}</p>
            {link.revokedAt ? <p>Revoked {new Date(link.revokedAt).toLocaleString()}</p> :
              <button type="button" className="secondary-action" disabled={busy} onClick={() => void revoke(link)}>Revoke family link</button>}
          </li>)}
        </ul>
        {cursor && <button type="button" className="secondary-action" disabled={busy} onClick={() => void load(cursor)}>Load older links</button>}
      </>}
    </section>
  );
}
