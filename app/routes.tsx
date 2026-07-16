import type { RouteObject } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";

import { appIdentity } from "../config/app-identity";
import { phase1Limits } from "../config/phase-1-limits";

type HomeLoaderData = {
  brandName: typeof appIdentity.brandName;
  technicalName: typeof appIdentity.technicalName;
  freeStoryCount: typeof phase1Limits.freeMemoryStoryCount;
  freeVoiceSeconds: typeof phase1Limits.freeVoiceSecondsPerStory;
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
    brandName: appIdentity.brandName,
    technicalName: appIdentity.technicalName,
    freeStoryCount: phase1Limits.freeMemoryStoryCount,
    freeVoiceSeconds: phase1Limits.freeVoiceSecondsPerStory
  };
}

function AppShell() {
  return (
    <main className="app-shell">
      <Outlet />
    </main>
  );
}

function HomeRoute() {
  const data = useLoaderData() as HomeLoaderData;

  return (
    <section className="hero" aria-labelledby="page-title">
      <p className="eyebrow">{data.technicalName}</p>
      <h1 id="page-title">{data.brandName}</h1>
      <p className="lede">
        Preserve a photograph, the real voice behind it, and the family story it
        carries.
      </p>
      <div className="promise-card" aria-label="Phase 1 promise">
        <p>
          Start with one complete solo Memory Story: a photo, up to{" "}
          {data.freeVoiceSeconds} seconds of real voice, truthful save status,
          and a deliberate share-to-unlock path through{" "}
          {data.freeStoryCount} free stories.
        </p>
      </div>
      <Link className="primary-action" to="/first-memory">
        Begin first memory
      </Link>
    </section>
  );
}

function FirstMemoryRoute() {
  return (
    <section className="hero" aria-labelledby="first-memory-title">
      <p className="eyebrow">Packet 0 placeholder</p>
      <h1 id="first-memory-title">A photograph matters first.</h1>
      <p className="lede">
        Packet 1 and Packet 2 will replace this placeholder with the first real
        capture, draft recovery, and preservation contracts.
      </p>
      <Link className="secondary-action" to="/">
        Back to start
      </Link>
    </section>
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Something went wrong.";

  return (
    <section className="hero" role="alert" aria-labelledby="error-title">
      <p className="eyebrow">Recoverable state</p>
      <h1 id="error-title">The story is not lost.</h1>
      <p className="lede">{message}</p>
      <Link className="secondary-action" to="/">
        Return home
      </Link>
    </section>
  );
}
