export const uiLocales = ["en-US", "es-US", "es-PR"] as const;
export type UiLocale = (typeof uiLocales)[number];

export function normalizeUiLocale(value: string | null | undefined): UiLocale {
  const locale = value?.trim().replace(/_/g, "-").toLowerCase() ?? "";
  if (locale === "es-pr") return "es-PR";
  if (locale === "es" || locale.startsWith("es-")) return "es-US";
  return "en-US";
}

export function sourceLanguageTag(value?: string | null): string {
  if (value === "eng") return "en";
  if (value === "spa") return "es";
  return value && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value) ? value : "und";
}

export function requestUiLocale(request: Request): UiLocale {
  const selected = new URL(request.url).searchParams.get("lang");
  const preferred = request.headers.get("Accept-Language")?.split(",")[0]?.split(";")[0];
  return normalizeUiLocale(selected || preferred);
}
