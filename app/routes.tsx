import type { RouteObject } from "react-router";
import { Link, Outlet, useRouteError } from "react-router";

import { BrandShell } from "./features/brand/BrandShell";
import { LandingExperience } from "./features/marketing/LandingExperience";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <LandingExperience />
      },
      {
        path: "create",
        lazy: async () => {
          const module = await import("./features/marketing/LivingMemoryStartExperience");
          return { Component: module.LivingMemoryStartExperience };
        }
      },
      {
        path: "capture/:draftId",
        lazy: async () => {
          const module = await import("./features/capture/CaptureExperience");
          return { Component: module.CaptureExperience };
        }
      },
      {
        path: "auth/protect",
        lazy: async () => {
          const module = await import("./features/identity/IdentityExperience");
          return { Component: module.IdentityExperience };
        }
      },
      {
        path: "checkout/:offerId",
        lazy: async () => {
          const module = await import("./features/commerce/CommerceExperience");
          return { Component: module.CheckoutExperience };
        }
      },
      {
        path: "thank-you/:offerId",
        lazy: async () => {
          const module = await import("./features/commerce/CommerceExperience");
          return { Component: module.ThankYouExperience };
        }
      },
      {
        path: "archive",
        lazy: async () => {
          const module = await import("./features/archive/ArchiveExperience");
          return { Component: module.ArchiveExperience };
        }
      },
      {
        path: "archive/:draftId",
        lazy: async () => {
          const module = await import("./features/archive/ArchiveExperience");
          return { Component: module.ArchiveExperience };
        }
      }
    ]
  }
];

function AppShell() {
  return (
    <BrandShell>
      <Outlet />
    </BrandShell>
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Something went wrong.";

  return (
    <BrandShell>
      <main className="journey-page" id="main-content">
        <section className="journey-card error-state" role="alert" aria-labelledby="error-title">
          <p className="lm-eyebrow">Take your time</p>
          <h1 id="error-title">The story is not lost.</h1>
          <p className="journey-lede">{message}</p>
          <Link className="lm-secondary-button" to="/">
            Return home
          </Link>
        </section>
      </main>
    </BrandShell>
  );
}
