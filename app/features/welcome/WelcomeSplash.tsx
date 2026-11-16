import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { loadArchive, loadArchiveDraft } from "../../services/identity-api";
import { displayUrl } from "../../services/display-url";
import { t, useLocale } from "../../localization/language";

const shownKey = "memoriesmystory:welcome-splash-shown",
  durationMs = 3000;
export const welcomeSplashSetting = "memoriesmystory:welcome-splash";

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
const pick = <T,>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)];

/** One of the person's own finished photographs. */
async function choosePhoto(): Promise<string | null> {
  // Only a verified, signed-in session can read the archive; anyone else sees nothing.
  const drafts = (await loadArchive()).filter(
    (draft) => draft.status === "complete",
  );
  if (!drafts.length) return null;
  const { assets } = await loadArchiveDraft(pick(drafts)!.id),
    original = assets.find((asset) => asset.role === "original_photo");
  return original ? displayUrl(original.mediaUrl) : null;
}

/**
 * A three-second welcome for a signed-in person who has already made Living
 * Memories (owner decisions 2026-11-16): one of their own photographs and
 * nothing else — no words; the image is all the meaning the splash needs.
 * Never shown to a new visitor, so the first five minutes are unchanged. Once per visit, only on the start screen or the archive, never
 * on a deep link. Any tap or key closes it; it can be turned off in the archive.
 */
export function WelcomeSplash() {
  useLocale();
  const { pathname, search } = useLocation(),
    [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/" && pathname !== "/archive") return;
    const params = new URLSearchParams(search);
    if (params.has("start") || params.has("ref")) return;
    if (
      read(() => sessionStorage, shownKey) ||
      read(() => localStorage, welcomeSplashSetting) === "off"
    )
      return;
    let cancelled = false;
    void (async () => {
      const chosen = await choosePhoto();
      if (!chosen || cancelled) return;
      // Shown only once the photograph has loaded, so it never flashes empty.
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("welcome photo unavailable"));
        image.src = chosen;
      });
      if (cancelled) return;
      write(() => sessionStorage, shownKey, "1");
      setShown(chosen);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, search]);

  useEffect(() => {
    if (!shown) return;
    const close = () => setShown(null);
    const timer = window.setTimeout(close, durationMs);
    window.addEventListener("keydown", close);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", close);
    };
  }, [shown]);

  if (!shown) return null;
  return (
    <div className="welcome-splash" onClick={() => setShown(null)}>
      {/* Alt text is for screen readers only; nothing is written over the image. */}
      <img
        className="welcome-splash-photo"
        src={shown}
        alt={t("A photograph from one of your Living Memories")}
      />
    </div>
  );
}

/** The archive setting that turns the welcome photograph on or off on this device. */
export function WelcomeSplashSetting() {
  useLocale();
  const [on, setOn] = useState(
    () => read(() => localStorage, welcomeSplashSetting) !== "off",
  );
  return (
    <label className="share-option">
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => {
          setOn(event.target.checked);
          write(
            () => localStorage,
            welcomeSplashSetting,
            event.target.checked ? "on" : "off",
          );
        }}
      />{" "}
      {t("Show one of my photographs when I open the app")}
    </label>
  );
}
