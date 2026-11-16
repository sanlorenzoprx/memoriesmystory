import { useRef, useState } from "react";
import {
  ExportVerifyError,
  blobSource,
  verifyArchiveExport,
  type ExportVerificationReport,
} from "../../domain/archive-export-verify";
import { apiMessageKey } from "../../localization/errors";
import { t, notice, useLocale } from "../../localization/language";

const fallback = "This export could not be checked. Nothing was changed.";

/**
 * Checks an archive or album export on this device: every file is re-hashed and
 * compared with the export's own manifest. Nothing is uploaded or changed.
 */
export function ExportCheckPanel() {
  useLocale();
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<{ done: number; total: number } | null>(null),
    [error, setError] = useState<string | null>(null),
    [report, setReport] = useState<ExportVerificationReport | null>(null),
    run = useRef(0);

  async function check(file: File | undefined) {
    if (!file) return;
    const attempt = ++run.current;
    setBusy(true);
    setError(null);
    setReport(null);
    setProgress(null);
    try {
      const result = await verifyArchiveExport(blobSource(file), (done, total) => {
        if (attempt === run.current) setProgress({ done, total });
      });
      if (attempt === run.current) setReport(result);
    } catch (reason) {
      if (attempt === run.current)
        setError(
          reason instanceof ExportVerifyError
            ? apiMessageKey(reason.code, fallback)
            : fallback,
        );
    } finally {
      if (attempt === run.current) setBusy(false);
    }
  }

  return (
    <details className="memory-review-section">
      <summary>{t("Check an export")}</summary>
      <p>
        {t(
          "Choose an export you saved before. Every file in it is checked against the list inside the export, on this device. Nothing is uploaded or changed.",
        )}
      </p>
      <label>
        {t("Export file (.zip)")}
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(event) => void check(event.currentTarget.files?.[0])}
        />
      </label>
      {busy && progress && (
        <p role="status">{t("Checked {done} of {total} files", progress)}</p>
      )}
      {error && <p role="alert">{notice(error)}</p>}
      {report && (
        <div role="status">
          <p>
            <strong>
              {t(
                report.allMatch
                  ? "Every file in this export matches its list."
                  : "Some files in this export do not match its list.",
              )}
            </strong>
          </p>
          <p>
            {t("Files that match: {matched} of {listed}", {
              matched: report.matched,
              listed: report.listed,
            })}
          </p>
          {report.missing.length > 0 && (
            <p>{t("Listed but missing: {count}", { count: report.missing.length })}</p>
          )}
          {report.differ.length > 0 && (
            <>
              <p>{t("Changed since the export was made: {count}", { count: report.differ.length })}</p>
              <ul>
                {report.differ.map((item) => (
                  <li key={item.path}>
                    <code>{item.path}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.extra.length > 0 && (
            <p>{t("Added files that are not on the list: {count}", { count: report.extra.length })}</p>
          )}
          {!report.exportSaysComplete && (
            <p>
              {t(
                "When it was made, this export said it was not complete. Open its index.html to read what it left out.",
              )}
            </p>
          )}
          <p>
            {t(
              "This check shows the files match the list inside the export. It cannot show the list itself was never edited.",
            )}
          </p>
        </div>
      )}
    </details>
  );
}
