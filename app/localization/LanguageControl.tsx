import { getLocale, setLocale, t, useLocale } from "./language";

export function LanguageControl() {
  useLocale();
  return <label className="language-control">
    <span>{t("Language")}</span>
    <select aria-label={t("Interface language")} value={getLocale()} onChange={(event) => setLocale(event.target.value)}>
      <option value="en-US" lang="en">English</option>
      <option value="es-US" lang="es">Español</option>
      <option value="es-PR" lang="es-PR">Español (Puerto Rico)</option>
    </select>
  </label>;
}
