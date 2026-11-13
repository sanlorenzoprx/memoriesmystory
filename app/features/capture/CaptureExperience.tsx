import { t, notice, useLocale, getLocale } from "../../localization/language";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

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
  beginLocalDraft,
  deleteLocalDraft,
  loadLocalDraft,
  makeDraftToken,
  saveLocalDraft
} from "../../services/local-draft-store";
import { abortableDelay, cameraFocusAssist, captureSteadyPhoto } from "../../services/steady-photo";
import { captureStillPhoto } from "../../services/still-photo-capture";
import { inspectLocalPhoto } from "../../services/photo-inspection";
import { deleteMemory } from "../../services/memory-deletion";
import { PhotoScanEditor } from "./PhotoScanEditor";
import type { LocalPhotoScan } from "./local-draft";
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

export function CaptureExperience() {
  useLocale();
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entryMode = entryModeFrom(searchParams.get("start"));
  const [step, setStep] = useState<CaptureStep>("loading");
  const [draft, setDraft] = useState<LocalMemoryDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [steady,setSteady] = useState(false);
  const [shutterDelay,setShutterDelay] = useState(false);
  const [scanEditing,setScanEditing] = useState(false);
  const [tipsVisible, setTipsVisible] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const captureBusy = useRef(false);
  const cameraEpoch = useRef(0);
  const captureAbort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const [deleting, setDeleting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deviceCameraRef = useRef<HTMLInputElement>(null);
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
        setErrorMessage("This local Living Memory does not have a draft address.");
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
            locale: getLocale(),
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

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cameraEpoch.current += 1;
      captureAbort.current?.abort();
      stopStream(streamRef.current);
    };
  }, [draftId]);

  function closeCamera() {
    captureAbort.current?.abort();
    cameraEpoch.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
  }

  function chooseDeviceCamera() {
    closeCamera();
    setStep("intro");
    deviceCameraRef.current?.click();
  }

  async function openCamera() {
    setErrorMessage(null);
    setStep("opening-camera");
    const epoch = ++cameraEpoch.current;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Camera unavailable", "NotSupportedError");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: phase1Config.capture.previewWidth },
          height: { ideal: phase1Config.capture.previewHeight }
        }
      });
      if (!alive.current || epoch !== cameraEpoch.current) { stopStream(stream); return; }
      streamRef.current = stream;
      const track=stream.getVideoTracks()[0];
      if(track)await cameraFocusAssist(track);
      if(!alive.current||epoch!==cameraEpoch.current){stopStream(stream);return;}
      streamRef.current = stream;
      setStep("camera-live");
    } catch (error) {
      if (!alive.current || epoch !== cameraEpoch.current) return;
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
    const epoch = cameraEpoch.current;

    try {
      const updated = attachLocalPhoto(draft, photo);
      await saveLocalDraft(updated);
      if (!alive.current || epoch !== cameraEpoch.current) return;
      setDraft(updated);
      setRecovered(false);
      setScanEditing(false);
      setStep("review");
    } catch {
      if (!alive.current || epoch !== cameraEpoch.current) return;
      setErrorMessage(
        "The photograph could not be kept in this browser. Nothing was uploaded or shared. Please try again."
      );
      setStep("error");
    }
  }

  async function capturePhoto() {
    if (!videoRef.current || !streamRef.current || captureBusy.current) return;
    const epoch = cameraEpoch.current;
    const controller = new AbortController();
    captureAbort.current = controller;
    captureBusy.current = true;
    setCapturing(true);
    setErrorMessage(null);
    try {
      if(shutterDelay)await abortableDelay(phase1Config.capture.shutterDelayMs,controller.signal);
      let photo:LocalPhoto;
      if(steady)photo=await captureSteadyPhoto(videoRef.current,streamRef.current,controller.signal);
      else{
        const {blob,acquisition}=await captureStillPhoto(videoRef.current,streamRef.current,controller.signal);
        if(!alive.current||epoch!==cameraEpoch.current)return;
        photo=await inspectLocalPhoto(blob,"camera",acquisition);
      }
      if (!alive.current || epoch !== cameraEpoch.current) return;
      closeCamera();
      await keepPhoto(photo);
    } catch (error) {
      if (alive.current && epoch === cameraEpoch.current) setErrorMessage(
        error instanceof Error ? error.message : "The photograph was not captured. Please try again."
      );
    } finally {
      captureBusy.current = false;
      if (alive.current) setCapturing(false);
    }
  }

  async function importPhoto(event: ChangeEvent<HTMLInputElement>, deviceCamera = false) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || captureBusy.current) return;
    closeCamera();
    const epoch = cameraEpoch.current;
    captureBusy.current = true;
    setCapturing(true);
    try {
      setErrorMessage(null);
      const photo = await inspectLocalPhoto(file, deviceCamera ? "camera" : "import", deviceCamera ? "device_picker" : "file_import");
      if (!alive.current || epoch !== cameraEpoch.current) return;
      await keepPhoto(photo);
    } catch (error) {
      if (alive.current && epoch === cameraEpoch.current) setErrorMessage(
        error instanceof Error ? error.message : "That photograph could not be read. Please choose another."
      );
    } finally {
      captureBusy.current = false;
      if (alive.current) setCapturing(false);
    }
  }

  async function keepScan(scan:LocalPhotoScan|null) {
    if(!draft?.photo || (scan&&scan.sourceSha256!==draft.photo.sha256))return;
    const updated={...draft,scan,updatedAt:new Date().toISOString()};
    await saveLocalDraft(updated);setDraft(updated);setScanEditing(false);
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

  async function tryAnother() {
    setErrorMessage(null);
    if(draft?.photo?.acceptedAt){
      try {
        closeCamera();
        const next=await beginLocalDraft(entryMode,getLocale());
        await navigate(`/capture/${encodeURIComponent(next.id)}?start=${entryMode}`);
      }catch{setErrorMessage("The next draft could not be opened. Your earlier photograph is still here.");}
      return;
    }
    setRecovered(false);setScanEditing(false);setStep("intro");
  }

  async function deleteCurrentDraft() {
    if (!draft || deleting) return;
    const confirmed = window.confirm(t("Delete this draft and its preserved photograph and voice? This cannot be undone."));
    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage(null);
    try {
      await deleteMemory(draft.id, { draftToken: draft.draftToken });
      await deleteLocalDraft(draft.id);
      await navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This draft could not be deleted right now."
      );
      setDeleting(false);
    }
  }

  return (
    <div className="capture-page" id="main-content">
      <header className="capture-header">
        <Link className="capture-brand" to="/" aria-label={t("Memories: My Story, home")}>
          Memories: <em>My Story</em>
        </Link>
        <div className="capture-header-actions">
          <Link className="account-link" to="/auth/protect">{t("My account")}</Link>
          <span className="capture-step-label">{t("Photo")}</span>
        </div>
      </header>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept={imageAccept}
        disabled={capturing}
        onChange={(event) => void importPhoto(event)}
        aria-label={t("Choose a photograph from this device")}
      />

      <input ref={deviceCameraRef} className="visually-hidden" type="file" accept={imageAccept}
        capture="environment" disabled={capturing} aria-label={t("Take a photo with this device")}
        onChange={(event) => void importPhoto(event, true)} />

      {!isOnline && (
        <p className="connection-note" role="status">{t("No connection—that’s okay. This step stays on your device.")}</p>
      )}

      {recovered && (
        <p className="recovery-note" role="status">{t("Your photograph is still here. We returned you to the same step.")}</p>
      )}

      {step === "loading" && (
        <section className="capture-state centered-state" aria-live="polite">
          <span className="soft-loader" aria-hidden="true" />
          <p>{t("Bringing back your draft…")}</p>
        </section>
      )}

      {step === "intro" && (
        <section className="capture-state capture-intro-state">
          <Link className="back-link" to="/">{t("← Back")}</Link>
          <p className="eyebrow">{t("First, the photograph")}</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {entryMode === "import"
              ? t("Choose the photograph that brings the story back.")
              : t("Bring the photograph into the light.")}
          </h1>
          <p className="capture-lede">
            {entryMode === "import"
              ? t("A favorite picture, a face you miss, or a moment your family should always remember.")
              : t("Place the photograph on a flat surface in soft, even light. We’ll ask for camera access only when you open it.")}
          </p>

          <div className="capture-guide" aria-label={t("Photograph guidance")}>
            <div className="guide-frame" aria-hidden="true">
              <span />
            </div>
            <div>
              <strong>
                {tipsVisible
                  ? t("Keep all four edges inside the frame.")
                  : t("Photo guidance is hidden.")}
              </strong>
              {tipsVisible && (
                <p>{t("We’ll check for glare, shadow, focus, and steadiness afterward.")}</p>
              )}
            </div>
          </div>

          <div className="capture-actions">
            {entryMode === "camera" ? (
              <>
                <button className="primary-action" type="button" disabled={capturing} onClick={chooseDeviceCamera}>{t("Use device camera")}</button>
                <button className="secondary-action" type="button" disabled={capturing} onClick={() => void openCamera()}>{t("Open camera")}</button>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >{t("Import a photo instead")}</button>
              </>
            ) : (
              <>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >{t("Choose a photo")}</button>
                <button className="secondary-action" type="button" disabled={capturing} onClick={() => void openCamera()}>{t("Use the camera instead")}</button>
              </>
            )}
          </div>

          {entryMode === "import" && <button className="secondary-action" type="button" disabled={capturing} onClick={chooseDeviceCamera}>{t("Use device camera")}</button>}
          <p className="cross-device-note">{t("For more detail, use your device camera. Your browser may offer a camera or photo library.")}</p>
          {capturing && <p role="status">{t("Keeping your photograph on this device…")}</p>}
          <button
            className="text-action"
            type="button"
            onClick={() => setTipsVisible((visible) => !visible)}
          >
            {tipsVisible ? t("Skip photo tips") : t("Show photo tips")}
          </button>
          {errorMessage && <p className="inline-error" role="alert">{notice(errorMessage)}</p>}
        </section>
      )}

      {step === "opening-camera" && (
        <section className="capture-state centered-state" aria-live="polite">
          <h1 ref={headingRef} tabIndex={-1}>{t("Opening your camera…")}</h1>
          <p>{t("Your browser may ask for permission now.")}</p>
          <div className="capture-actions">
            <button className="secondary-action" type="button" onClick={() => { closeCamera(); setStep("intro"); }}>{t("Cancel camera")}</button>
            <button className="secondary-action" type="button" onClick={() => { closeCamera(); setStep("intro"); fileInputRef.current?.click(); }}>{t("Import a photo")}</button>
          </div>
        </section>
      )}

      {step === "camera-live" && (
        <section className="capture-state camera-state">
          <h1 ref={headingRef} className="visually-hidden" tabIndex={-1}>{t("Photograph camera")}</h1>
          <div className="camera-viewport">
            <video ref={videoRef} playsInline muted aria-label={t("Live camera preview")} />
            <div className="camera-edge-guide" aria-hidden="true" />
            <p className="camera-instruction" aria-live="polite">{t("Keep all four edges inside the frame.")}</p>
          </div>
          <fieldset className="steady-photo-options" disabled={capturing}>
            <legend>{t("Help with shaky hands")}</legend>
            <label className="share-option"><input type="checkbox" checked={steady} onChange={event=>setSteady(event.target.checked)}/>{t("Steady photo: take up to three shots and keep the clearest")}</label>
            <label className="share-option"><input type="checkbox" checked={shutterDelay} onChange={event=>setShutterDelay(event.target.checked)}/>{t("Pause briefly after I press the shutter")}</label>
            <p>{t("Rest your elbows or use a phone stand. Keep the phone parallel to the print in soft, even light. You can always take a photo yourself.")}</p>
            <p>{t("Steady photo selects an unchanged shot. It does not reconstruct blurry details.")}</p>
          </fieldset>
          {errorMessage && <p className="inline-error" role="alert">{notice(errorMessage)}</p>}
          <div className="camera-actions">
            <button className="shutter-action" type="button" disabled={capturing} onClick={() => void capturePhoto()}>
              <span aria-hidden="true" />{capturing ? t("Taking photo…") : t("Take photo")}</button>
            <button
              className="text-action light-text-action"
              type="button"
              onClick={() => {
                closeCamera();
                setStep("intro");
              }}
            >{t("Cancel camera")}</button>
            <button className="text-action light-text-action" type="button" disabled={capturing} onClick={chooseDeviceCamera}>{t("Use device camera")}</button>
            <button className="text-action light-text-action" type="button" disabled={capturing} onClick={() => { closeCamera(); setStep("intro"); fileInputRef.current?.click(); }}>{t("Import a photo")}</button>
          </div>
        </section>
      )}

      {step === "camera-denied" && (
        <section className="capture-state capture-intro-state">
          <p className="eyebrow">{t("Your photograph is still waiting")}</p>
          <h1 ref={headingRef} tabIndex={-1}>{t("The camera stayed closed.")}</h1>
          <p className="capture-lede">{notice(errorMessage)}</p>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => fileInputRef.current?.click()}>{t("Import a photo")}</button>
            <button className="secondary-action" type="button" disabled={capturing} onClick={() => void openCamera()}>{t("Try camera again")}</button>
            <button className="secondary-action" type="button" disabled={capturing} onClick={chooseDeviceCamera}>{t("Use device camera")}</button>
          </div>
          <details className="settings-help">
            <summary>{t("How to allow the camera")}</summary>
            <p>{t("Open this site’s settings in your browser, allow Camera, then return and try again.")}</p>
          </details>
        </section>
      )}

      {step === "review" && draft?.photo && photoUrl && (
        <section className="capture-state review-state">
          <p className="eyebrow">{t("Look it over")}</p>
          <h1 ref={headingRef} tabIndex={-1}>{t("Does the photograph feel clear enough?")}</h1>
          <div className="review-photo-wrap">
            <img src={photoUrl} alt={t("Your selected photograph")} />
          </div>
          <p className="cross-device-note">{t("Your original photograph is kept unchanged. Any corrected scan will be a separate copy.")}</p>
          {draft.photo.capture?.method === "video_frame" && <p className="cross-device-note">{t("This photo came from the camera preview. For more detail, try your device camera.")}</p>}
          <div
            className={draft.photo.warning ? "quality-result has-warning" : "quality-result"}
            role="status"
          >
            <strong>
              {draft.photo.warning ? t("One thing may help") : t("This photograph looks ready")}
            </strong>
            <p>
              {draft.photo.warning ? notice(draft.photo.warning.message) :
                t("The light and detail look usable. Check that the people and all four edges you want are visible.")}
            </p>
          </div>
          {scanEditing?<PhotoScanEditor photo={draft.photo} photoUrl={photoUrl} onKeep={keepScan} onClose={()=>{void keepScan(null).catch(()=>setErrorMessage("The scan could not be kept on this device. Your original is still here."));}}/>:<>
            <button className="secondary-action" type="button" onClick={()=>setScanEditing(true)}>{draft.scan?t("Adjust separate scan"):t("Straighten a separate copy")}</button>
            {draft.scan&&<p role="status">{t("Your corrected scan is kept on this device. Its backup is still pending.")}</p>}
          </>}
          <p className="manual-choice">{t("You know what matters in this photograph. You can keep it even if our check is unsure.")}</p>
          <div className="capture-actions">
            <button className="primary-action" type="button" disabled={scanEditing} onClick={() => void acceptPhoto()}>
              {draft.photo.warning ? t("Use this photo anyway") : t("Use this photo")}
            </button>
            <button className="secondary-action" type="button" disabled={scanEditing} onClick={tryAnother}>{t("Try another photo")}</button>
          </div>
          {errorMessage && <p className="inline-error" role="alert">{notice(errorMessage)}</p>}
        </section>
      )}

      {step === "ready" && draft?.photo && photoUrl && (
        <OriginalsExperience
          draft={draft}
          onDraftChange={(next)=>setDraft(current=>current?.id===next.id?next:current)}
          photoUrl={photoUrl}
          onChangePhoto={tryAnother}
        />
      )}

      {step === "error" && (
        <section className="capture-state capture-intro-state" role="alert">
          <p className="eyebrow">{t("Nothing was lost or shared")}</p>
          <h1 ref={headingRef} tabIndex={-1}>{t("This browser needs a moment.")}</h1>
          <p className="capture-lede">{notice(errorMessage)}</p>
          <Link className="secondary-action" to="/">{t("Return to the beginning")}</Link>
        </section>
      )}

      {draft && step !== "loading" && step !== "opening-camera" && step !== "camera-live" && (
        <div className="delete-memory-zone">
          <button
            className="danger-text-action"
            type="button"
            disabled={deleting}
            onClick={() => void deleteCurrentDraft()}
          >
            {deleting ? t("Deleting…") : t("Delete this draft")}
          </button>
        </div>
      )}
    </div>
  );
}
