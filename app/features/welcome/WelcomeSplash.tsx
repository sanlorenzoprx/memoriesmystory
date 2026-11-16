import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { loadArchive, loadArchiveDraft } from "../../services/identity-api";
import { displayUrl } from "../../services/display-url";
import { t, useLocale } from "../../localization/language";

const shownKey = "memoriesmystory:welcome-splash-shown",
  offKey = "memoriesmystory:welcome-splash",
  durationMs = 3000;

const read = (storage: () => Storage, key: string) => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};
const write = (storage: () => Storage, key: string, value: string) => {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage can be unavailable; the splash then simply may show again.
  }
};

/**
 * A three-second welcome for a signed-in person who has already made Living
 * Memories (owner decision 2026-11-16): one of their own photographs, as a
 * reminder of what they have built. Never shown to a new visitor, so the first
 * five minutes are unchanged. Once per visit, only on the start screen or the
 * archive, never on a deep link. Any tap or key closes it; it can be turned off.
 */
export function WelcomeSplash() {
  useLocale();
  const { pathname, search } = useLocation(),
    [photo, setPhoto] = useState<string | null>(null),
    [count, setCount] = useState(0),
    [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname !== "/" && pathname !== "/archive") return;
    if (new URLSearchParams(search).has("start") || new URLSearchParams(search).has("ref")) return;
    if (read(() => sessionStorage, shownKey) || read(() => localStorage, offKey) === "off") return;
    let cancelled = false;
    void (async () => {
      // Only a verified, signed-in session can read the archive; anyone else sees nothing.
      const drafts = (await loadArchive()).filter((draft) => draft.status === "complete");
      if (!drafts.length || cancelled) return;
      const chosen = drafts[Math.floor(Math.random() * drafts.length)]!;
      const { assets } = await loadArchiveDraft(chosen.id);
      const original = assets.find((asset) => asset.role === "original_photo");
      if (!original || cancelled) return;
      const url = displayUrl(original.mediaUrl);
      // Shown only once the photograph has loaded, so it never flashes empty.
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("welcome photo unavailable"));
        image.src = url;
      });
      if (cancelled) return;
      write(() => sessionStorage, shownKey, "1");
      setCount(drafts.length);
      setPhoto(url);
      setVisible(true);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, search]);

  useEffect(() => {
    if (!visible) return;
    const close = () => setVisible(false);
    const timer = window.setTimeout(close, durationMs);
    window.addEventListener("keydown", close);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", close);
    };
  }, [visible]);

  if (!visible || !photo) return null;
  return (
    <div className="welcome-splash" onClick={() => setVisible(false)}>
      <img className="welcome-splash-photo" src={photo} alt={t("A photograph from one of your Living Memories")} />
      <div className="welcome-splash-copy" role="status">
        <p className="eyebrow">{t("Welcome back")}</p>
        <p className="welcome-splash-line">
          {t(count === 1 ? "You have preserved 1 Living Memory." : "You have preserved {count} Living Memories.", { count })}
        </p>
        <p>{t("Every photograph has a story. Which one is next?")}</p>
        <button type="button" className="secondary-action" onClick={() => setVisible(false)}>
          {t("Continue")}
        </button>
        <button
          type="button"
          className="light-text-action"
          onClick={(event) => {
            event.stopPropagation();
            write(() => localStorage, offKey, "off");
            setVisible(false);
          }}
        >
          {t("Don't show this at start")}
        </button>
      </div>
    </div>
  );
}
