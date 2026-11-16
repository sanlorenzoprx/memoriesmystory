/**
 * Where Muse points a person who may be in danger, by country (decision
 * 2026-11-16, Talk with Muse). Built for global use from the start: a new
 * country is a new entry here, reviewed by the owner before launch there.
 * Anywhere without an entry gets the global fallback, never silence.
 */
export type CrisisLine = {
  readonly label: { readonly en: string; readonly es: string };
  /** A dialable number, or null for a web directory. */
  readonly phone: string | null;
  readonly sms: string | null;
  readonly url: string | null;
};

export type CrisisRegion = {
  readonly lines: readonly CrisisLine[];
  readonly emergencyNumber: string | null;
  /** Date someone checked these numbers; launch in a country needs a fresh check. */
  readonly checkedOn: string;
};

const lifeline988: CrisisLine = {
  label: { en: "988 Suicide & Crisis Lifeline (call or text 988, any time)", es: "Línea 988 de Prevención del Suicidio y Crisis (llama o envía un texto al 988, a cualquier hora; hay ayuda en español)" },
  phone: "988",
  sms: "988",
  url: null
};

export const crisisRegions: Readonly<Record<string, CrisisRegion>> = {
  US: { lines: [lifeline988], emergencyNumber: "911", checkedOn: "2026-11-16" },
  PR: { lines: [lifeline988], emergencyNumber: "911", checkedOn: "2026-11-16" }
};

export const globalCrisisFallback: CrisisRegion = {
  lines: [
    {
      label: { en: "Find a free, confidential helpline in your country", es: "Encuentra una línea de ayuda gratuita y confidencial en tu país" },
      phone: null,
      sms: null,
      url: "https://findahelpline.com"
    }
  ],
  emergencyNumber: null,
  checkedOn: "2026-11-16"
};

/** "en-US" → US, "es-PR" → PR; anything unknown gets the global fallback. */
export function crisisRegionFor(locale: string): CrisisRegion {
  const country = locale.split("-")[1]?.toUpperCase();
  return (country && crisisRegions[country]) || globalCrisisFallback;
}
