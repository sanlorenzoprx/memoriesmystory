import { crisisRegionFor, type CrisisLine } from "../config/muse-safety";

/**
 * A first, deliberately narrow check for a person who may be in danger
 * (decision 2026-11-16, Talk with Muse; New York and California companion
 * safeguards). It looks for first-person, present-tense statements of wanting
 * to die or to hurt oneself, in English and Spanish. A memory *about* a death,
 * even a suicide, is testimony and does not trigger it. It is a floor, not a
 * clinical tool: a model-based second check comes with the open conversation.
 */
const signals: readonly RegExp[] = [
  /\b(?:i\s*(?:'m|am)\s*(?:feeling\s+)?suicidal|i(?:\s*'m|\s+am|\s*'ve|\s+have)?\s+(?:been\s+|also\s+|sometimes\s+|often\s+)?(?:think(?:ing)?|thought)\s+(?:about|of)\s+(?:suicide|killing\s+myself|ending\s+(?:it\s+all|my\s+life))|(?:going|want|plan(?:ning)?)\s+to\s+(?:kill\s+myself|end\s+(?:it\s+all|my\s+life)))\b/i,
  /\b(?:kill(?:ing)?\s+myself|end(?:ing)?\s+my\s+(?:own\s+)?life|tak(?:e|ing)\s+my\s+(?:own\s+)?life)\b/i,
  /\bi\s+(?:just\s+|really\s+)?(?:want|wish)\s+(?:to\s+die|i\s+(?:was|were)\s+dead)\b/i,
  /\bi\s+(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|be\s+here)\s+any\s*(?:more|longer)\b/i,
  /\b(?:no\s+reason\s+to\s+(?:live|go\s+on)|(?:they|everyone|my\s+family)\s+(?:would|'d)\s+be\s+better\s+off\s+without\s+me)\b/i,
  /\b(?:hurt(?:ing)?|cut(?:ting)?|harm(?:ing)?)\s+myself\b/i,
  /(?<!\p{L})(?:suicidarme|matarme|quitarme\s+la\s+vida|acabar\s+con\s+mi\s+vida|hacerme\s+da[ñn]o|lastimarme|cortarme)(?!\p{L})/iu,
  /(?<!\p{L})(?:quiero|quisiera)\s+morir(?:me)?(?!\p{L})/iu,
  /(?<!\p{L})no\s+quiero\s+(?:vivir|seguir\s+viviendo|estar\s+aqu[ií])(?!\p{L})/iu,
  /(?<!\p{L})(?:estar[ií]an|estar[ií]a)\s+mejor\s+sin\s+m[ií](?!\p{L})/iu
];

export function showsCrisisSignal(text: string): boolean {
  return signals.some((signal) => signal.test(text));
}

export type SupportReply = { readonly message: string; readonly lines: readonly CrisisLine[]; readonly emergencyNumber: string | null };

/**
 * What Muse says instead of its next question. It says plainly that Muse is an
 * AI, points to a real person now, and leaves the story where it is; the
 * person can keep talking afterwards.
 */
export function supportReply(locale: string): SupportReply {
  const region = crisisRegionFor(locale),
    spanish = locale.toLowerCase().startsWith("es"),
    line = region.lines[0]!,
    reach = line.phone
      ? spanish
        ? `puedes llamar o enviar un texto al ${line.phone} para hablar ahora mismo con una persona, a cualquier hora; hay ayuda en español`
        : `you can call or text ${line.phone} to talk with a real person right now, any time`
      : spanish
        ? `puedes encontrar una línea de ayuda gratuita en tu país en ${line.url}`
        : `you can find a free helpline in your country at ${line.url}`,
    danger = region.emergencyNumber
      ? spanish
        ? `Si estás en peligro inmediato, llama al ${region.emergencyNumber}.`
        : `If you are in immediate danger, call ${region.emergencyNumber}.`
      : spanish
        ? "Si estás en peligro inmediato, llama al número de emergencias local."
        : "If you are in immediate danger, call your local emergency number.";
  const message = spanish
    ? `Gracias por contármelo. Soy una inteligencia artificial y me importa que estés a salvo. Si estás pensando en quitarte la vida o hacerte daño, ${reach}. ${danger} Tu historia estará aquí cuando quieras volver a ella.`
    : `Thank you for telling me. I'm an AI, and I care that you are safe. If you are thinking about ending your life or hurting yourself, ${reach}. ${danger} Your story will be here whenever you want to come back to it.`;
  return { message, lines: region.lines, emergencyNumber: region.emergencyNumber };
}
