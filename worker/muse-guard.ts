/**
 * The last guard on a Muse question before a storyteller sees it (I-12: Muse
 * listens first; never fact-checks, judges or introduces facts). Anything
 * that is not exactly one short question in the storyteller's language, that
 * judges or doubts the memory, that opens with a preamble, or that names a
 * person, place or number the storyteller did not say, becomes a gentle
 * fallback. The Muse evaluation (tests/eval, lane L6) checks the result
 * independently.
 */
export const judgmentPattern =
  /\b(are you sure|is that true|was that really|really happen|actually|correct|incorrect|wrong|accurate|inaccurate|verify|verified|prove|contradict|disputed|reliable|unreliable|mistaken|misremember)\b|(estás segur[oa]|está segur[oa]|es verdad|era verdad|de verdad|realmente|correct[oa]|incorrect[oa]|equivocad[oa]|verdader[oa]|fals[oa]|verificar|comprobar|confiable)/iu;

const preamblePattern = /^(here('| i)s|sure|of course|okay|ok|question:|claro|aquí|pregunta:|por supuesto)/iu;
const ordinaryCapitalized = new Set(["i", "muse", "what", "who", "where", "when", "why", "how", "do", "did", "does", "can", "could", "would", "is", "was", "were", "are", "have", "had", "tell", "qué", "quién", "quiénes", "dónde", "cuándo", "cómo", "por", "cuál", "recuerdas", "hay", "había", "puedes", "te"]);

export function fallbackQuestion(locale: string): string {
  return locale.toLowerCase().startsWith("es")
    ? "¿Qué más recuerdas cuando miras esta foto?"
    : "What else comes back to you when you look at this photograph?";
}

/** Names, places and numbers in the question that the storyteller never said. */
function introducesFacts(question: string, transcript: string): boolean {
  const known = transcript.toLowerCase();
  const words = question.replace(/^¿/, "").split(/\s+/).slice(1);
  for (const word of words) {
    const clean = word.replace(/^[¿¡"“'(]+|[?!.,;:"”')]+$/gu, "").replace(/['’]s$/u, "");
    if (/^\p{Lu}/u.test(clean) && !ordinaryCapitalized.has(clean.toLowerCase()) && !known.includes(clean.toLowerCase()))
      return true;
  }
  return (question.match(/\d+/g) ?? []).some((number) => !known.includes(number));
}

function inLanguage(question: string, locale: string): boolean {
  return locale.toLowerCase().startsWith("es") ? question.startsWith("¿") : !question.includes("¿");
}

/**
 * `transcript` is the storyteller's own words. Without it, names and numbers
 * cannot be checked, so only the other rules apply.
 */
export function normalizeQuestion(candidate: string, locale: string, transcript?: string): string {
  const singleLine = candidate.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
  const sentence = singleLine.split(/(?<=[?])\s+/)[0]?.trim() ?? "";
  if (
    !sentence ||
    sentence.length > 220 ||
    !sentence.endsWith("?") ||
    judgmentPattern.test(sentence) ||
    preamblePattern.test(sentence.replace(/^¿/, "")) ||
    !inLanguage(sentence, locale) ||
    (transcript !== undefined && introducesFacts(sentence, transcript))
  ) {
    return fallbackQuestion(locale);
  }
  return sentence;
}
