/**
 * Outbound email (lane L2). Provider order by owner decision 2026-11-16:
 * Resend first (`RESEND_API_KEY`, a Worker secret), then Cloudflare Email
 * Service (the `EMAIL` send binding) when Resend is not configured or fails.
 *
 * Fails closed: nothing is sent unless sending is switched on
 * (`EMAIL_SENDING_ENABLED` = "true"), a sender address is configured and at
 * least one provider is available. Each refusal returns a stable code.
 * Addresses, subjects and bodies are never logged.
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
  RESEND_API_KEY?: string;
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
  | "email_provider_missing"
  | "email_recipient_invalid"
  | "email_provider_failed";

export type EmailSendOutcome =
  | { status: "sent"; messageId: string | null; provider?: "resend" | "cloudflare" }
  | { status: "not_sent"; code: EmailNotSentCode };

const address = /^[^\s@<>"]{1,64}@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

/** Whether this deployment can send at all; used to describe the choice honestly. */
export function emailSendingReady(env: EmailProviderEnv): EmailSendOutcome | null {
  if (env.EMAIL_SENDING_ENABLED !== "true")
    return { status: "not_sent", code: "email_sending_off" };
  if (!env.EMAIL_FROM_ADDRESS || !address.test(env.EMAIL_FROM_ADDRESS))
    return { status: "not_sent", code: "email_sender_unconfigured" };
  if (!env.RESEND_API_KEY && !env.EMAIL) return { status: "not_sent", code: "email_provider_missing" };
  return null;
}

async function sendWithResend(
  env: EmailProviderEnv,
  message: OutboundEmail,
  idempotencyKey: string | undefined,
): Promise<{ messageId: string | null }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Resend keeps a key for 24 hours, so a retried send is not delivered twice.
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: `${env.PUBLIC_BRAND_NAME ?? "Memories: My Story"} <${env.EMAIL_FROM_ADDRESS}>`,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.headers ? { headers: message.headers } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
  const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return { messageId: typeof body?.id === "string" ? body.id.slice(0, 200) : null };
}

export async function sendEmail(
  env: EmailProviderEnv,
  message: OutboundEmail,
  options: { idempotencyKey?: string } = {},
): Promise<EmailSendOutcome> {
  const refused = emailSendingReady(env);
  if (refused) return refused;
  if (message.to.length > 254 || !address.test(message.to))
    return { status: "not_sent", code: "email_recipient_invalid" };
  if (env.RESEND_API_KEY) {
    try {
      const result = await sendWithResend(env, message, options.idempotencyKey);
      return { status: "sent", messageId: result.messageId, provider: "resend" };
    } catch (error) {
      // Status code only: provider messages can echo the recipient address.
      console.error("Email provider refused a message", {
        provider: "resend",
        errorType: error instanceof Error ? error.message.replace(/[^a-z0-9_]/gi, "").slice(0, 40) : "unknown",
      });
      if (!env.EMAIL) return { status: "not_sent", code: "email_provider_failed" };
    }
  }
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
      provider: "cloudflare",
    };
  } catch (error) {
    console.error("Email provider refused a message", {
      provider: "cloudflare",
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return { status: "not_sent", code: "email_provider_failed" };
  }
}
