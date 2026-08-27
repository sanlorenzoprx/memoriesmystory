import type { PhotoStoryPromptInput, PhotoStoryPromptResult } from "../../domain/agent-surface";
import { PHOTO_PROMPTS, captureTip, normalizeLanguage } from "./prompt-library";

export interface PhotoPromptOptions {
  id: string;
  publicOrigin: string;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(2, Math.min(8, Math.floor(value)))
    : 4;
}

export function buildPhotoStoryPrompts(
  input: PhotoStoryPromptInput,
  options: PhotoPromptOptions
): PhotoStoryPromptResult {
  const language = normalizeLanguage(input.language);
  const origin = options.publicOrigin.replace(/\/$/, "");
  const params = new URLSearchParams({ source: "agent", starter_id: options.id });

  // The public capability intentionally does not inspect a photograph. The
  // caller may describe its general context, but no private image bytes or
  // archive identifier enter this service.
  void input.photo_context;
  void input.relationship;

  return {
    prompt_set_id: options.id,
    prompts: PHOTO_PROMPTS[language].slice(0, count(input.prompt_count)),
    capture_tip: captureTip(language),
    start_living_memory_url: `${origin}/?${params.toString()}`
  };
}
