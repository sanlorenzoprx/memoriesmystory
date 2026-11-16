// L4 Growth: Spanish interface copy and API error wording owned by this lane.
// English text is the key. Add entries here instead of editing messages.ts or
// errors.ts, so lanes working in parallel do not edit the same lines.
export const spanish: Readonly<Record<string, string>> = {
  "Send on WhatsApp": "Enviar por WhatsApp",
  "A photograph from one of your Living Memories": "Una fotografía de uno de tus Recuerdos Vivos",
  "Show one of my photographs when I open the app": "Mostrar una de mis fotografías al abrir la aplicación",
  "How you want to share": "Cómo quieres compartir",
  "You choose this once. We save your choice and will not ask again.": "Lo eliges una vez. Guardamos tu elección y no volveremos a preguntar.",
  "Friends and family: I can send links to my memories to the people I choose. Anyone who receives a link can open it and keep a copy.":
    "Familia y amistades: puedo enviar enlaces de mis recuerdos a las personas que elija. Quien reciba un enlace puede abrirlo y guardar una copia.",
  "Public: I can also post links where anyone may see them, for example on Facebook.":
    "Público: también puedo publicar enlaces donde cualquiera pueda verlos, por ejemplo en Facebook.",
  "I agree": "Acepto",
  "Also allow public sharing": "Permitir también compartir en público",
  "Your sharing choice could not be saved. Please try again.": "No se pudo guardar tu elección para compartir. Vuelve a intentarlo.",
  "Choose how you want to share once, then create your link.": "Elige una vez cómo quieres compartir y luego crea tu enlace.",
  "Create your own Living Memory": "Crea tu propio Recuerdo Vivo",
  "Share on Facebook": "Compartir en Facebook",
};
export const errors: Readonly<Record<string, string>> = {
  share_agreement_required: "Choose how you want to share once, then create your link.",
  share_agreement_invalid: "Your sharing choice could not be saved. Please try again.",
};
