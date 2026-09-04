import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { phase1Config } from "../../../config/phase-1";
import {
  acceptLocalPhoto,
  attachLocalPhoto,
  createLocalDraft,
  type CaptureEntryMode,
  type LocalMemoryDraft,
  type LocalPhoto
} from "./local-draft";
import {
  loadLocalDraft,
  makeDraftToken,
  saveLocalDraft
} from "../../services/local-draft-store";
import { inspectLocalPhoto } from "../../services/photo-inspection";
import { OriginalsExperience } from "./OriginalsExperience";

type CaptureStep =
  | "loading"
  | "intro"
  | "opening-camera"
  | "camera-live"
  | "camera-denied"
  | "review"
  | "ready"
  | "error";

const imageAccept = phase1Config.media.supportedImageMimeTypes.join(",");

function entryModeFrom(value: string | null): CaptureEntryMode {
  return value === "import" ? "import" : "camera";
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function photoFromVideo(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight) {
    return Promise.reject(
      new Error("The camera is still getting ready. Please try once more.")
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    return Promise.reject(new Error("This browser could not capture the photograph."));
  }

  context.drawImage(video, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("The photograph was not captured. Please try again."));
        }
      },
      "image/jpeg",
      0.95
    );
  });
}

export function CaptureExperience() {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const entryMode = entryModeFrom(searchParams.get("start"));
  const [step, setStep] = useState<CaptureStep>("loading");
  const [draft, setDraft] = useState<LocalMemoryDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [tipsVisible, setTipsVisible] = useState(true);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const photoUrl = useMemo(
    () => (draft?.photo ? URL.createObjectURL(draft.photo.blob) : null),
    [draft?.photo]
  );

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function recoverDraft() {
      if (!draftId) {
        setErrorMessage("This local Memory Story does not have a draft address.");
        setStep("error");
        return;
      }

      try {
        const storedDraft = await loadLocalDraft(draftId);
        if (!active) return;

        const nextDraft =
          storedDraft ??
          createLocalDraft({
            id: draftId,
            entryMode,
            locale: navigator.language,
            draftToken: makeDraftToken()
          });

        if (!storedDraft) {
          await saveLocalDraft(nextDraft);
        }
        if (!active) return;

        setDraft(nextDraft);
        setRecovered(Boolean(storedDraft?.photo));
        setStep(
          nextDraft.photo?.acceptedAt
            ? "ready"
            : nextDraft.photo
              ? "review"
              : "intro"
        );
      } catch {
        if (!active) return;
        setErrorMessage(
          "This browser could not open recoverable draft storage. Check private-browsing or storage settings, then try again."
        );
        setStep("error");
      }
    }

    void recoverDraft();
    return () => {
      active = false;
    };
  }, [draftId, entryMode]);

  useEffect(() => {
    if (step === "camera-live" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }

    if (step !== "loading") {
      headingRef.current?.focus();
    }
  }, [step]);

  useEffect(() => () => stopStream(streamRef.current), []);

  async function openCamera() {
    setErrorMessage(null);
    setStep("opening-camera");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Camera unavailable", "NotSupportedError");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      setStep("camera-live");
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setErrorMessage(
        denied
          ? "Camera access was not allowed. Your draft is still here."
          : "The camera is not available right now. Your draft is still here."
      );
      setStep("camera-denied");
    }
  }

  async function keepPhoto(photo: LocalPhoto) {
    if (!draft) return;

    try {
      const updated = attachLocalPhoto(draft, photo);
      await saveLocalDraft(updated);
      setDraft(updated);
      setRecovered(false);
      setStep("review");
    } catch {
      setErrorMessage(
        "The photograph could not be kept in this browser. Nothing was uploaded or shared. Please try again."
      );
      setStep("error");
    }
  }

  async function capturePhoto() {
    if (!videoRef.current) return;
    setErrorMessage(null);

    try {
      const blob = await photoFromVideo(videoRef.current);
      const photo = await inspectLocalPhoto(blob, "camera");
      stopStream(streamRef.current);
      streamRef.current = null;
      await keepPhoto(photo);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The photograph was not captured. Please try again."
      );
    }
  }

  async function importPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const supported = (
      phase1Config.media.supportedImageMimeTypes as readonly string[]
    ).includes(file.type);

    if (!supported) {
      setErrorMessage("Choose a JPEG, PNG, WebP, HEIC, or HEIF photograph.");
      return;
    }

    if (file.size > phase1Config.media.maxImageBytes) {
      setErrorMessage("That photograph is too large. Choose one smaller than 25 MB.");
      return;
    }

    try {
      setErrorMessage(null);
      const photo = await inspectLocalPhoto(file, "import");
      stopStream(streamRef.current);
      streamRef.current = null;
      await keepPhoto(photo);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "That photograph could not be read. Please choose another."
      );
    }
  }

  async function acceptPhoto() {
    if (!draft?.photo) return;

    try {
      const updated = acceptLocalPhoto(draft);
      await saveLocalDraft(updated);
      setDraft(updated);
      setStep("ready");
    } catch {
      setErrorMessage(
        "The photograph is still here, but your choice could not be kept. Please try again."
      );
    }
  }

  function tryAnother() {
    setErrorMessage(null);
    setRecovered(false);
    setStep("intro");
  }

  return (
    <div className="capture-page" id="main-content">
      <header className="capture-header">
        <Link className="capture-brand" to="/" aria-label="Memories: My Story, home">
          Memories: <em>My Story</em>
        </Link>
        <span className="capture-step-label">Photo</span>
      </header>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept={imageAccept}
        onChange={(event) => void importPhoto(event)}
        aria-label="Choose a photograph from this device"
      />

      {!isOnline && (
        <p className="connection-note" role="status">
          No connection—that’s okay. This step stays on your device.
        </p>
      )}

      {recovered && (
        <p className="recovery-note" role="status">
          Your photograph is still here. We returned you to the same step.
        </p>
      )}

      {step === "loading" && (
        <section className="capture-state centered-state" aria-live="polite">
          <span className="soft-loader" aria-hidden="true" />
          <p>Bringing back your draft…</p>
        </section>
      )}

      {step === "intro" && (
        <section className="capture-state capture-intro-state">
          <Link className="back-link" to="/">
            ← Back
          </Link>
          <p className="eyebrow">First, the photograph</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {entryMode === "import"
              ? "Choose the photograph that brings the story back."
              : "Bring the photograph into the light."}
          </h1>
          <p className="capture-lede">
            {entryMode === "import"
              ? "Choose the photograph that still brings something back. You do not need perfect dates or the whole family history—one picture is enough to begin."
              : "Place the photograph on a flat surface in soft, even light. We’ll help with the details, and we’ll ask for camera access only when you open it."}
          </p>

          <div className="capture-guide" aria-label="Photograph guidance">
            <div className="guide-frame" aria-hidden="true">
              <span />
            </div>
            <div>
              <strong>
                {tipsVisible
                  ? "Keep all four edges inside the frame."
                  : "Photo guidance is hidden."}
              </strong>
              {tipsVisible && (
                <p>We’ll check for glare, shadow, focus, and steadiness afterward.</p>
              )}
            </div>
          </div>

          <div className="capture-actions">
            {entryMode === "camera" ? (
              <>
                <button className="primary-action" type="button" onClick={() => void openCamera()}>
                  Open camera
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import a photo instead
                </button>
              </>
            ) : (
              <>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose a photo
                </button>
                <button className="secondary-action" type="button" onClick={() => void openCamera()}>
                  Use the camera instead
                </button>
              </>
            )}
          </div>

          <button
            className="text-action"
            type="button"
            onClick={() => setTipsVisible((visible) => !visible)}
          >
            {tipsVisible ? "Skip photo tips" : "Show photo tips"}
          </button>
          {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
        </section>
      )}

      {step === "opening-camera" && (
        <section className="capture-state centered-state" aria-live="polite">
          <h1 ref={headingRef} tabIndex={-1}>Opening your camera…</h1>
          <p>Your browser may ask for permission now.</p>
        </section>
      )}

      {step === "camera-live" && (
        <section className="capture-state camera-state">
          <h1 ref={headingRef} className="visually-hidden" tabIndex={-1}>
            Photograph camera
          </h1>
          <div className="camera-viewport">
            <video ref={videoRef} playsInline muted aria-label="Live camera preview" />
            <div className="camera-edge-guide" aria-hidden="true" />
            <p className="camera-instruction" aria-live="polite">
              Keep all four edges inside the frame.
            </p>
          </div>
          {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
          <div className="camera-actions">
            <button className="shutter-action" type="button" onClick={() => void capturePhoto()}>
              <span aria-hidden="true" />
              Take photo
            </button>
            <button
              className="text-action light-text-action"
              type="button"
              onClick={() => {
                stopStream(streamRef.current);
                streamRef.current = null;
                setStep("intro");
              }}
            >
              Cancel camera
            </button>
          </div>
        </section>
      )}

      {step === "camera-denied" && (
        <section className="capture-state capture-intro-state">
          <p className="eyebrow">Your photograph is still waiting</p>
          <h1 ref={headingRef} tabIndex={-1}>The camera stayed closed.</h1>
          <p className="capture-lede">{errorMessage}</p>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => fileInputRef.current?.click()}>
              Import a photo
            </button>
            <button className="secondary-action" type="button" onClick={() => void openCamera()}>
              Try camera again
            </button>
          </div>
          <details className="settings-help">
            <summary>How to allow the camera</summary>
            <p>Open this site’s settings in your browser, allow Camera, then return and try again.</p>
          </details>
        </section>
      )}

      {step === "review" && draft?.photo && photoUrl && (
        <section className="capture-state review-state">
          <p className="eyebrow">Look it over</p>
          <h1 ref={headingRef} tabIndex={-1}>Does the photograph feel clear enough?</h1>
          <div className="review-photo-wrap">
            <img src={photoUrl} alt="Your selected photograph" />
          </div>
          <div
            className={draft.photo.warning ? "quality-result has-warning" : "quality-result"}
            role="status"
          >
            <strong>
              {draft.photo.warning ? "One thing may help" : "This photograph looks ready"}
            </strong>
            <p>
              {draft.photo.warning?.message ??
                "The light and detail look usable. Check that the people and all four edges you want are visible."}
            </p>
          </div>
          <p className="manual-choice">
            A technically imperfect photograph can still hold an irreplaceable story. You decide what is worth keeping.
          </p>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => void acceptPhoto()}>
              {draft.photo.warning ? "Use this photo anyway" : "Use this photo"}
            </button>
            <button className="secondary-action" type="button" onClick={tryAnother}>
              Try another photo
            </button>
          </div>
          {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
        </section>
      )}

      {step === "ready" && draft?.photo && photoUrl && (
        <OriginalsExperience
          draft={draft}
          onDraftChange={setDraft}
          photoUrl={photoUrl}
          onChangePhoto={tryAnother}
        />
      )}

      {step === "error" && (
        <section className="capture-state capture-intro-state" role="alert">
          <p className="eyebrow">Nothing was lost or shared</p>
          <h1 ref={headingRef} tabIndex={-1}>This browser needs a moment.</h1>
          <p className="capture-lede">{errorMessage}</p>
          <Link className="secondary-action" to="/">Return to the beginning</Link>
        </section>
      )}
    </div>
  );
}
