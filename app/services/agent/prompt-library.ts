import type { AgentSurfaceLanguage } from "../../domain/agent-surface";

export type PromptTheme =
  | "childhood"
  | "family-traditions"
  | "old-photographs"
  | "recipes"
  | "migration"
  | "service"
  | "love"
  | "work"
  | "homes-places"
  | "holidays-reunions"
  | "legacy";

const THEME_ALIASES: Record<string, PromptTheme> = {
  childhood: "childhood",
  family: "family-traditions",
  tradition: "family-traditions",
  traditions: "family-traditions",
  "family traditions": "family-traditions",
  photo: "old-photographs",
  photos: "old-photographs",
  photograph: "old-photographs",
  photographs: "old-photographs",
  "old photographs": "old-photographs",
  recipe: "recipes",
  recipes: "recipes",
  food: "recipes",
  migration: "migration",
  immigration: "migration",
  move: "migration",
  military: "service",
  service: "service",
  love: "love",
  marriage: "love",
  wedding: "love",
  work: "work",
  career: "work",
  job: "work",
  home: "homes-places",
  homes: "homes-places",
  place: "homes-places",
  places: "homes-places",
  holiday: "holidays-reunions",
  holidays: "holidays-reunions",
  reunion: "holidays-reunions",
  reunions: "holidays-reunions",
  legacy: "legacy"
};

const GENERAL: Record<AgentSurfaceLanguage, string[]> = {
  en: [
    "What is one memory you would want your family to hear in your own voice?",
    "When you think back to that time, what comes back first?",
    "Who was part of that memory, and what do you remember about being together?",
    "What small detail from that time still feels vivid to you?",
    "What would you want someone younger in the family to understand about that part of your life?",
    "Is there a story your family has heard before that you would like to tell in your own words?"
  ],
  es: [
    "¿Cuál es un recuerdo que te gustaría que tu familia escuchara con tu propia voz?",
    "Cuando piensas en esa época, ¿qué es lo primero que vuelve a tu memoria?",
    "¿Quiénes formaban parte de ese recuerdo y qué recuerdas de estar juntos?",
    "¿Qué pequeño detalle de aquella época todavía recuerdas con claridad?",
    "¿Qué te gustaría que alguien más joven de la familia entendiera sobre esa etapa de tu vida?",
    "¿Hay una historia que tu familia ya haya escuchado y que te gustaría contar con tus propias palabras?"
  ]
};

const THEMES: Record<PromptTheme, Record<AgentSurfaceLanguage, string[]>> = {
  childhood: {
    en: [
      "What did an ordinary day look like when you were a child?",
      "Where did you spend the most time growing up, and what do you remember about that place?",
      "Who made you feel safe or understood when you were young?",
      "What did you do for fun that children today might not know about?"
    ],
    es: [
      "¿Cómo era un día común cuando eras niño o niña?",
      "¿Dónde pasabas más tiempo mientras crecías y qué recuerdas de ese lugar?",
      "¿Quién te hacía sentir seguro, segura o comprendido cuando eras joven?",
      "¿Qué hacías para divertirte que quizás los niños de hoy no conozcan?"
    ]
  },
  "family-traditions": {
    en: [
      "What family tradition do you remember looking forward to?",
      "Who usually made that tradition happen?",
      "Was there a saying, song, ritual, or habit that made it feel like your family's?",
      "How has that tradition changed over time?"
    ],
    es: [
      "¿Qué tradición familiar recuerdas esperar con ilusión?",
      "¿Quién solía hacer posible esa tradición?",
      "¿Había algún dicho, canción, ritual o costumbre que la hacía sentir propia de tu familia?",
      "¿Cómo ha cambiado esa tradición con el tiempo?"
    ]
  },
  "old-photographs": {
    en: [
      "What do you remember most when you look at an old family photograph?",
      "What was happening just before or just after a photograph you remember well?",
      "Who in the photograph would you want a future family member to know more about?",
      "What might someone miss if they only saw the photograph and never heard the story?"
    ],
    es: [
      "¿Qué recuerdas más cuando miras una fotografía antigua de la familia?",
      "¿Qué estaba pasando justo antes o justo después de una fotografía que recuerdas bien?",
      "¿Sobre quién en la fotografía te gustaría que un familiar del futuro supiera más?",
      "¿Qué podría perderse si alguien solo viera la fotografía y nunca escuchara la historia?"
    ]
  },
  recipes: {
    en: [
      "What family dish carries a story for you?",
      "Who taught you how that dish was made?",
      "What do you remember about the kitchen, table, or people around that food?",
      "Was anything measured by feel rather than written down?"
    ],
    es: [
      "¿Qué plato familiar lleva una historia contigo?",
      "¿Quién te enseñó a preparar ese plato?",
      "¿Qué recuerdas de la cocina, la mesa o las personas alrededor de esa comida?",
      "¿Había algo que se medía a ojo o al gusto en vez de seguir una receta escrita?"
    ]
  },
  migration: {
    en: [
      "What do you remember about leaving one place and arriving somewhere new?",
      "What did you bring with you that mattered most?",
      "Who helped you feel at home after the move?",
      "What did you miss, and what surprised you about the new place?"
    ],
    es: [
      "¿Qué recuerdas de dejar un lugar y llegar a otro nuevo?",
      "¿Qué llevaste contigo que era especialmente importante?",
      "¿Quién te ayudó a sentirte en casa después de la mudanza?",
      "¿Qué extrañabas y qué te sorprendió del nuevo lugar?"
    ]
  },
  service: {
    en: [
      "What do you remember about the people you served or worked beside?",
      "Was there a day from that period that changed how you saw yourself or the world?",
      "What part of that experience is hardest to explain to someone who was not there?",
      "What would you want your family to understand about that chapter of your life?"
    ],
    es: [
      "¿Qué recuerdas de las personas con quienes serviste o trabajaste?",
      "¿Hubo un día de esa etapa que cambió la forma en que te veías a ti mismo o al mundo?",
      "¿Qué parte de esa experiencia es más difícil de explicar a alguien que no estuvo allí?",
      "¿Qué te gustaría que tu familia entendiera sobre ese capítulo de tu vida?"
    ]
  },
  love: {
    en: [
      "What do you remember about first getting to know someone you loved?",
      "What small moment told you that the relationship mattered?",
      "What did you enjoy doing together in the early years?",
      "What would you want your family to remember about that relationship?"
    ],
    es: [
      "¿Qué recuerdas de cuando empezaste a conocer a alguien que amabas?",
      "¿Qué pequeño momento te hizo sentir que esa relación era importante?",
      "¿Qué disfrutaban hacer juntos en los primeros años?",
      "¿Qué te gustaría que tu familia recordara sobre esa relación?"
    ]
  },
  work: {
    en: [
      "What was your first job, and what do you remember about your first days there?",
      "Who taught you something at work that stayed with you?",
      "What part of your work made you proud?",
      "What changed most in your work over the years?"
    ],
    es: [
      "¿Cuál fue tu primer trabajo y qué recuerdas de tus primeros días allí?",
      "¿Quién te enseñó algo en el trabajo que todavía recuerdas?",
      "¿Qué parte de tu trabajo te hacía sentir orgulloso u orgullosa?",
      "¿Qué fue lo que más cambió en tu trabajo con los años?"
    ]
  },
  "homes-places": {
    en: [
      "What place still feels like home when you picture it?",
      "What could you see, hear, or smell there?",
      "Who usually gathered in that place?",
      "What happened there that you would not want your family to forget?"
    ],
    es: [
      "¿Qué lugar todavía se siente como hogar cuando lo imaginas?",
      "¿Qué podías ver, escuchar u oler allí?",
      "¿Quiénes solían reunirse en ese lugar?",
      "¿Qué pasó allí que no quisieras que tu familia olvidara?"
    ]
  },
  "holidays-reunions": {
    en: [
      "What family gathering do you remember most clearly?",
      "Who was always there, and what were they like in those gatherings?",
      "What food, music, joke, or ritual made the gathering feel familiar?",
      "Is there a moment from one gathering that still makes you smile?"
    ],
    es: [
      "¿Qué reunión familiar recuerdas con más claridad?",
      "¿Quién siempre estaba allí y cómo era durante esas reuniones?",
      "¿Qué comida, música, broma o ritual hacía que la reunión se sintiera familiar?",
      "¿Hay algún momento de una reunión que todavía te haga sonreír?"
    ]
  },
  legacy: {
    en: [
      "What lesson did life teach you that you hope your family carries forward?",
      "What part of your story do you think your family understands least?",
      "Who shaped the person you became?",
      "What would you want a great-grandchild to hear directly from you?"
    ],
    es: [
      "¿Qué lección te enseñó la vida que esperas que tu familia lleve hacia el futuro?",
      "¿Qué parte de tu historia crees que tu familia conoce menos?",
      "¿Quién influyó en la persona que llegaste a ser?",
      "¿Qué te gustaría que un bisnieto o bisnieta pudiera escuchar directamente de ti?"
    ]
  }
};

export const FOLLOW_UP: Record<AgentSurfaceLanguage, string[]> = {
  en: [
    "Take your time. What else comes back to you?",
    "What do you remember about how that felt at the time?",
    "Is there a detail you would want your family not to lose?"
  ],
  es: [
    "Tómate tu tiempo. ¿Qué más vuelve a tu memoria?",
    "¿Qué recuerdas de cómo se sentía eso en aquel momento?",
    "¿Hay algún detalle que no quisieras que tu familia perdiera?"
  ]
};

export const PHOTO_PROMPTS: Record<AgentSurfaceLanguage, string[]> = {
  en: [
    "Who is in this photograph, as you remember it?",
    "What was happening around the moment this photograph was taken?",
    "Where were you, if you remember?",
    "What does this photograph bring back that the picture alone cannot show?"
  ],
  es: [
    "¿Quién aparece en esta fotografía, según lo recuerdas?",
    "¿Qué estaba pasando alrededor del momento en que se tomó esta fotografía?",
    "¿Dónde estaban, si lo recuerdas?",
    "¿Qué te hace recordar esta fotografía que la imagen por sí sola no puede mostrar?"
  ]
};

export function normalizeLanguage(value: unknown): AgentSurfaceLanguage {
  if (typeof value !== "string") return "en";
  return value.toLowerCase().startsWith("es") ? "es" : "en";
}

export function normalizeThemes(values: unknown): PromptTheme[] {
  if (!Array.isArray(values)) return [];
  const themes: PromptTheme[] = [];
  for (const raw of values.slice(0, 6)) {
    if (typeof raw !== "string") continue;
    const normalized = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const theme = THEME_ALIASES[normalized];
    if (theme && !themes.includes(theme)) themes.push(theme);
  }
  return themes;
}

export function chooseQuestions(language: AgentSurfaceLanguage, themes: PromptTheme[], count: number): string[] {
  const pool: string[] = [];
  for (const theme of themes) pool.push(...THEMES[theme][language]);
  pool.push(...GENERAL[language]);
  return [...new Set(pool)].slice(0, count);
}

export function openingQuestion(language: AgentSurfaceLanguage): string {
  return language === "es"
    ? "¿Qué recuerdo te gustaría empezar a preservar hoy?"
    : "What memory would you like to begin preserving today?";
}

export function captureTip(language: AgentSurfaceLanguage): string {
  return language === "es"
    ? "Haz una pregunta a la vez, deja espacio para las pausas y, cuando estén listos, conserva la historia con su voz real."
    : "Ask one question at a time, leave room for pauses, and when they are ready preserve the story with their real voice.";
}
