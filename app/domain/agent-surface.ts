export type AgentSurfaceLanguage = "en" | "es";
export type AgentSurfaceProtocol = "api" | "mcp" | "search" | "webmcp" | "a2a";

export interface AgentSourceContext {
  client?: string;
  protocol?: AgentSurfaceProtocol;
}

export interface StoryStarterInput {
  relationship?: string;
  occasion?: string;
  themes?: string[];
  language?: string;
  time_available_minutes?: number;
  prompt_count?: number;
  agent?: AgentSourceContext;
}

export interface PhotoStoryPromptInput {
  photo_context?: string;
  relationship?: string;
  language?: string;
  prompt_count?: number;
  agent?: AgentSourceContext;
}

export interface StoryStarterResult {
  starter_id: string;
  opening_question: string;
  questions: string[];
  photo_prompts: string[];
  follow_up_prompts: string[];
  capture_tip: string;
  start_living_memory_url: string;
}

export interface InterviewPlanResult {
  plan_id: string;
  opening: string;
  sections: Array<{ title: string; questions: string[] }>;
  closing_prompt: string;
  capture_tip: string;
  start_living_memory_url: string;
}

export interface PhotoStoryPromptResult {
  prompt_set_id: string;
  prompts: string[];
  capture_tip: string;
  start_living_memory_url: string;
}
