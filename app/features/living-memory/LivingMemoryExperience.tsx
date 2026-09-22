import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import type { StoryContextKind, StoryContextState } from "../../domain";
import {
  LivingMemoryApiError,
  askMuse,
  completeLivingMemory,
  createLivingMemoryShare,
  loadLivingMemory,
  loadMuse,
  loadProcessing,
  previewLivingMemoryShare,
  saveStoryContext,
  startProcessing,
  type LivingMemorySnapshot,
  type MuseView,
  type ProcessingView,
  type SharePreview,
  type ShareSelection
} from "../../services/living-memory-api";

type Stage =
  | "loading"
  | "processing"
  | "context"
  | "review"
  | "completing"
  | "complete"
  | "share-settings"
  | "share-preview"
  | "share-created"
  | "error";

type ContextDraft = {
  readonly kind: StoryContextKind;
  readonly label: string;
  readonly prompt: string;
  state: StoryContextState;
  value: string;
};

const contextBlueprint: readonly Omit<ContextDraft, "state" | "value">[] = [
  { kind: "person", label: "Who", prompt: "Who is part of this memory?" },
  { kind: "place", label: "Where", prompt: "Where were you?" },
  { kind: "time", label: "When", prompt: "When was this?" },
  { kind: "event", label: "What", prompt: "What was happening?" }
];

const contextStateLabels: Record<StoryContextState, string> = {
  stated: "This is how I remember it",
  approximate: "I'm not completely sure",
  unknown: "I don't remember",
  omitted: "Leave this out"
};

function defaultContext(): ContextDraft[] {
  return contextBlueprint.map((entry) => ({
    ...entry,
    state: "stated",
    value: ""
  }));
}

function contextFromMuse(view: MuseView): ContextDraft[] {
  return contextBlueprint.map((blueprint) => {
    const existing = view.context.find((entry) => entry.kind === blueprint.kind);
    return {
      ...blueprint,
      state: existing?.state ?? "stated",
      value: existing?.value ?? ""
    };
  });
}

function apiMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "This Living Memory could not continue right now.";
}

export function LivingMemoryExperience() {
  const { draftId = "" } = useParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [snapshot, setSnapshot] = useState<LivingMemorySnapshot | null>(null);
  const [processing, setProcessing] = useState<ProcessingView | null>(null);
  const [museQuestion, setMuseQuestion] = useState<string | null>(null);
  const [context, setContext] = useState<ContextDraft[]>(defaultContext);
  const [message, setMessage] = useState<string | null>(null);
  const [shareSelection, setShareSelection] = useState<ShareSelection>({
    includeVoice: true,
    includeCaptions: false,
    includeNarratorAttribution: false,
    includeBrandAttribution: true,
    caption: null
  });
  const [sharePreview, setSharePreview] = useState<SharePreview | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const shareKeyRef = useRef(
    `share_${draftId || "memory"}_${crypto.randomUUID()}`
  );

  const shareUrl = useMemo(
    () => (sharePath ? `${window.location.origin}${sharePath}` : null),
    [sharePath]
  );

  async function requireSnapshot(): Promise<LivingMemorySnapshot> {
    try {
      const next = await loadLivingMemory(draftId);
      setSnapshot(next);
      return next;
    } catch (error) {
      if (error instanceof LivingMemoryApiError && error.status === 401) {
        await navigate(`/auth/protect?draftId=${encodeURIComponent(draftId)}`, {
          replace: true
        });
      }
      throw error;
    }
  }

  async function enterContext(): Promise<void> {
    const nextSnapshot = await requireSnapshot();
    try {
      let muse = await loadMuse(draftId);
      let prompt = muse.musePrompt;
      if (!prompt && muse.transcript) {
        prompt = await askMuse(draftId);
        muse = await loadMuse(draftId);
      }
      setMuseQuestion(prompt?.question ?? null);
      setContext(contextFromMuse(muse));
      setMessage(null);
    } catch {
      setMuseQuestion(null);
      setContext(defaultContext());
      setMessage(
        "Muse could not help right now. Your photograph and voice are safe, and you can continue with your own context."
      );
    }
    setSnapshot(nextSnapshot);
    setStage("context");
  }

  async function beginJourney(): Promise<void> {
    setMessage(null);
    try {
      const next = await requireSnapshot();
      if (next.status === "complete") {
        setStage("complete");
        return;
      }

      let state = await loadProcessing(draftId);
      if (state.state === "not_requested" || state.state === "failed") {
        state = await startProcessing(draftId);
      }
      setProcessing(state);

      if (state.state === "ready") {
        await enterContext();
      } else {
        setStage("processing");
      }
    } catch (error) {
      setMessage(apiMessage(error));
      setStage("error");
    }
  }

  useEffect(() => {
    if (!draftId) {
      setMessage("This Living Memory does not have a draft ID.");
      setStage("error");
      return;
    }
    void beginJourney();
  }, [draftId]);

  useEffect(() => {
    if (stage !== "processing") return;
    let active = true;
    let timer: number | null = null;

    async function poll() {
      try {
        const state = await loadProcessing(draftId);
        if (!active) return;
        setProcessing(state);

        if (state.state === "ready") {
          await enterContext();
          return;
        }
        if (state.state === "failed") {
          setMessage(
            "Your photograph and voice are safe. The transcript needs another try."
          );
          return;
        }
        timer = window.setTimeout(poll, 1600);
      } catch (error) {
        if (!active) return;
        setMessage(apiMessage(error));
        timer = window.setTimeout(poll, 3000);
      }
    }

    timer = window.setTimeout(poll, 1000);
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [stage, draftId]);

  async function retryProcessing() {
    setMessage(null);
    try {
      setProcessing(await startProcessing(draftId));
      setStage("processing");
    } catch (error) {
      setMessage(apiMessage(error));
    }
  }

  function updateContext(
    kind: StoryContextKind,
    changes: Partial<Pick<ContextDraft, "state" | "value">>
  ) {
    setContext((current) =>
      current.map((entry) => {
        if (entry.kind !== kind) return entry;
        const next = { ...entry, ...changes };
        if (changes.state === "unknown" || changes.state === "omitted") {
          next.value = "";
        }
        return next;
      })
    );
  }

  async function reviewContext() {
    setMessage(null);
    const invalid = context.find(
      (entry) =>
        (entry.state === "stated" || entry.state === "approximate") &&
        !entry.value.trim()
    );
    if (invalid) {
      setMessage(
        `For “${invalid.label},” add what you remember or choose “I don't remember” or “Leave this out.”`
      );
      return;
    }

    try {
      await saveStoryContext(
        draftId,
        context.map((entry) => ({
          kind: entry.kind,
          state: entry.state,
          value:
            entry.state === "stated" || entry.state === "approximate"
              ? entry.value.trim()
              : null,
          sourceRef: snapshot?.transcript?.revisionId
            ? `transcript:${snapshot.transcript.revisionId}`
            : null
        })),
        `context_${draftId}_${crypto.randomUUID()}`
      );
      setSnapshot(await loadLivingMemory(draftId));
      setStage("review");
    } catch (error) {
      setMessage(apiMessage(error));
    }
  }

  async function finishLivingMemory() {
    setStage("completing");
    setMessage(null);
    try {
      await completeLivingMemory(draftId);
      setSnapshot(await loadLivingMemory(draftId));
      setStage("complete");
    } catch (error) {
      setMessage(apiMessage(error));
      setStage("review");
    }
  }

  async function prepareSharePreview() {
    if (!snapshot) return;
    setMessage(null);
    try {
      setSharePreview(
        await previewLivingMemoryShare(snapshot.livingMemoryId, shareSelection)
      );
      setStage("share-preview");
    } catch (error) {
      setMessage(apiMessage(error));
    }
  }

  async function createFamilyLink() {
    if (!snapshot) return;
    setMessage(null);
    try {
      const result = await createLivingMemoryShare(
        snapshot.livingMemoryId,
        shareSelection,
        shareKeyRef.current
      );
      setSharePath(result.sharePath);
      setStage("share-created");
    } catch (error) {
      setMessage(apiMessage(error));
    }
  }

  async function copyFamilyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Private family link copied.");
    } catch {
      setMessage("Copy the private link from the field below.");
    }
  }

  async function handOffShare() {
    if (!shareUrl) return;
    const nativeShare = (
      navigator as Navigator & {
        share?: (data?: ShareData) => Promise<void>;
      }
    ).share;

    if (typeof nativeShare === "function") {
      try {
        await nativeShare.call(navigator, {
          title: "A Living Memory",
          text: "I wanted to share this memory with you.",
          url: shareUrl
        });
        return;
      } catch {
        return;
      }
    }
    await copyFamilyLink();
  }

  if (stage === "loading" || !snapshot) {
    return (
      <MemoryPage>
        {stage === "error" ? (
          <ErrorPanel message={message ?? "This Living Memory could not be opened."} />
        ) : (
          <div className="centered-state" role="status">
            <div className="soft-loader" aria-hidden="true" />
            <p>Opening your Living Memory…</p>
          </div>
        )}
      </MemoryPage>
    );
  }

  if (stage === "processing") {
    return (
      <MemoryPage>
        <section className="living-memory-card">
          <p className="eyebrow">Your originals are safe</p>
          <h1>Listening to your story.</h1>
          <OriginalPair snapshot={snapshot} compact />
          <p className="capture-lede">
            We’re turning your recording into readable words so Muse can help you remember.
            Your real voice remains the original.
          </p>
          <p className="preservation-status" role="status">
            {processing?.state === "failed"
              ? "The transcript needs another try."
              : "Your photograph and voice stay protected while this finishes."}
          </p>
          {message && <p className="inline-error" role="alert">{message}</p>}
          {processing?.state === "failed" && (
            <button className="primary-action" type="button" onClick={() => void retryProcessing()}>
              Try transcript again
            </button>
          )}
        </section>
      </MemoryPage>
    );
  }

  if (stage === "context") {
    return (
      <MemoryPage>
        <section className="living-memory-card">
          <p className="eyebrow">Muse helps you remember</p>
          <h1>Your memory stays yours.</h1>
          <OriginalPair snapshot={snapshot} compact />
          {museQuestion && (
            <div className="muse-prompt">
              <strong>Muse asks</strong>
              <p>{museQuestion}</p>
              <span>If that brings something back, add it below. Muse is not checking whether your memory is “right.”</span>
            </div>
          )}
          {snapshot.transcript && (
            <details className="memory-transcript">
              <summary>Read the transcript from your recording</summary>
              <p>{snapshot.transcript.text}</p>
              <span>Your recording—not this transcript—is the original testimony.</span>
            </details>
          )}
          <div className="memory-context-grid">
            {context.map((entry) => (
              <ContextEditor
                key={entry.kind}
                entry={entry}
                onChange={(changes) => updateContext(entry.kind, changes)}
              />
            ))}
          </div>
          {message && <p className="inline-error" role="alert">{message}</p>}
          <button className="primary-action" type="button" onClick={() => void reviewContext()}>
            Review my Living Memory
          </button>
        </section>
      </MemoryPage>
    );
  }

  if (stage === "review" || stage === "completing") {
    return (
      <MemoryPage>
        <section className="living-memory-card">
          <p className="eyebrow">Before you preserve it</p>
          <h1>This is your story.</h1>
          <OriginalPair snapshot={snapshot} />
          {snapshot.transcript && (
            <div className="memory-review-section">
              <strong>Transcript from your voice</strong>
              <p>{snapshot.transcript.text}</p>
              <span>Your original recording stays unchanged.</span>
            </div>
          )}
          {snapshot.musePrompt && (
            <div className="memory-review-section">
              <strong>Muse’s remembering prompt</strong>
              <p>{snapshot.musePrompt.question}</p>
            </div>
          )}
          <ContextReview snapshot={snapshot} />
          <p className="privacy-promise">
            Private by default. “Confirm” here means this is what you want attached to your story—not that the platform verified history.
          </p>
          {message && <p className="inline-error" role="alert">{message}</p>}
          <div className="capture-actions">
            <button
              className="primary-action"
              type="button"
              disabled={stage === "completing"}
              onClick={() => void finishLivingMemory()}
            >
              {stage === "completing" ? "Preserving…" : "Preserve this Living Memory"}
            </button>
            <button className="secondary-action" type="button" onClick={() => setStage("context")}>
              Change context
            </button>
          </div>
        </section>
      </MemoryPage>
    );
  }

  if (stage === "complete") {
    return (
      <MemoryPage>
        <section className="living-memory-card completion-card">
          <p className="eyebrow">Living Memory preserved</p>
          <h1>This memory is now part of your family's history.</h1>
          <OriginalPair snapshot={snapshot} />
          <div className="durable-status" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Private Living Memory complete</strong>
              <p>Your original photograph and real voice remain together in your archive.</p>
            </div>
          </div>
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => setStage("share-settings")}>
              Share with family
            </button>
            <Link className="secondary-action" to="/archive">Keep private</Link>
          </div>
        </section>
      </MemoryPage>
    );
  }

  if (stage === "share-settings") {
    return (
      <MemoryPage>
        <section className="living-memory-card">
          <p className="eyebrow">Optional family sharing</p>
          <h1>You decide what leaves your archive.</h1>
          <p className="capture-lede">
            The photograph is included. Your original voice is included by default.
            Context and other archive details stay private.
          </p>
          <label className="share-option">
            <input
              type="checkbox"
              checked={shareSelection.includeVoice}
              onChange={(event) =>
                setShareSelection((current) => ({
                  ...current,
                  includeVoice: event.target.checked
                }))
              }
            />
            Include my original voice
          </label>
          <label className="share-option">
            <input
              type="checkbox"
              checked={shareSelection.includeCaptions}
              disabled={!snapshot.transcript}
              onChange={(event) =>
                setShareSelection((current) => ({
                  ...current,
                  includeCaptions: event.target.checked
                }))
              }
            />
            Include transcript as captions
          </label>
          <label className="share-option">
            <input
              type="checkbox"
              checked={shareSelection.includeBrandAttribution}
              onChange={(event) =>
                setShareSelection((current) => ({
                  ...current,
                  includeBrandAttribution: event.target.checked
                }))
              }
            />
            Include Memories: My Story attribution
          </label>
          <label className="memory-field">
            <span>Optional note for family</span>
            <textarea
              value={shareSelection.caption ?? ""}
              rows={3}
              onChange={(event) =>
                setShareSelection((current) => ({
                  ...current,
                  caption: event.target.value || null
                }))
              }
              placeholder="A short note you want family to see"
            />
          </label>
          {message && <p className="inline-error" role="alert">{message}</p>}
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => void prepareSharePreview()}>
              Preview what family will see
            </button>
            <button className="secondary-action" type="button" onClick={() => setStage("complete")}>
              Keep private
            </button>
          </div>
        </section>
      </MemoryPage>
    );
  }

  if (stage === "share-preview" && sharePreview) {
    return (
      <MemoryPage>
        <section className="living-memory-card">
          <p className="eyebrow">Share preview</p>
          <h1>Only this will leave your archive.</h1>
          {sharePreview.caption && <p className="share-preview-caption">{sharePreview.caption}</p>}
          <div className="story-photo-focus">
            <img src={snapshot.originals.photo.mediaUrl} alt="Photograph in the family share" />
          </div>
          {sharePreview.voice && (
            <audio className="voice-player" controls src={snapshot.originals.audio.mediaUrl}>
              Your browser cannot play this recording.
            </audio>
          )}
          {sharePreview.captions && (
            <div className="memory-review-section">
              <strong>Included captions</strong>
              <p>{sharePreview.captions}</p>
            </div>
          )}
          {sharePreview.brandAttribution && (
            <p className="cross-device-note">Includes: {sharePreview.brandAttribution}</p>
          )}
          <p className="privacy-promise">
            Not included: private context, family relationships, account details, internal IDs, or unrelated archive information.
          </p>
          {message && <p className="inline-error" role="alert">{message}</p>}
          <div className="capture-actions">
            <button className="primary-action" type="button" onClick={() => void createFamilyLink()}>
              Create private family link
            </button>
            <button className="secondary-action" type="button" onClick={() => setStage("share-settings")}>
              Change share
            </button>
          </div>
        </section>
      </MemoryPage>
    );
  }

  return (
    <MemoryPage>
      <section className="living-memory-card">
        <p className="eyebrow">Private family link ready</p>
        <h1>Share it only when you choose.</h1>
        <OriginalPair snapshot={snapshot} compact />
        {shareUrl && (
          <label className="memory-field">
            <span>Your private family link</span>
            <input readOnly value={shareUrl} />
          </label>
        )}
        {message && <p className="preservation-status" role="status">{message}</p>}
        <div className="capture-actions">
          <button className="primary-action" type="button" onClick={() => void handOffShare()}>
            Share private link
          </button>
          {shareUrl && (
            <a className="secondary-action" href={shareUrl} target="_blank" rel="noreferrer">
              Open family view
            </a>
          )}
          <Link className="secondary-action" to="/archive">Return to my archive</Link>
        </div>
      </section>
    </MemoryPage>
  );
}

function MemoryPage({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="quiet-page living-memory-page" id="main-content">
      <header className="capture-header">
        <Link className="capture-brand" to="/">
          Memories: <em>My Story</em>
        </Link>
        <span className="capture-step-label">Living Memory</span>
      </header>
      {children}
    </div>
  );
}

function OriginalPair({
  snapshot,
  compact = false
}: {
  readonly snapshot: LivingMemorySnapshot;
  readonly compact?: boolean;
}) {
  return (
    <>
      <div className={compact ? "story-photo-focus compact-story-photo" : "story-photo-focus"}>
        <img src={snapshot.originals.photo.mediaUrl} alt="Your preserved photograph" />
      </div>
      <audio className="voice-player" controls src={snapshot.originals.audio.mediaUrl}>
        Your browser cannot play your preserved original recording.
      </audio>
    </>
  );
}

function ContextEditor({
  entry,
  onChange
}: {
  readonly entry: ContextDraft;
  readonly onChange: (changes: Partial<Pick<ContextDraft, "state" | "value">>) => void;
}) {
  const acceptsValue = entry.state === "stated" || entry.state === "approximate";
  return (
    <fieldset className="memory-context-card">
      <legend>{entry.label}</legend>
      <label className="memory-field">
        <span>{entry.prompt}</span>
        <input
          value={entry.value}
          disabled={!acceptsValue}
          onChange={(event) => onChange({ value: event.target.value })}
          placeholder={acceptsValue ? "Add what you remember" : ""}
        />
      </label>
      <label className="memory-field">
        <span>How should this be preserved?</span>
        <select
          value={entry.state}
          onChange={(event) =>
            onChange({ state: event.target.value as StoryContextState })
          }
        >
          {Object.entries(contextStateLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

function ContextReview({ snapshot }: { readonly snapshot: LivingMemorySnapshot }) {
  return (
    <div className="memory-context-review" aria-label="Story context">
      {contextBlueprint.map((blueprint) => {
        const entry = snapshot.context.find(
          (candidate) => candidate.kind === blueprint.kind
        );
        if (!entry) return null;
        return (
          <div key={blueprint.kind}>
            <strong>{blueprint.label}</strong>
            <span>
              {entry.state === "unknown"
                ? "I don't remember"
                : entry.state === "omitted"
                  ? "Left out"
                  : entry.value}
              {entry.state === "approximate" ? " — approximate" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ErrorPanel({ message }: { readonly message: string }) {
  return (
    <section className="living-memory-card error-state" role="alert">
      <p className="eyebrow">Your originals are still safe</p>
      <h1>The Living Memory needs another try.</h1>
      <p className="capture-lede">{message}</p>
      <div className="capture-actions">
        <button className="primary-action" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link className="secondary-action" to="/archive">Return to my archive</Link>
      </div>
    </section>
  );
}
