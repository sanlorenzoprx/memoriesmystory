import { emailSendingReady, sendEmail, type EmailNotSentCode, type EmailProviderEnv } from "./providers/email-provider";
import { unsubscribeToken } from "./email-preferences";

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

/** The unsubscribe and app links need the public origin when no request is at hand. */
export type FamilyUpdateEnv = NotificationEnv & { SESSION_SECRET?: string; PUBLIC_APP_ORIGIN?: string };

export function familyUpdateEmail(familyUrl: string, unsubscribeUrl: string, brand: string) {
  const english = [
      `Something new was shared with you in ${brand}.`,
      `Open your family memories: ${familyUrl}`,
      `You get this email because you asked for it. To stop these emails: ${unsubscribeUrl}`,
    ],
    spanish = [
      `Se compartió algo nuevo contigo en ${brand}.`,
      `Abre tus recuerdos familiares: ${familyUrl}`,
      `Recibes este correo porque lo pediste. Para dejar de recibirlos: ${unsubscribeUrl}`,
    ];
  const paragraphs = (lines: string[]) =>
    lines
      .map((line) => {
        const url = [familyUrl, unsubscribeUrl].find((candidate) => line.endsWith(candidate));
        return url
          ? `<p>${escapeHtml(line.slice(0, -url.length)).trimEnd()} <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`
          : `<p>${escapeHtml(line)}</p>`;
      })
      .join("");
  return {
    subject: `Something new is waiting · Algo nuevo te espera — ${brand}`,
    text: `${english.join("\n\n")}\n\n—\n\n${spanish.join("\n\n")}\n`,
    html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:560px"><div lang="en">${paragraphs(english)}</div><hr><div lang="es">${paragraphs(spanish)}</div></body></html>`,
  };
}

/**
 * Invited relatives who asked for family updates and have something new in
 * their shared scope since their last notice (and since they accepted):
 * a memory the owner placed in a shared Chapter, or someone else's
 * recollection the owner included for family.
 */
const membersWithNews = `
WITH g AS (
 SELECT fg.accepted_by_user_id AS member,fg.owner_user_id AS owner,fg.archive_id,fg.scope_kind,fg.scope_id,
  max(fg.accepted_at,COALESCE((SELECT max(n.created_at) FROM family_update_notices n WHERE n.member_user_id=fg.accepted_by_user_id AND n.status='sent'),'')) AS since
 FROM family_access_grants fg
 JOIN email_preferences p ON p.user_id=fg.accepted_by_user_id AND p.family_updates=1
 WHERE fg.state='accepted'
)
SELECT DISTINCT g.member FROM g
WHERE NOT EXISTS(SELECT 1 FROM family_update_notices n WHERE n.member_user_id=g.member AND n.sent_on=?1 AND n.status='sent')
AND (
 (g.scope_kind<>'memory' AND EXISTS(
  SELECT 1 FROM family_chapter_memories cm JOIN family_chapters c ON c.id=cm.chapter_id
  JOIN memory_stories m ON m.id=cm.memory_story_id AND m.status='complete' AND m.owner_user_id=g.owner
  WHERE c.archive_id=g.archive_id AND (g.scope_kind='archive' OR c.id=g.scope_id) AND cm.created_at>g.since))
 OR EXISTS(
  SELECT 1 FROM family_contribution_events e JOIN family_contributions fc ON fc.id=e.contribution_id
  WHERE e.action='included' AND e.created_at>g.since AND fc.owner_user_id=g.owner AND fc.author_user_id<>g.member
   AND fc.author_state='submitted' AND fc.included_revision_id IS NOT NULL
   AND ((g.scope_kind='memory' AND fc.memory_story_id=g.scope_id) OR (g.scope_kind<>'memory' AND EXISTS(
    SELECT 1 FROM family_chapter_memories cm2 JOIN family_chapters c2 ON c2.id=cm2.chapter_id
    WHERE cm2.memory_story_id=fc.memory_story_id AND c2.archive_id=g.archive_id AND (g.scope_kind='archive' OR c2.id=g.scope_id)))))
)
LIMIT ?2`;

export type FamilyUpdatePassResult = { skipped: string | null; sent: number; notSent: number };

/** A daily pass. Sends nothing, and records nothing, while email is unavailable. */
export async function runFamilyUpdatePass(
  env: FamilyUpdateEnv,
  options: { now?: Date; limit?: number } = {},
): Promise<FamilyUpdatePassResult> {
  const refused = emailSendingReady(env);
  if (refused && refused.status === "not_sent") return { skipped: refused.code, sent: 0, notSent: 0 };
  if (!env.SESSION_SECRET || !env.PUBLIC_APP_ORIGIN || !/^https:\/\/[^/]+$/.test(env.PUBLIC_APP_ORIGIN))
    return { skipped: "email_links_unconfigured", sent: 0, notSent: 0 };
  const now = options.now ?? new Date(),
    today = now.toISOString().slice(0, 10),
    brand = env.PUBLIC_BRAND_NAME ?? "Memories: My Story";
  const { results } = await env.DB.prepare(membersWithNews)
    .bind(today, options.limit ?? 200)
    .all<{ member: string }>();
  const result: FamilyUpdatePassResult = { skipped: null, sent: 0, notSent: 0 };
  for (const { member } of results) {
    const user = await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(member).first<{ email: string | null }>();
    let outcome: Awaited<ReturnType<typeof sendEmail>>;
    if (!user?.email) outcome = { status: "not_sent", code: "email_recipient_invalid" };
    else {
      const unsubscribeUrl = `${env.PUBLIC_APP_ORIGIN}/resources/email/unsubscribe?t=${encodeURIComponent(await unsubscribeToken(env.SESSION_SECRET, member, "family_updates"))}`,
        message = familyUpdateEmail(`${env.PUBLIC_APP_ORIGIN}/family`, unsubscribeUrl, brand);
      outcome = await sendEmail(env, {
        to: user.email,
        ...message,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
    }
    await env.DB.prepare(
      "INSERT INTO family_update_notices(id,member_user_id,sent_on,status,code,created_at) VALUES(?,?,?,?,?,?)",
    )
      .bind(`notice_${crypto.randomUUID()}`, member, today, outcome.status, outcome.status === "sent" ? null : outcome.code, now.toISOString())
      .run()
      .catch(() => undefined);
    if (outcome.status === "sent") result.sent++;
    else result.notSent++;
  }
  return result;
}
