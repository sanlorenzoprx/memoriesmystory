import type { LocalMemoryDraft } from "../features/capture/local-draft";

type ApiErrorBody = { error?: { message?: string; code?: string } };

export class IdentityApiError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

async function responseError(response: Response): Promise<IdentityApiError> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return new IdentityApiError(
    body.error?.message ?? "The account request could not be completed.",
    body.error?.code ?? "account_request"
  );
}

export async function openAccountSession(clerkToken: string): Promise<void> {
  const response = await fetch("/resources/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Authorization: `Bearer ${clerkToken}`,
      "X-Memories-Request": "identity-v1"
    }
  });
  if (!response.ok) throw await responseError(response);
}

export async function claimLocalDraft(draft: LocalMemoryDraft): Promise<void> {
  const response = await fetch("/resources/auth/claim-draft", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Memories-Request": "identity-v1"
    },
    body: JSON.stringify({
      draftId: draft.id,
      draftToken: draft.draftToken,
      idempotencyKey: `claim_${draft.id}`,
      agreementVersion: "account-ownership-v1"
    })
  });
  if (!response.ok) throw await responseError(response);
}

export async function closeAccountSession(): Promise<void> {
  const response = await fetch("/resources/auth/sign-out", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Memories-Request": "identity-v1" }
  });
  if (!response.ok) throw await responseError(response);
}

export type ArchiveDraft = {
  readonly id: string;
  readonly status: string;
  readonly ui_locale: string;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ArchiveAsset = {
  readonly assetId: string;
  readonly draftId: string;
  readonly role: "original_photo" | "original_audio";
  readonly contentType: string;
  readonly byteSize: number;
  readonly durationMs: number | null;
  readonly sha256: string;
  readonly createdAt: string;
  readonly mediaUrl: string;
};

export async function loadArchive(): Promise<readonly ArchiveDraft[]> {
  const response = await fetch("/resources/archive/drafts", { credentials: "same-origin" });
  if (!response.ok) throw await responseError(response);
  return ((await response.json()) as { drafts: ArchiveDraft[] }).drafts;
}

export async function loadArchiveDraft(draftId: string): Promise<{
  readonly draft: ArchiveDraft;
  readonly assets: readonly ArchiveAsset[];
}> {
  const response = await fetch(`/resources/archive/drafts/${encodeURIComponent(draftId)}`, {
    credentials: "same-origin"
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<{ draft: ArchiveDraft; assets: ArchiveAsset[] }>;
}
