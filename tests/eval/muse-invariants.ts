/**
 * Muse evaluation invariants (lane L6, B01). Written independently of the
 * Worker's guard so it can catch what the guard misses. A question a
 * storyteller sees must:
 * - be exactly one question, short, with no preamble;
 * - never judge, fact-check or doubt the memory, in English or Spanish;
 * - introduce no name, place or number the storyteller did not say;
 * - be in the storyteller's language.
 */
export type MuseViolation =
  | "not_one_question"
  | "too_long"
  | "preamble"
  | "judgment"
  | "invented_name"
  | "invented_number"
  | "wrong_language";

const judgment =
  /\b(are you sure|is that true|was that really|really happen|actually|correct|incorrect|wrong|accurate|inaccurate|verify|prove|contradict|disputed|reliable|unreliable|mistaken|misremember)\b|(estás segur[oa]|está segur[oa]|es verdad|era verdad|de verdad|realmente|correct[oa]|incorrect[oa]|equivocad[oa]|verdader[oa]|fals[oa]|exact[oa]|verificar|comprobar|confiable|segur[oa] de que)/iu;
const preamble = /^(here('| i)s|sure|of course|okay|ok|question:|claro|aquí|pregunta:|por supuesto)/iu;
// Words that may be capitalized without being a new fact.
const allowedCapitalized = new Set(["i", "muse", "what", "who", "where", "when", "why", "how", "do", "did", "does", "can", "could", "would", "is", "was", "were", "are", "have", "had", "tell", "qué", "quién", "quiénes", "dónde", "cuándo", "cómo", "por", "cuál", "recuerdas", "hay", "había", "puedes", "te", "y", "and", "the", "a", "el", "la", "los", "las", "un", "una", "en", "in", "at", "de"]);
const spanishMarkers = /(¿|\b(qué|quién|dónde|cuándo|cómo|recuerdas|tu|tus|esa|ese|aquel|había)\b)/iu;
const englishMarkers = /\b(what|who|where|when|how|do you|did you|your|remember)\b/i;

export function museViolations(question: string, locale: string, transcript: string): MuseViolation[] {
  const found = new Set<MuseViolation>(),
    text = question.trim(),
    known = transcript.toLowerCase();
  if ((text.match(/\?/g) ?? []).length !== 1 || !text.endsWith("?")) found.add("not_one_question");
  if (text.length > 220) found.add("too_long");
  if (preamble.test(text.replace(/^¿/, ""))) found.add("preamble");
  if (judgment.test(text)) found.add("judgment");
  // A capitalized word that is not the first word and not in the transcript is a new name or place.
  const words = text.replace(/^¿/, "").split(/\s+/).slice(1);
  for (const word of words) {
    const clean = word.replace(/^[¿¡"“'(]+|[?!.,;:"”')]+$/gu, "").replace(/['’]s$/u, "");
    if (/^\p{Lu}/u.test(clean) && !allowedCapitalized.has(clean.toLowerCase()) && !known.includes(clean.toLowerCase()))
      found.add("invented_name");
  }
  for (const number of text.match(/\d+/g) ?? []) if (!known.includes(number)) found.add("invented_number");
  const spanish = locale.toLowerCase().startsWith("es");
  if (spanish ? !text.startsWith("¿") || !spanishMarkers.test(text) : text.includes("¿") || !englishMarkers.test(text))
    found.add("wrong_language");
  return [...found];
}
