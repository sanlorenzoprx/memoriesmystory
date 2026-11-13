import { useSyncExternalStore } from "react";
import { normalizeUiLocale, type UiLocale } from "./locale";
import { translate, noticeKey } from "./messages";

export const languageStorageKey = "memoriesmystory:ui-locale";
function initialLocale(): UiLocale {
  try {
    const stored = globalThis.localStorage?.getItem(languageStorageKey);
    if (stored && ["en-US", "es-US", "es-PR"].includes(stored)) return stored as UiLocale;
  } catch { /* Language still works when browser storage is unavailable. */ }
  return normalizeUiLocale(typeof navigator === "undefined" ? "en-US" : navigator.language);
}
let current = initialLocale();
const listeners = new Set<() => void>();
function applyLanguage() {
  if (typeof document !== "undefined") document.documentElement.lang = current;
}
applyLanguage();
export function getLocale(): UiLocale { return current; }
export function setLocale(value: string) {
  current = normalizeUiLocale(value);
  try { globalThis.localStorage?.setItem(languageStorageKey, current); } catch { /* Apply in memory. */ }
  applyLanguage();
  listeners.forEach((listener) => listener());
}
if (typeof window !== "undefined") window.addEventListener("storage", (event) => {
  if (event.key !== languageStorageKey) return;
  current = event.newValue ? normalizeUiLocale(event.newValue) : normalizeUiLocale(navigator.language);
  applyLanguage();
  listeners.forEach((listener) => listener());
});
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useLocale() { return useSyncExternalStore(subscribe, getLocale, () => "en-US" as UiLocale); }
export function t(key: string, values?: Record<string, string | number>) { return translate(key, current, values); }
export function notice(value: string | null | undefined): string {
  return value ? t(noticeKey(value)) : "";
}
