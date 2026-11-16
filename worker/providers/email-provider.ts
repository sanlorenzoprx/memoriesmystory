/**
 * Cloudflare Email Service adapter (lane L2).
 *
 * Fails closed: nothing is sent unless sending is switched on
 * (`EMAIL_SENDING_ENABLED` = "true"), a sender address is configured and the
 * `EMAIL` send binding exists. Each refusal returns a stable code. Addresses,
 * subjects and bodies are never logged.
 *
 * Sending stays off until the owner onboards a sending domain (input O2) and
 * approves wording and cadence (decision D6).
 */
export type EmailSendBinding = {
  send(message: {
    from: string | { email: string; name?: string };
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId?: string }>;
};

export interface EmailProviderEnv {
  EMAIL?: EmailSendBinding;
  EMAIL_SENDING_ENABLED?: string;
  EMAIL_FROM_ADDRESS?: string;
  PUBLIC_BRAND_NAME?: string;
}

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

export type EmailNotSentCode =
  | "email_sending_off"
  | "email_sender_unconfigured"
  | "email_binding_missing"
  | "email_recipient_invalid"
  | "email_provider_failed";

export type EmailSendOutcome =
  | { status: "sent"; messageId: string | null }
  | { status: "not_sent"; code: EmailNotSentCode };

const address = /^[^\s@<>"]{1,64}@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

/** Whether this deployment can send at all; used to describe the choice honestly. */
export function emailSendingReady(env: EmailProviderEnv): EmailSendOutcome | null {
  if (env.EMAIL_SENDING_ENABLED !== "true")
    return { status: "not_sent", code: "email_sending_off" };
  if (!env.EMAIL_FROM_ADDRESS || !address.test(env.EMAIL_FROM_ADDRESS))
    return { status: "not_sent", code: "email_sender_unconfigured" };
  if (!env.EMAIL) return { status: "not_sent", code: "email_binding_missing" };
  return null;
}

export async function sendEmail(
  env: EmailProviderEnv,
  message: OutboundEmail,
): Promise<EmailSendOutcome> {
  const refused = emailSendingReady(env);
  if (refused) return refused;
  if (message.to.length > 254 || !address.test(message.to))
    return { status: "not_sent", code: "email_recipient_invalid" };
  try {
    const result = await env.EMAIL!.send({
      from: { email: env.EMAIL_FROM_ADDRESS!, name: env.PUBLIC_BRAND_NAME ?? "Memories: My Story" },
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.headers ? { headers: message.headers } : {}),
    });
    return {
      status: "sent",
      messageId: typeof result?.messageId === "string" ? result.messageId.slice(0, 200) : null,
    };
  } catch (error) {
    // Error type only: provider messages can echo the recipient address.
    console.error("Email provider refused a message", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return { status: "not_sent", code: "email_provider_failed" };
  }
}
