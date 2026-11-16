/**
 * Unsent family-contribution media kept on this device (lane L1.3): a voice
 * recording or a photograph a relative has chosen but not yet sent. It
 * survives a reload or a language switch, and keeps its request key so a send
 * after a reload still cannot be stored twice. Removed after a confirmed send,
 * when the person discards it, or when the memory is deleted.
 */
export type UnsentContributionMedia = {
  /** `${draft scope key}:voice` or `${draft scope key}:photo`. */
  key: string;
  memoryId: string;
  kind: "voice" | "photo";
  media: unknown;
  requestKey: string | null;
};

const databaseName = "memoriesmystory-contributions",
  store = "unsent";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(store, { keyPath: "key" }).createIndex("memoryId", "memoryId");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("This browser cannot keep an unsent item."));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (objects: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      let value: T | undefined;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error("Local storage was interrupted."));
      tx.onerror = () => reject(tx.error ?? new Error("Local storage failed."));
      const request = work(tx.objectStore(store));
      if (request)
        request.onsuccess = () => {
          value = request.result;
        };
    });
  } finally {
    db.close();
  }
}

export async function keepUnsentMedia(entry: UnsentContributionMedia) {
  await run("readwrite", (objects) => {
    objects.put(entry);
  });
}

export async function loadUnsentMedia(key: string): Promise<UnsentContributionMedia | null> {
  return (await run<UnsentContributionMedia>("readonly", (objects) => objects.get(key))) ?? null;
}

export async function removeUnsentMedia(key: string) {
  await run("readwrite", (objects) => {
    objects.delete(key);
  });
}

/** After a confirmed whole-memory deletion: every unsent item for that memory. */
export async function removeUnsentMediaForMemory(memoryId: string) {
  if (typeof indexedDB === "undefined") return;
  await run("readwrite", (objects) => {
    const cursor = objects.index("memoryId").openCursor(memoryId);
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (row) {
        row.delete();
        row.continue();
      }
    };
  });
}
