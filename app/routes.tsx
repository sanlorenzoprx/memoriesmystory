import type { RouteObject } from "react-router";
import { useState } from "react";
import {
  Link,
  useNavigate,
  Outlet,
  useLoaderData,
  useRouteError
} from "react-router";

import { appIdentity } from "../config/app-identity";
import { firstExperienceContent } from "./features/first-experience/content";
import { CaptureExperience } from "./features/capture/CaptureExperience";
import { IdentityExperience } from "./features/identity/IdentityExperience";
import { ArchiveExperience } from "./features/archive/ArchiveExperience";
import type { CaptureEntryMode } from "./features/capture/local-draft";
import { beginLocalDraft } from "./services/local-draft-store";

type HomeLoaderData = {
  brandName: typeof appIdentity.brandName;
};

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        loader: homeLoader,
        element: <HomeRoute />
      },
      {
        path: "capture/:draftId",
        element: <CaptureExperience />
      },
      {
        path: "auth/protect",
        element: <IdentityExperience />
      },
      {
        path: "archive",
        element: <ArchiveExperience />
      },
      {
        path: "archive/:draftId",
        element: <ArchiveExperience />
      }
    ]
  }
];

export function homeLoader(): HomeLoaderData {
  return {
    brandName: appIdentity.brandName
  };
}

function AppShell() {
  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to the story
      </a>
      <Outlet />
    </main>
  );
}

function HomeRoute() {
  const data = useLoaderData() as HomeLoaderData;

  return (
    <div className="home-page">
      <header className="site-header">
        <BrandLockup brandName={data.brandName} />
        <div className="header-links">
          <p className="header-promise">Your stories. Your voice.</p>
          <Link className="archive-entry" to="/auth/protect">My stories</Link>
        </div>
      </header>

      <section
        className="first-experience"
        id="main-content"
        aria-labelledby="page-title"
      >
        <div className="hero-copy">
          <p className="eyebrow">{firstExperienceContent.eyebrow}</p>
          <h1 id="page-title">{firstExperienceContent.headline}</h1>
          <p className="lede">{firstExperienceContent.supporting}</p>

          <StartMemoryActions />

          <p className="privacy-promise">
            <LockIcon />
            {firstExperienceContent.privacyPromise}
          </p>
        </div>

        <MemoryPhotoMoment />
      </section>

      <ol className="memory-journey" aria-label="Your Memory Story journey">
        {firstExperienceContent.journey.map((stage, index) => (
          <li className={index === 0 ? "is-current" : undefined} key={stage}>
            <span className="journey-dot" aria-hidden="true" />
            <span>{stage}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StartMemoryActions() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState<CaptureEntryMode | null>(null);

  async function start(entryMode: CaptureEntryMode) {
    setStarting(entryMode);
    setErrorMessage(null);

    try {
      const draft = await beginLocalDraft(entryMode, navigator.language);
      await navigate(`/capture/${encodeURIComponent(draft.id)}?start=${entryMode}`);
    } catch {
      setErrorMessage(
        "This browser could not start a recoverable draft. Check storage settings and try again."
      );
      setStarting(null);
    }
  }

  return (
    <>
      <div className="hero-actions" aria-label="Begin your first Memory Story">
        <button
          className="primary-action"
          type="button"
          disabled={starting !== null}
          onClick={() => void start("camera")}
        >
          <CameraIcon />
          {starting === "camera" ? "Opening…" : firstExperienceContent.primaryAction}
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={starting !== null}
          onClick={() => void start("import")}
        >
          <ImportIcon />
          {starting === "import" ? "Opening…" : firstExperienceContent.secondaryAction}
        </button>
      </div>
      {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
    </>
  );
}

function BrandLockup({ brandName }: { brandName: string }) {
  return (
    <Link className="brand-lockup" to="/" aria-label={`${brandName}, home`}>
      <svg
        className="brand-mark"
        viewBox="0 0 42 42"
        aria-hidden="true"
      >
        <rect x="4" y="5" width="27" height="31" rx="7" />
        <path d="M10 27.5 16.5 21l4.5 4.5 3.25-3.25L29 27.5" />
        <circle cx="14" cy="15" r="3" />
        <path d="M33.5 12.5c4 4.5 4 12.5 0 17" />
      </svg>
      <span>
        Memories: <em>My Story</em>
      </span>
    </Link>
  );
}

function MemoryPhotoMoment() {
  return (
    <figure className="photo-moment" aria-labelledby="photo-prompt">
      <div className="photo-shadow" aria-hidden="true" />
      <div className="keepsake-photo">
        <div className="photo-surface">
          <span className="photo-corner corner-top-left" aria-hidden="true" />
          <span className="photo-corner corner-top-right" aria-hidden="true" />
          <span className="photo-corner corner-bottom-left" aria-hidden="true" />
          <span className="photo-corner corner-bottom-right" aria-hidden="true" />

          <div className="photo-prompt">
            <PhotoIcon />
            <strong id="photo-prompt">
              {firstExperienceContent.photoPrompt}
            </strong>
            <span>{firstExperienceContent.photoGuidance}</span>
          </div>
        </div>

        <figcaption className="voice-keepsake">
          <VoiceWave />
          <span>
            Keep the <strong>voice</strong> with the photograph.
          </span>
        </figcaption>
      </div>
    </figure>
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Something went wrong.";

  return (
    <div className="quiet-page" id="main-content">
      <section className="capture-introduction error-state" role="alert" aria-labelledby="error-title">
        <p className="eyebrow">Take your time</p>
        <h1 id="error-title">The story is not lost.</h1>
        <p className="lede">{message}</p>
        <Link className="secondary-action" to="/">
          Return home
        </Link>
      </section>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 6.5 10 4.75h4l1.5 1.75H19a2 2 0 0 1 2 2v8.75a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m5.5 17 4-4 3 3 2.5-2.5 3.5 3.5" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="photo-icon" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="5.5" y="7" width="37" height="34" rx="5" />
      <circle cx="17" cy="18" r="4" />
      <path d="m9 35 10-10 7 7 4.5-4.5L39 35" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4" y="8.5" width="12" height="9" rx="3" />
      <path d="M6.75 8.5V6a3.25 3.25 0 0 1 6.5 0v2.5" />
    </svg>
  );
}

function VoiceWave() {
  const bars = [10, 18, 27, 16, 32, 23, 12, 20, 9];

  return (
    <span className="voice-wave" aria-hidden="true">
      {bars.map((height, index) => (
        <span key={`${height}-${index}`} style={{ height }} />
      ))}
    </span>
  );
}
