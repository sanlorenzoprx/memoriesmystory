import type { StoryStarterInput, StoryStarterResult } from "../../domain/agent-surface";
import {
  PHOTO_PROMPTS,
  FOLLOW_UP,
  captureTip,
  chooseQuestions,
  normalizeLanguage,
  normalizeThemes,
  openingQuestion
} from "./prompt-library";

export interface StoryStarterOptions {
  id: string;
  publicOrigin: string;
}

function clampPromptCount(value: unknown, timeAvailable: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(3, Math.min(12, Math.floor(value)));
  }
  if (typeof timeAvailable === "number" && Number.isFinite(timeAvailable)) {
    if (timeAvailable <= 10) return 5;
    if (timeAvailable <= 20) return 8;
    return 10;
  }
  return 8;
}

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

export function buildStoryStarter(input: StoryStarterInput, options: StoryStarterOptions): StoryStarterResult {
  const language = normalizeLanguage(input.language);
  const themes = normalizeThemes(input.themes);
  const count = clampPromptCount(input.prompt_count, input.time_available_minutes);
  const origin = options.publicOrigin.replace(/\/$/, "");
  const relationship = clean(input.relationship, 80);
  const occasion = clean(input.occasion, 120);

  // Relationship and occasion are intentionally not interpolated into factual
  // statements. They are user-supplied context only; the questions remain open.
  void relationship;
  void occasion;

  const params = new URLSearchParams({ source: "agent", starter_id: options.id });
  return {
    starter_id: options.id,
    opening_question: openingQuestion(language),
    questions: chooseQuestions(language, themes, count),
    photo_prompts: PHOTO_PROMPTS[language].slice(0, Math.min(4, Math.max(2, Math.ceil(count / 3)))),
    follow_up_prompts: FOLLOW_UP[language],
    capture_tip: captureTip(language),
    start_living_memory_url: `${origin}/?${params.toString()}`
  };
}
