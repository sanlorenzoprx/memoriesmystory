import type { PeopleRecord } from "../domain/family-people";
import { apiMessageKey } from "../localization/errors";
export async function peopleRequest<T>(
  archiveId: string,
  path = "",
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(
    `/resources/family-people${path}?archiveId=${encodeURIComponent(archiveId)}`,
    {
      method,
      credentials: "same-origin",
      headers: {
        "X-Memories-Request": "family-v1",
        "Content-Type": "application/json",
        ...(key ? { "X-Idempotency-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const value = (await response.json().catch(() => null)) as {
    error?: { code?: string };
    id?: string;
    version?: number;
    records?: PeopleRecord[];
    record?: PeopleRecord;
  } | null;
  if (!response.ok)
    throw new Error(
      apiMessageKey(
        value?.error?.code,
        "People could not be opened. Please try again.",
      ),
    );
  if (
    !value ||
    typeof value !== "object" ||
    (method !== "GET" &&
      (typeof value.id !== "string" ||
        !/^[A-Za-z0-9_-]{8,120}$/.test(value.id) ||
        !Number.isSafeInteger(value.version) ||
        Number(value.version) < 1)) ||
    (method === "GET" &&
      (!value.record ||
        typeof value.record.id !== "string" ||
        !Number.isSafeInteger(value.record.version) ||
        !value.record.document ||
        typeof value.record.document !== "object"))
  )
    throw new Error("People could not be opened. Please try again.");
  return value as T;
}
export async function loadPeople(archiveId: string, after?: string) {
  // Page cursor is bounded and encoded; the server retains archive ownership checks.
  const response = await fetch(
    `/resources/family-people?archiveId=${encodeURIComponent(archiveId)}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    { credentials: "same-origin" },
  );
  const value = (await response.json().catch(() => null)) as {
    error?: { code?: string };
    id?: string;
    version?: number;
    records?: PeopleRecord[];
  } | null;
  if (!response.ok || !Array.isArray(value?.records))
    throw new Error("People could not be opened. Please try again.");
  return value as { records: PeopleRecord[]; nextCursor: string | null };
}

export type PersonAlbum = {
  person: { id: string; label: string; active: boolean };
  memories: { id: string; title: string | null; photoUrl: string | null }[];
};

/** The memories a human linked to one person. Nothing is matched by face, voice or name. */
export async function loadPersonAlbum(
  archiveId: string,
  personId: string,
): Promise<PersonAlbum> {
  const fallback = "This person's album could not be opened. Please try again.";
  let response: Response;
  try {
    response = await fetch(
      `/resources/family-people/person/${encodeURIComponent(personId)}/memories?archiveId=${encodeURIComponent(archiveId)}`,
      { credentials: "same-origin" },
    );
  } catch (error) {
    throw new Error(fallback, { cause: error });
  }
  const value = (await response.json().catch(() => null)) as
    | (Partial<PersonAlbum> & { error?: { code?: string } })
    | null;
  if (!response.ok) throw new Error(apiMessageKey(value?.error?.code, fallback));
  if (!value?.person || !Array.isArray(value.memories)) throw new Error(fallback);
  return value as PersonAlbum;
}

