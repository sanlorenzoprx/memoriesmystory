import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { ClerkProvider } from "@clerk/clerk-react";

import { routes } from "./routes";
import "./styles/global.css";
import "./styles/brand-experience.css";
import "./styles/legacy-brand-overrides.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for memoriesmystory.");
}

const application = (
  <StrictMode>
    <RouterProvider router={createBrowserRouter(routes)} />
  </StrictMode>
);

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
createRoot(rootElement).render(
  publishableKey
    ? <ClerkProvider publishableKey={publishableKey}>{application}</ClerkProvider>
    : application
);
