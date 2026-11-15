import { useEffect, useRef, useState } from "react";
import {
  archiveExportFormat,
  archiveExportLimits,
  buildStoredZip,
  renderExportIndex,
  type ArchiveExportManifest,
  type ArchiveExportVerification,
} from "../../domain/archive-export";
import { apiMessageKey } from "../../localization/errors";
import { getLocale, t, notice, useLocale } from "../../localization/language";

const fallback = "Your archive export could not be prepared. Please try again.";

// Wording for the codes used inside the export's readable index.
const indexWording: Record<string, string> = {
  "export role: original_photograph": "Original photograph",
  "export role: original_voice": "Original voice recording",
  "export role: corrected_scan":
    "Corrected scan (made from the original photograph)",
  "export role: cleaned_audio":
    "Cleaned audio (made from the original recording)",
  "export role: voice_reply_to_muse": "Voice reply to Muse",
  "export role: family_voice_recollection": "Family voice recollection",
  "export role: family_added_photograph": "Photograph added by family",
  "export context: person": "Who was there",
  "export context: place": "Where it was",
  "export context: time": "When it was",
  "export context: event": "What was happening",
  "export not included: more_memories_than_one_export":
    "More memories than one export can hold",
  "export not included: shared_conversation_recordings":
    "Shared conversation recordings (Our Living Legacy)",
  "export not included: recollections_withdrawn_by_their_author":
    "Recollections withdrawn by the person who gave them",
  "export not included: unfinished_memories":
    "Memories that are not finished yet",
  "export not included: files_not_verified":
    "Files that could not be downloaded or did not match",
};
const indexLabel = (key: string, values?: Record<string, string | number>) =>
  t(indexWording[key] ?? key, values);

async function sha256Hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type Prepared = {
  url: string;
  name: string;
  complete: boolean;
  files: number;
  unverified: number;
  notIncluded: ArchiveExportManifest["notIncluded"];
};

/**
 * Builds a portable copy of the owner's archive on this device. Every file is
 * downloaded, re-hashed and compared with the preserved original before it is
 * packaged; the result says plainly whether anything is missing.
 */
export function ArchiveExportPanel() {
  useLocale();
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<{ done: number; total: number } | null>(
      null,
    ),
    [error, setError] = useState<string | null>(null),
    [prepared, setPrepared] = useState<Prepared | null>(null);
  const pending = useRef<AbortController | null>(null),
    objectUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  async function prepare() {
    pending.current?.abort();
    const controller = new AbortController(),
      signal = controller.signal;
    pending.current = controller;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPrepared(null);
    setError(null);
    setProgress(null);
    setBusy(true);
    try {
      const response = await fetch("/resources/archive-export/manifest", {
        credentials: "same-origin",
        signal,
      });
      const manifest = (await response.json().catch(() => null)) as
        | (ArchiveExportManifest & { error?: { code?: string } })
        | null;
      if (!response.ok)
        throw new Error(apiMessageKey(manifest?.error?.code, fallback));
      if (
        !manifest ||
        manifest.format !== archiveExportFormat ||
        !Array.isArray(manifest.memories)
      )
        throw new Error(fallback);
      const files = manifest.memories.flatMap((memory) => memory.files);
      if (
        files.reduce((sum, file) => sum + file.byteSize, 0) >
        archiveExportLimits.maximumTotalBytes
      )
        throw new Error(
          "Your archive is too large to export on this device yet. Nothing was changed.",
        );
      const entries: { path: string; bytes: Uint8Array }[] = [],
        checks: ArchiveExportVerification["files"] = [];
      setProgress({ done: 0, total: files.length });
      for (const [index, file] of files.entries()) {
        let verified = false;
        try {
          const download = await fetch(
            `/resources/archive-export/file/${file.kind}/${encodeURIComponent(file.id)}`,
            { credentials: "same-origin", signal },
          );
          if (download.ok) {
            const bytes = await download.arrayBuffer();
            // Only bytes that hash to the preserved original are packaged.
            if (
              bytes.byteLength === file.byteSize &&
              (await sha256Hex(bytes)) === file.sha256
            ) {
              entries.push({ path: file.path, bytes: new Uint8Array(bytes) });
              verified = true;
            }
          }
        } catch (reason) {
          if (signal.aborted) throw reason;
        }
        checks.push({ path: file.path, sha256: file.sha256, verified });
        setProgress({ done: index + 1, total: files.length });
      }
      const unverified = checks.filter((check) => !check.verified).length,
        notIncluded = unverified
          ? [
              ...manifest.notIncluded,
              { code: "files_not_verified", count: unverified },
            ]
          : manifest.notIncluded,
        finalManifest: ArchiveExportManifest = {
          ...manifest,
          complete: manifest.complete && unverified === 0,
          notIncluded,
        },
        verification: ArchiveExportVerification = {
          verifiedAt: new Date().toISOString(),
          allFilesVerified: unverified === 0,
          files: checks,
        },
        encoder = new TextEncoder();
      const zip = buildStoredZip([
        {
          path: "manifest.json",
          bytes: encoder.encode(
            JSON.stringify({ ...finalManifest, verification }, null, 2),
          ),
        },
        {
          path: "index.html",
          bytes: encoder.encode(
            renderExportIndex(
              finalManifest,
              verification,
              indexLabel,
              getLocale(),
            ),
          ),
        },
        ...entries,
      ]);
      if (signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob(zip as BlobPart[], { type: "application/zip" }),
      );
      objectUrl.current = url;
      setPrepared({
        url,
        name: `family-archive-export-${finalManifest.generatedAt.slice(0, 10)}.zip`,
        complete: finalManifest.complete,
        files: entries.length,
        unverified,
        notIncluded,
      });
    } catch (reason) {
      if (signal.aborted) return;
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <details className="memory-review-section">
      <summary>{t("Export my archive")}</summary>
      <p>
        {t(
          "Take a copy of your originals and their history with you. Each file is checked against the preserved original before it is packaged. Nothing in your archive is changed.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={() => void prepare()}
      >
        {t(prepared ? "Prepare the export again" : "Prepare my archive export")}
      </button>
      {busy && progress && (
        <p role="status">
          {t("Checked {done} of {total} files", progress)}
        </p>
      )}
      {prepared && (
        <div role="status">
          <p>
            <strong>
              {t(
                prepared.complete
                  ? "Your export is ready. Every file in it matches the preserved original."
                  : "Your export is ready, but it is not complete.",
              )}
            </strong>
          </p>
          <p>{t("Files in this export: {count}", { count: prepared.files })}</p>
          {prepared.notIncluded.length > 0 && (
            <>
              <p>{t("Not included in this export")}</p>
              <ul>
                {prepared.notIncluded.map((item) => (
                  <li key={item.code}>
                    {indexLabel(`export not included: ${item.code}`)}
                    {item.count === null ? "" : ` (${item.count})`}
                  </li>
                ))}
              </ul>
            </>
          )}
          <a
            className="primary-action"
            href={prepared.url}
            download={prepared.name}
          >
            {t("Save the export to this device")}
          </a>
          <p>
            {t(
              "The export is not protected by a password. Keep it somewhere private.",
            )}
          </p>
        </div>
      )}
    </details>
  );
}
