import type { OfferId } from "../features/commerce/offers";

export type CheckoutSessionResponse = {
  readonly orderId: string;
  readonly offerId: OfferId;
  readonly sessionId: string;
  readonly clientSecret: string;
  readonly amountTotal: number;
  readonly currency: string;
  readonly replayed: boolean;
};

export type EntitlementGrantResponse = {
  readonly id: string;
  readonly accountId: string;
  readonly sourceOrderId: string;
  readonly offerId: OfferId;
  readonly livingMemoryLimit: number;
  readonly voiceSecondsPerMemory: number;
  readonly memoryCircleEnabled: boolean;
  readonly familyArchiveLevel: OfferId;
  readonly grantedAt: string;
  readonly revokedAt: string | null;
};

export type CheckoutStatusResponse = {
  readonly sessionId: string;
  readonly orderId: string;
  readonly offerId: OfferId;
  readonly state: "processing" | "completed" | "failed";
  readonly orderStatus: string;
  readonly paidAt: string | null;
  readonly fulfilledAt: string | null;
  readonly entitlement: EntitlementGrantResponse | null;
};

export type AccountEntitlementsResponse = {
  readonly grants: EntitlementGrantResponse[];
  readonly effective: EntitlementGrantResponse | null;
};

type ApiErrorBody = {
  readonly error?: { readonly message?: string };
};

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & ApiErrorBody) | ApiErrorBody | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "The commerce request could not be completed.");
  }
  return body as T;
}

export async function createCheckoutSession(
  offerId: OfferId,
  attemptId: string
): Promise<CheckoutSessionResponse> {
  const response = await fetch("/api/commerce/checkout-session", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Memories-Request": "commerce-v1"
    },
    body: JSON.stringify({ offerId, attemptId })
  });
  const body = await responseJson<{ readonly checkout: CheckoutSessionResponse }>(response);
  return body.checkout;
}

export async function getCheckoutStatus(sessionId: string): Promise<CheckoutStatusResponse> {
  const response = await fetch(
    `/api/commerce/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
    { credentials: "same-origin" }
  );
  const body = await responseJson<{ readonly checkout: CheckoutStatusResponse }>(response);
  return body.checkout;
}

export async function getAccountEntitlements(): Promise<AccountEntitlementsResponse> {
  const response = await fetch("/api/entitlements", { credentials: "same-origin" });
  const body = await responseJson<{ readonly entitlements: AccountEntitlementsResponse }>(response);
  return body.entitlements;
}
