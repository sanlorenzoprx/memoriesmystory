import type { InterviewPlanResult, StoryStarterInput } from "../../domain/agent-surface";
import { buildStoryStarter, type StoryStarterOptions } from "./story-starter";
import { normalizeLanguage } from "./prompt-library";

export function buildInterviewPlan(input: StoryStarterInput, options: StoryStarterOptions): InterviewPlanResult {
  const starter = buildStoryStarter(input, options);
  const language = normalizeLanguage(input.language);
  const questions = starter.questions;
  const firstBreak = Math.max(1, Math.ceil(questions.length / 3));
  const secondBreak = Math.max(firstBreak + 1, Math.ceil((questions.length * 2) / 3));

  return {
    plan_id: options.id,
    opening: starter.opening_question,
    sections: [
      {
        title: language === "es" ? "Empezar con calma" : "Begin gently",
        questions: questions.slice(0, firstBreak)
      },
      {
        title: language === "es" ? "Seguir lo que importa" : "Follow what matters",
        questions: questions.slice(firstBreak, secondBreak)
      },
      {
        title: language === "es" ? "Lo que vale la pena conservar" : "What is worth preserving",
        questions: questions.slice(secondBreak)
      }
    ].filter(section => section.questions.length > 0),
    closing_prompt: language === "es"
      ? "Antes de terminar, ¿hay algo más de esta historia que quisieras que tu familia escuchara con tus propias palabras?"
      : "Before we finish, is there anything else about this story you would want your family to hear in your own words?",
    capture_tip: starter.capture_tip,
    start_living_memory_url: starter.start_living_memory_url
  };
}
