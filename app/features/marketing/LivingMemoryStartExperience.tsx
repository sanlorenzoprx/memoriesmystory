import { useState } from "react";
import { useNavigate } from "react-router";

import type { CaptureEntryMode } from "../capture/local-draft";
import { beginLocalDraft } from "../../services/local-draft-store";

export function LivingMemoryStartExperience() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState<CaptureEntryMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function start(entryMode: CaptureEntryMode) {
    setStarting(entryMode);
    setErrorMessage(null);

    try {
      const draft = await beginLocalDraft(entryMode, navigator.language);
      await navigate(`/capture/${encodeURIComponent(draft.id)}?start=${entryMode}`);
    } catch {
      setStarting(null);
      setErrorMessage(
        "This browser could not start your Living Memory. Check your storage settings and try again."
      );
    }
  }

  return (
    <main className="journey-page" id="main-content">
      <section className="journey-hero" aria-labelledby="create-title">
        <div className="journey-copy">
          <p className="lm-eyebrow">Your first Living Memory is free</p>
          <h1 id="create-title">Start with one photograph.</h1>
          <p className="journey-lede">
            Choose a photograph that brings something back. Then tell the story in your own words. No script. No writing assignment.
          </p>
          <div className="journey-choice-grid" aria-label="Choose how to add a photograph">
            <button
              className="journey-choice"
              type="button"
              disabled={starting !== null}
              onClick={() => void start("camera")}
            >
              <span className="journey-choice-icon" aria-hidden="true">◉</span>
              <strong>Capture Your Memories</strong>
              <span>Use your camera to bring a printed photograph into the story.</span>
            </button>
            <button
              className="journey-choice"
              type="button"
              disabled={starting !== null}
              onClick={() => void start("import")}
            >
              <span className="journey-choice-icon" aria-hidden="true">＋</span>
              <strong>Import a photo</strong>
              <span>Choose a photograph that is already on this phone, tablet, or computer.</span>
            </button>
          </div>
          {starting && <p className="journey-status" role="status">Opening your Living Memory…</p>}
          {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
        </div>
        <aside className="journey-side-card" aria-label="What happens next">
          <p className="lm-eyebrow">What happens next</p>
          <ol>
            <li><strong>Photo</strong><span>Pick the photograph.</span></li>
            <li><strong>Voice</strong><span>Tell the story naturally.</span></li>
            <li><strong>Muse</strong><span>Get help only when it is useful.</span></li>
            <li><strong>Living Memory</strong><span>Hear the photo and story together.</span></li>
          </ol>
          <p className="journey-privacy">Private first. You choose if and when to share.</p>
        </aside>
      </section>
    </main>
  );
}
