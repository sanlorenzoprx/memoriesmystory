// L6 Muse: Spanish interface copy for Muse surfaces added from decision
// 2026-11-16 (Talk with Muse). English text is the key.
export const spanish: Readonly<Record<string, string>> = {
  "Help from a real person": "Ayuda de una persona real",
  "Call {number}": "Llamar al {number}",
  "Text {number}": "Enviar texto al {number}",
  "Find a helpline": "Buscar una línea de ayuda",
  "Emergency: call {number}": "Emergencia: llama al {number}",
  "Where you left off": "Donde lo dejaste",
  "You have 1 memory you haven't finished.": "Tienes 1 recuerdo sin terminar.",
  "You have {count} memories you haven't finished.": "Tienes {count} recuerdos sin terminar.",
  "Pick up where you left off": "Continúa donde lo dejaste",
  "What Muse remembers": "Lo que Muse recuerda",
  "Muse remembers only what you confirmed in your own words, so it can ask whether a new photograph connects to an old story. Nothing here is shared. Asking Muse to forget never changes your memory.":
    "Muse solo recuerda lo que confirmaste con tus propias palabras, para poder preguntarte si una fotografía nueva se conecta con una historia anterior. Nada de esto se comparte. Pedirle a Muse que olvide nunca cambia tu recuerdo.",
  People: "Personas",
  Places: "Lugares",
  Times: "Épocas",
  Moments: "Momentos",
  "About: {value}": "Aproximadamente: {value}",
  "from {title}": "de {title}",
  "from a Living Memory": "de un Recuerdo Vivo",
  "Ask Muse to forget {value}": "Pedir a Muse que olvide {value}",
  "Let Muse remember {value}": "Dejar que Muse recuerde {value}",
  "Muse won't bring this up.": "Muse no lo mencionará.",
  "Muse's memory could not be opened. Please try again.": "No se pudo abrir la memoria de Muse. Inténtalo de nuevo.",
  "Muse could not change what it remembers. Please try again.": "Muse no pudo cambiar lo que recuerda. Inténtalo de nuevo.",
  "That is no longer in Muse's memory.": "Eso ya no está en la memoria de Muse.",
};
export const errors: Readonly<Record<string, string>> = {
  muse_memory_invalid: "Muse could not change what it remembers. Please try again.",
  muse_memory_not_found: "That is no longer in Muse's memory.",
};
