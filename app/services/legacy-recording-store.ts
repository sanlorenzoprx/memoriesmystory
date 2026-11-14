import type { LegacyRecordingReceipt } from "../domain/our-living-legacy";
export type LocalLegacyTake = {
  id: string;
  sessionId: string;
  memoryId: string;
  actorId: string;
  consentEpoch: number;
  startedAt: string;
  mimeType: string;
  durationMs: number;
  interrupted: boolean;
  stage: "recording" | "local" | "durable";
  receipt: LegacyRecordingReceipt | null;
};
const databaseName = "memoriesmystory-legacy",
  recordStore = "recordings",
  chunkStore = "chunks";
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(recordStore, { keyPath: "id" }).createIndex(
        "sessionId",
        "sessionId",
      );
      db.createObjectStore(chunkStore, {
        keyPath: ["recordingId", "index"],
      }).createIndex("recordingId", "recordingId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("This browser cannot keep a recoverable local draft."));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction([recordStore, chunkStore], mode);
      let value: T | undefined;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () =>
        reject(tx.error ?? new Error("Local storage was interrupted."));
      tx.onerror = () => reject(tx.error ?? new Error("Local storage failed."));
      const request = action(tx);
      if (request)
        request.onsuccess = () => {
          value = request.result;
        };
    });
  } finally {
    db.close();
  }
}
export async function storeLegacyTake(take: LocalLegacyTake) {
  await transaction("readwrite", (tx) => {
    tx.objectStore(recordStore).put(take);
  });
}
export async function storeLegacyChunk(
  take: LocalLegacyTake,
  index: number,
  blob: Blob,
) {
  await transaction("readwrite", (tx) => {
    tx.objectStore(chunkStore).put({ recordingId: take.id, index, blob });
    tx.objectStore(recordStore).put(take);
  });
}
export async function loadLegacyTakes(
  sessionId: string,
  actorId: string,
): Promise<LocalLegacyTake[]> {
  const rows = await transaction<LocalLegacyTake[]>("readonly", (tx) =>
    tx.objectStore(recordStore).index("sessionId").getAll(sessionId),
  );
  return (rows ?? [])
    .filter((x) => x.actorId === actorId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
export async function loadLegacyBlob(take: LocalLegacyTake): Promise<Blob> {
  const rows = await transaction<{ index: number; blob: Blob }[]>(
    "readonly",
    (tx) => tx.objectStore(chunkStore).index("recordingId").getAll(take.id),
  );
  return new Blob(
    (rows ?? []).sort((a, b) => a.index - b.index).map((x) => x.blob),
    { type: take.mimeType },
  );
}
export async function removeLegacyTake(id: string) {
  await transaction("readwrite", (tx) => {
    tx.objectStore(recordStore).delete(id);
    const cursor = tx
      .objectStore(chunkStore)
      .index("recordingId")
      .openCursor(id);
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (row) {
        row.delete();
        row.continue();
      }
    };
  });
}

const lockName = (id: string) => `memoriesmystory-recording-${id}`;
function requireLocks() {
  if (!navigator.locks || typeof BroadcastChannel === "undefined")
    throw new Error(
      "For recoverable conversation recording, open this page in a current browser.",
    );
}
/** The browser releases this lock on page death; a second tab may not finalize an active take. */
export async function holdLegacyTakeLock(id: string): Promise<() => void> {
  requireLocks();
  return new Promise((resolve, reject) => {
    void navigator.locks
      .request(
        lockName(id),
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock) {
            reject(
              new Error(
                "Another tab is keeping this recording. Return there or recheck after it closes.",
              ),
            );
            return;
          }
          let release!: () => void;
          const done = new Promise<void>((unlock) => {
            release = unlock;
          });
          resolve(release);
          await done;
        },
      )
      .catch(reject);
  });
}
export async function recoverLegacyTake(
  take: LocalLegacyTake,
): Promise<LocalLegacyTake | null> {
  requireLocks();
  return navigator.locks.request(
    lockName(take.id),
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock) return null;
      const current = await transaction<LocalLegacyTake>("readonly", (tx) =>
        tx.objectStore(recordStore).get(take.id),
      );
      if (!current) return null;
      if (current.stage !== "recording") return current;
      const recovered = {
        ...current,
        stage: "local" as const,
        interrupted: true,
      };
      await storeLegacyTake(recovered);
      return recovered;
    },
  );
}

export const legacyDeletionChannel = "memoriesmystory-legacy-deletion";
export async function removeLegacyMemoryRecordings(memoryId: string) {
  if (typeof indexedDB === "undefined") return;
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(legacyDeletionChannel)
      : null;
  channel?.postMessage({ memoryId });
  channel?.close();
  const takes = (
    (await transaction<LocalLegacyTake[]>("readonly", (tx) =>
      tx.objectStore(recordStore).getAll(),
    )) ?? []
  ).filter((take) => take.memoryId === memoryId);
  for (const take of takes) {
    if (navigator.locks)
      await navigator.locks.request(lockName(take.id), () =>
        removeLegacyTake(take.id),
      );
    else await removeLegacyTake(take.id);
  }
}
