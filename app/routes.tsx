import type { RouteObject } from "react-router";
import { Link, Outlet, useRouteError } from "react-router";

import { ArchiveExperience } from "./features/archive/ArchiveExperience";
import { BrandShell } from "./features/brand/BrandShell";
import { CaptureExperience } from "./features/capture/CaptureExperience";
import { CheckoutExperience, ThankYouExperience } from "./features/commerce/CommerceExperience";
import { IdentityExperience } from "./features/identity/IdentityExperience";
import { LandingExperience } from "./features/marketing/LandingExperience";
import { LivingMemoryStartExperience } from "./features/marketing/LivingMemoryStartExperience";

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
        element: <LivingMemoryStartExperience />
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
        path: "checkout/:offerId",
        element: <CheckoutExperience />
      },
      {
        path: "thank-you/:offerId",
        element: <ThankYouExperience />
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
