export class StripeWebhookError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function parseSignature(header: string): { timestamp: number; signatures: string[] } {
  const values = header.split(",").map((part) => part.trim());
  const timestampValue = values.find((part) => part.startsWith("t="))?.slice(2);
  const timestamp = Number(timestampValue);
  const signatures = values
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  if (!Number.isFinite(timestamp) || timestamp <= 0 || signatures.length === 0) {
    throw new StripeWebhookError("The Stripe signature header is invalid.", "signature_header");
  }
  return { timestamp, signatures };
}

export async function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
  nowMs = Date.now(),
  toleranceSeconds = 300
): Promise<void> {
  if (!webhookSecret || !webhookSecret.startsWith("whsec_")) {
    throw new StripeWebhookError("Stripe webhook verification is not configured.", "webhook_unconfigured");
  }
  if (!signatureHeader) {
    throw new StripeWebhookError("The Stripe signature header is missing.", "signature_missing");
  }

  const { timestamp, signatures } = parseSignature(signatureHeader);
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new StripeWebhookError("The Stripe webhook timestamp is outside the allowed window.", "signature_stale");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`)
    )
  );

  if (!signatures.some((signature) => safeEqual(signature, digest))) {
    throw new StripeWebhookError("The Stripe webhook signature is invalid.", "signature_invalid");
  }
}
