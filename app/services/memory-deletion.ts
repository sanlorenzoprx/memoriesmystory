import { removeLegacyMemoryRecordings } from "./legacy-recording-store";
import { apiMessageKey } from "../localization/errors";
type DeleteMemoryOptions = {
  readonly draftToken?: string | null;
};

export class MemoryDeletionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function deleteMemory(
  draftId: string,
  options: DeleteMemoryOptions = {},
): Promise<void> {
  const headers = new Headers({
    "X-Memories-Request": "deletion-v1",
  });
  if (options.draftToken) headers.set("X-Draft-Token", options.draftToken);

  const response = await fetch(
    `/resources/drafts/${encodeURIComponent(draftId)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
      headers,
    },
  );

  if (!response.ok && response.status !== 404) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new MemoryDeletionError(
      apiMessageKey(body.error?.code, "The memory could not be deleted."),
      body.error?.code ?? "delete_failed",
      response.status,
    );
  }
  try {
    await removeLegacyMemoryRecordings(draftId);
  } catch {
    throw new MemoryDeletionError(
      "The archive record was deleted, but device recording cleanup needs another try.",
      "local_recording_cleanup",
      503,
    );
  }
}
