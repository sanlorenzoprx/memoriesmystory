import type {
  CaptureEntryMode,
  LocalMemoryDraft
} from "../features/capture/local-draft";
import { createLocalDraft } from "../features/capture/local-draft";

const databaseName = "memoriesmystory-local";
const databaseVersion = 1;
const draftStoreName = "memory-story-drafts";

export function makeDraftToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeDraft(value: LocalMemoryDraft): LocalMemoryDraft {
  if (value.version === 2 && value.draftToken) return value;

  const legacy = value as LocalMemoryDraft & {
    readonly version: number;
    readonly draftToken?: string;
  };
  return {
    ...legacy,
    draftToken: legacy.draftToken ?? makeDraftToken(),
    photoUpload: legacy.photo ? {
      assetId: `asset_${crypto.randomUUID()}`,
      idempotencyKey: `upload_${crypto.randomUUID()}`,
      status: "local",
      receipt: null,
      lastError: null
    } : null,
    audio: null,
    audioUpload: null,
    version: 2
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("Local storage request failed.")),
      { once: true }
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("Local storage was interrupted.")),
      { once: true }
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("Local storage failed.")),
      { once: true }
    );
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(
      new Error("This browser cannot keep a recoverable local draft.")
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(draftStoreName)) {
        database.createObjectStore(draftStoreName, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result), {
      once: true
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("Local draft storage could not open.")),
      { once: true }
    );
  });
}

export async function loadLocalDraft(
  draftId: string
): Promise<LocalMemoryDraft | null> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(draftStoreName, "readonly");
    const result = await requestResult(
      transaction.objectStore(draftStoreName).get(draftId)
    );
    const draft = (result as LocalMemoryDraft | undefined) ?? null;
    if (!draft) return null;
    const normalized = normalizeDraft(draft);
    if (normalized !== draft) await saveLocalDraft(normalized);
    return normalized;
  } finally {
    database.close();
  }
}

export async function saveLocalDraft(draft: LocalMemoryDraft): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(draftStoreName, "readwrite");
    transaction.objectStore(draftStoreName).put(draft);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export function makeLocalDraftId(): string {
  return `local_${crypto.randomUUID()}`;
}

export async function beginLocalDraft(
  entryMode: CaptureEntryMode,
  locale: string
): Promise<LocalMemoryDraft> {
  const draft = createLocalDraft({
    id: makeLocalDraftId(),
    entryMode,
    locale,
    draftToken: makeDraftToken()
  });

  await saveLocalDraft(draft);
  return draft;
}
