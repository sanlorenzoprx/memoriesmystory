import { useEffect, useRef, useState } from "react";
import {
  defaultScanCorners,
  type ScanCorners,
  type ScanPoint,
} from "../../domain/photo-scan";
import type { LocalPhoto, LocalPhotoScan } from "./local-draft";
import { createPerspectiveScan } from "../../services/perspective-scan";
import { t, notice, useLocale } from "../../localization/language";
const cornerNames = [
  "Top left corner",
  "Top right corner",
  "Bottom right corner",
  "Bottom left corner",
];
export function PhotoScanEditor({
  photo,
  photoUrl,
  onKeep,
  onClose,
}: {
  photo: LocalPhoto;
  photoUrl: string;
  onKeep: (scan: LocalPhotoScan) => Promise<void>;
  onClose: () => void;
}) {
  useLocale();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [corners, setCorners] = useState<ScanCorners>(defaultScanCorners),
    [scan, setScan] = useState<LocalPhotoScan | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null),
    surface = useRef<HTMLDivElement>(null),
    abort = useRef<AbortController | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!scan) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(scan.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [scan]);
  function move(index: number, p: ScanPoint) {
    setScan(null);
    setCorners(
      (old) =>
        old.map((point, i) =>
          i === index
            ? {
                x: Math.max(0, Math.min(1, p.x)),
                y: Math.max(0, Math.min(1, p.y)),
              }
            : point,
        ) as unknown as ScanCorners,
    );
  }
  async function generate(nextRotation = rotation) {
    setBusy(true);
    setMessage(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const result = await createPerspectiveScan(
        photo,
        corners,
        controller.signal,
        nextRotation,
      );
      if (alive.current) setScan(result);
    } catch (error) {
      if (alive.current && !controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : "This device could not create the scan. Your original is still here.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="scan-editor"
      aria-label={t("Correct the photograph edges")}
    >
      <h2 ref={heading} tabIndex={-1}>
        {t("Straighten a separate copy")}
      </h2>
      <p>
        {t(
          "Move the four corners to the print edges. Keep borders or writing you want to preserve. Your original stays unchanged.",
        )}
      </p>
      {!preview && (
        <div className="scan-corners" ref={surface}>
          <img
            src={photoUrl}
            alt={t("Original photograph for corner selection")}
            draggable={false}
          />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points={corners.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
            />
          </svg>
          {corners.map((p, i) => (
            <button
              key={i}
              type="button"
              className="scan-corner"
              disabled={busy}
              aria-label={t(cornerNames[i]!)}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (
                  !event.currentTarget.hasPointerCapture(event.pointerId) ||
                  busy
                )
                  return;
                const box = surface.current!.getBoundingClientRect();
                move(i, {
                  x: (event.clientX - box.left) / box.width,
                  y: (event.clientY - box.top) / box.height,
                });
              }}
              onKeyDown={(event) => {
                const delta = event.shiftKey ? 0.05 : 0.01;
                let next: ScanPoint;
                if (event.key === "ArrowLeft") next = { ...p, x: p.x - delta };
                else if (event.key === "ArrowRight")
                  next = { ...p, x: p.x + delta };
                else if (event.key === "ArrowUp")
                  next = { ...p, y: p.y - delta };
                else if (event.key === "ArrowDown")
                  next = { ...p, y: p.y + delta };
                else return;
                event.preventDefault();
                move(i, next);
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
      {preview && (
        <img
          className="scan-preview"
          src={preview}
          alt={t("Preview of the separate corrected scan")}
        />
      )}
      {!preview && (
        <details>
          <summary>{t("Adjust corners with sliders")}</summary>
          {corners.map((p, i) => (
            <fieldset key={i} disabled={busy}>
              <legend>{t(cornerNames[i]!)}</legend>
              {(["x", "y"] as const).map((axis) => (
                <label key={axis} className="memory-field">
                  <span>
                    {axis === "x"
                      ? t("Distance from left")
                      : t("Distance from top")}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={p[axis] * 100}
                    onChange={(event) =>
                      move(i, {
                        ...p,
                        [axis]: Number(event.target.value) / 100,
                      })
                    }
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </details>
      )}
      {message && <p role="alert">{notice(message)}</p>}
      {busy && <p role="status">{t("Creating your separate scan…")}</p>}
      <div className="capture-actions">
        {preview ? (
          <>
            <button
              type="button"
              className="primary-action"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onKeep(scan!).catch(() => {
                  if (alive.current) {
                    setMessage(
                      "The scan could not be kept on this device. Your original is still here.",
                    );
                    setBusy(false);
                  }
                });
              }}
            >
              {t("Keep this separate scan")}
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => {
                const next = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
                setRotation(next);
                void generate(next);
              }}
            >
              {t("Rotate scan clockwise")}
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => setScan(null)}
            >
              {t("Adjust corners")}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="primary-action"
              disabled={busy}
              onClick={() => void generate()}
            >
              {t("Preview corrected scan")}
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => setCorners(defaultScanCorners)}
            >
              {t("Reset corners")}
            </button>
          </>
        )}
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            abort.current?.abort();
            onClose();
          }}
        >
          {t("Keep original only")}
        </button>
      </div>
    </section>
  );
}
