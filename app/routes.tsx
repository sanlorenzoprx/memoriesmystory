import type { RouteObject } from "react-router";
import {
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
  useSearchParams
} from "react-router";

import { appIdentity } from "../config/app-identity";
import { firstExperienceContent } from "./features/first-experience/content";

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
        path: "first-memory",
        element: <FirstMemoryRoute />
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
        <p className="header-promise">Your stories. Your voice.</p>
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

          <div className="hero-actions" aria-label="Begin your first Memory Story">
            <Link
              className="primary-action"
              to="/first-memory?start=camera"
            >
              <CameraIcon />
              {firstExperienceContent.primaryAction}
            </Link>
            <Link
              className="secondary-action"
              to="/first-memory?start=import"
            >
              <ImportIcon />
              {firstExperienceContent.secondaryAction}
            </Link>
          </div>

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

function FirstMemoryRoute() {
  const [searchParams] = useSearchParams();
  const beginsWithImport = searchParams.get("start") === "import";

  return (
    <div className="quiet-page" id="main-content">
      <header className="site-header compact-header">
        <BrandLockup brandName={appIdentity.brandName} />
      </header>
      <section className="capture-introduction" aria-labelledby="first-memory-title">
        <Link className="back-link" to="/">
          <ArrowIcon /> Back
        </Link>
        <p className="eyebrow">First, the photograph</p>
        <h1 id="first-memory-title">
          {beginsWithImport
            ? "Choose the photograph that brings the story back."
            : "Bring the photograph into the light."}
        </h1>
        <p className="lede">
          {beginsWithImport
            ? "A favorite picture, a face you miss, or a moment your family should always remember."
            : "Place it on a flat surface in soft, even light. Take your time—we’ll help with glare, focus, and framing."}
        </p>
        <div className="capture-preview" aria-label="Photograph capture preparation">
          <PhotoIcon />
          <p>
            <strong>Your photograph comes first.</strong>
            <span>Your voice will meet it in the next gentle step.</span>
          </p>
        </div>
        <p className="privacy-promise centered-promise">
          <LockIcon /> Nothing is shared unless you choose.
        </p>
      </section>
    </div>
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

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m12.5 4.5-5 5 5 5M8 9.5h8" />
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
