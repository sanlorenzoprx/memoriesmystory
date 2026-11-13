import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { esMX } from "@clerk/localizations";
import { useLocale } from "./localization/language";
import { ClerkProvider } from "@clerk/clerk-react";

import { routes } from "./routes";
import { AccountSessionBridge } from "./features/identity/AccountSessionBridge";
import "./styles/global.css";

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
function ConfiguredApplication() {
  const locale = useLocale();
  return <ClerkProvider publishableKey={publishableKey} localization={locale.startsWith("es") ? esMX : undefined}>
    <AccountSessionBridge />
    {application}
  </ClerkProvider>;
}
createRoot(rootElement).render(publishableKey ? <ConfiguredApplication /> : application);
