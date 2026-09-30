type DeleteMemoryOptions = {
  readonly draftToken?: string | null;
};

export class MemoryDeletionError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

export async function deleteMemory(
  draftId: string,
  options: DeleteMemoryOptions = {}
): Promise<void> {
  const headers = new Headers({
    "X-Memories-Request": "deletion-v1"
  });
  if (options.draftToken) headers.set("X-Draft-Token", options.draftToken);

  const response = await fetch(`/resources/drafts/${encodeURIComponent(draftId)}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers
  });

  if (response.status === 404) return;
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new MemoryDeletionError(
      body.error?.message ?? "The memory could not be deleted.",
      body.error?.code ?? "delete_failed",
      response.status
    );
  }
}
