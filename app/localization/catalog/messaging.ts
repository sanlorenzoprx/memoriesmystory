// L2 Messaging: Spanish interface copy and API error wording owned by this lane.
// English text is the key. Add entries here instead of editing messages.ts or
// errors.ts, so lanes working in parallel do not edit the same lines.
export const spanish: Readonly<Record<string, string>> = {
  "Also email the invitation link to this address": "Enviar también el enlace de invitación a esta dirección de correo",
  "We emailed this invitation to them.": "Le enviamos esta invitación por correo.",
  "This invitation is no longer active, so it was not emailed.":
    "Esta invitación ya no está activa, así que no se envió por correo.",
  "Email is not available yet, so nothing was emailed. Send the link below yourself.":
    "El correo todavía no está disponible, así que no se envió nada. Envía tú el enlace de abajo.",
  "Email choices": "Opciones de correo",
  "These emails are off unless you turn them on. They never include your memories' words, photographs or titles, and each one has a link to stop them.":
    "Estos correos están desactivados a menos que los actives. Nunca incluyen las palabras, fotografías ni títulos de tus recuerdos, y cada uno tiene un enlace para dejar de recibirlos.",
  "Optional emails": "Correos opcionales",
  "Email me when something new is shared with me": "Enviarme un correo cuando se comparta algo nuevo conmigo",
  "Email me an occasional reminder to add a memory": "Enviarme de vez en cuando un recordatorio para añadir un recuerdo",
  "Your email choices are saved.": "Tus opciones de correo están guardadas.",
  "How often": "Con qué frecuencia",
  "Every week": "Cada semana",
  "Every two weeks": "Cada dos semanas",
  "Once a month": "Una vez al mes",
  "Your email choices could not be saved. Please try again.": "No se pudieron guardar tus opciones de correo. Vuelve a intentarlo.",
  "Your email choices changed somewhere else. Open them again to see the latest.":
    "Tus opciones de correo cambiaron en otro lugar. Ábrelas de nuevo para ver las más recientes.",
};
export const errors: Readonly<Record<string, string>> = {
  email_preferences_conflict: "Your email choices changed somewhere else. Open them again to see the latest.",
  email_preferences_invalid: "Your email choices could not be saved. Please try again.",
};
