import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";

import { openAccountSession } from "../../services/identity-api";

/**
 * Keeps the private Memories session aligned with Clerk whenever a person is
 * already signed in. Draft ownership is still claimed explicitly at the
 * durable-memory handoff.
 */
export function AccountSessionBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let active = true;
    void getToken()
      .then((token) => {
        if (!active || !token) return;
        return openAccountSession(token);
      })
      .catch(() => {
        // The explicit account screen remains the recoverable/error-reporting
        // path if background session alignment cannot complete.
      });

    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
