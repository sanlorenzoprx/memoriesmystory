import type { MuseConversationTurn } from "../../services/living-memory-api";
import { t, useLocale } from "../../localization/language";

/**
 * Real people to reach now, shown under Muse's support message (decision
 * 2026-11-16, Talk with Muse). One tap calls or texts; nothing is hidden
 * behind a menu.
 */
export function MuseSupportLines({ support }: { readonly support: NonNullable<MuseConversationTurn["support"]> }) {
  const locale = useLocale(),
    spanish = locale.startsWith("es");
  return (
    <ul className="muse-support-lines" aria-label={t("Help from a real person")}>
      {support.lines.map((line) => (
        <li key={line.label.en}>
          <span>{spanish ? line.label.es : line.label.en}</span>{" "}
          {line.phone && <a href={`tel:${line.phone}`}>{t("Call {number}", { number: line.phone })}</a>}{" "}
          {line.sms && <a href={`sms:${line.sms}`}>{t("Text {number}", { number: line.sms })}</a>}
          {line.url && (
            <a href={line.url} target="_blank" rel="noreferrer">
              {t("Find a helpline")}
            </a>
          )}
        </li>
      ))}
      {support.emergencyNumber && (
        <li>
          <a href={`tel:${support.emergencyNumber}`}>{t("Emergency: call {number}", { number: support.emergencyNumber })}</a>
        </li>
      )}
    </ul>
  );
}
