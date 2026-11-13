import { useEffect, useState } from "react";
import type { LocalPhotoScan } from "./local-draft";
import {
  loadPhotoScans,
  type SavedPhotoScan,
} from "../../services/photo-scans";
import { t, notice, useLocale } from "../../localization/language";
export function LocalScanStatus({
  scan,
  onRetry,
  busy,
}: {
  scan: LocalPhotoScan;
  onRetry: () => void;
  busy: boolean;
}) {
  useLocale();
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(scan.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [scan.blob]);
  return (
    <details className="memory-review-section">
      <summary>{t("Separate corrected scan")}</summary>
      {url && (
        <img
          className="scan-preview"
          src={url}
          alt={t("Separate corrected scan")}
        />
      )}
      <p role="status">
        {scan.upload.status === "durable"
          ? t(
              "Your corrected scan is backed up separately. The original is unchanged.",
            )
          : t(
              "Your corrected scan is kept on this device. Its backup is still pending.",
            )}
      </p>
      {scan.upload.lastError && (
        <p role="status">{notice(scan.upload.lastError)}</p>
      )}
      {scan.upload.status !== "durable" && (
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={onRetry}
        >
          {t("Retry scan backup")}
        </button>
      )}
    </details>
  );
}
export function SavedScanGallery({ draftId }: { draftId: string }) {
  useLocale();
  const [open, setOpen] = useState(false),
    [scans, setScans] = useState<SavedPhotoScan[] | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(false);
    void loadPhotoScans(draftId)
      .then((rows) => {
        if (active) setScans(rows);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [draftId, open]);
  return (
    <section className="memory-review-section">
      <button
        type="button"
        className="secondary-action"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t("View separate scans")}
      </button>
      {open && (
        <div>
          {error ? (
            <p role="status">
              {t(
                "Your corrected scans could not be opened. Your originals remain available.",
              )}
            </p>
          ) : scans === null ? (
            <p role="status">{t("Opening separate scans…")}</p>
          ) : scans.length === 0 ? (
            <p>{t("No separate corrected scans have been backed up yet.")}</p>
          ) : (
            scans.map((scan) => (
              <figure key={scan.assetId}>
                <img
                  className="scan-preview"
                  src={scan.mediaUrl}
                  alt={t("Separate corrected scan")}
                />
                <figcaption>
                  {t(
                    "Perspective-corrected copy. The original photograph remains unchanged.",
                  )}
                </figcaption>
              </figure>
            ))
          )}
        </div>
      )}
    </section>
  );
}
