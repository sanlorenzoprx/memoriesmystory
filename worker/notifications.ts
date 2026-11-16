import { sendEmail, type EmailNotSentCode, type EmailProviderEnv } from "./providers/email-provider";

/**
 * Emails sent on a person's behalf (lane L2). Every message carries only a
 * link and plain instructions: never a memory's title, words, photograph, or
 * the name of anyone in it.
 */
export type NotificationEnv = EmailProviderEnv & { DB: D1Database };

export type InvitationEmailResult =
  | { status: "sent" }
  | { status: "not_sent"; code: EmailNotSentCode | "family_invitation_inactive" };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** English and Spanish together: the invitee's language is not known yet. */
export function invitationEmail(joinUrl: string, expiresAt: string, brand: string) {
  const day = expiresAt.slice(0, 10),
    english = [
      `You have been invited to see family memories in ${brand}.`,
      `Open this private link and sign in with this email address to accept: ${joinUrl}`,
      `The invitation works only for this email address. Forwarding this message gives nobody else access. It expires on ${day}.`,
      "If you were not expecting this, you can ignore it.",
    ],
    spanish = [
      `Te invitaron a ver recuerdos familiares en ${brand}.`,
      `Abre este enlace privado e inicia sesión con esta dirección de correo para aceptar: ${joinUrl}`,
      `La invitación solo funciona para esta dirección de correo. Reenviar este mensaje no le da acceso a nadie más. Vence el ${day}.`,
      "Si no la esperabas, puedes ignorarla.",
    ];
  const paragraphs = (lines: string[]) =>
    lines
      .map((line) =>
        line.includes(joinUrl)
          ? `<p>${escapeHtml(line.replace(joinUrl, "")).trimEnd()} <a href="${escapeHtml(joinUrl)}">${escapeHtml(joinUrl)}</a></p>`
          : `<p>${escapeHtml(line)}</p>`,
      )
      .join("");
  return {
    subject: `Family invitation · Invitación familiar — ${brand}`,
    text: `${english.join("\n\n")}\n\n—\n\n${spanish.join("\n\n")}\n`,
    html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:560px"><div lang="en">${paragraphs(english)}</div><hr><div lang="es">${paragraphs(spanish)}</div></body></html>`,
  };
}

/**
 * Emails a pending invitation's link to the address it was made for. The
 * invitation is re-read first: a revoked, accepted or expired one sends
 * nothing. An invitation is emailed at most once.
 */
export async function sendInvitationEmail(
  env: NotificationEnv,
  input: { grantId: string; ownerUserId: string; joinUrl: string },
): Promise<InvitationEmailResult> {
  const grant = await env.DB.prepare(
    "SELECT target_email,state,expires_at FROM family_access_grants WHERE id=? AND owner_user_id=?",
  )
    .bind(input.grantId, input.ownerUserId)
    .first<{ target_email: string; state: string; expires_at: string }>();
  if (!grant || grant.state !== "pending" || grant.expires_at <= new Date().toISOString())
    return { status: "not_sent", code: "family_invitation_inactive" };
  const already = await env.DB.prepare(
    "SELECT 1 FROM email_deliveries WHERE purpose='family_invitation' AND subject_id=? AND status='sent'",
  )
    .bind(input.grantId)
    .first();
  if (already) return { status: "sent" };
  const message = invitationEmail(input.joinUrl, grant.expires_at, env.PUBLIC_BRAND_NAME ?? "Memories: My Story");
  const outcome = await sendEmail(env, { to: grant.target_email, ...message });
  await env.DB.prepare(
    "INSERT INTO email_deliveries(id,purpose,subject_id,requested_by_user_id,status,code,provider_message_id,created_at) VALUES(?,'family_invitation',?,?,?,?,?,?)",
  )
    .bind(
      `email_${crypto.randomUUID()}`,
      input.grantId,
      input.ownerUserId,
      outcome.status,
      outcome.status === "sent" ? null : outcome.code,
      outcome.status === "sent" ? outcome.messageId : null,
      new Date().toISOString(),
    )
    .run()
    // A concurrent send already recorded this invitation as sent.
    .catch(() => undefined);
  return outcome.status === "sent" ? { status: "sent" } : { status: "not_sent", code: outcome.code };
}
