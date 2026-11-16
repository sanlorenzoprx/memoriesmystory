/**
 * Reads the text out of a model reply, whichever shape it arrived in:
 * Workers AI models answer `{ response }`; third-party models reached through
 * AI Gateway (Gemini) answer in the Chat Completions shape. Dependency-free so
 * the Worker and `scripts/muse-eval.ts` read replies the same way.
 */
export function modelText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  const choices = record.choices;
  if (!Array.isArray(choices) || !choices.length) return "";
  const content = (choices[0] as { message?: { content?: unknown } })?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .join("");
  return "";
}

/** Third-party models use `{author}/{model}`; Workers AI models use `@cf/`. */
export const isThirdPartyModel = (modelId: string) => !modelId.startsWith("@cf/");
