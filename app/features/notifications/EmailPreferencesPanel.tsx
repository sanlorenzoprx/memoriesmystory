import { useState } from "react";
import { apiMessageKey } from "../../localization/errors";
import { t, notice, useLocale } from "../../localization/language";

type Preferences = { family_updates: boolean; owner_reminders: boolean; version: number };
const fallback = "Your email choices could not be saved. Please try again.";

/**
 * Optional emails, all off until the person turns them on. Every email of these
 * kinds carries a one-step unsubscribe link that works without signing in.
 */
export function EmailPreferencesPanel({ kinds }: { kinds: readonly ("family_updates" | "owner_reminders")[] }) {
  useLocale();
  const [preferences, setPreferences] = useState<Preferences | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false);

  async function request(init?: RequestInit) {
    const response = await fetch("/resources/email/preferences", { credentials: "same-origin", ...init });
    const body = (await response.json().catch(() => null)) as (Preferences & { error?: { code?: string } }) | null;
    if (!response.ok || !body || typeof body.version !== "number")
      throw new Error(apiMessageKey(body?.error?.code, fallback));
    return body;
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await work();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    family_updates: "Email me when something new is shared with me",
    owner_reminders: "Email me an occasional reminder to add a memory",
  } as const;

  return (
    <details
      className="memory-review-section"
      onToggle={(event) => {
        if (event.currentTarget.open && !preferences) void run(async () => setPreferences(await request()));
      }}
    >
      <summary>{t("Email choices")}</summary>
      <p>
        {t(
          "These emails are off unless you turn them on. They never include your memories' words, photographs or titles, and each one has a link to stop them.",
        )}
      </p>
      {error && <p role="alert">{notice(error)}</p>}
      {preferences && (
        <fieldset disabled={busy}>
          <legend>{t("Optional emails")}</legend>
          {kinds.map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={preferences[kind]}
                onChange={(event) => {
                  const next = { ...preferences, [kind]: event.target.checked };
                  void run(async () => {
                    const stored = await request({
                      method: "PUT",
                      headers: { "Content-Type": "application/json", "X-Memories-Request": "email-v1" },
                      body: JSON.stringify(next),
                    });
                    setPreferences(stored);
                    setSaved(true);
                  });
                }}
              />{" "}
              {t(labels[kind])}
            </label>
          ))}
        </fieldset>
      )}
      {saved && <p role="status">{t("Your email choices are saved.")}</p>}
    </details>
  );
}
