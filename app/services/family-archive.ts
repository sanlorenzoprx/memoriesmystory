import { apiMessageKey } from "../localization/errors";
import type {
  FamilyArchiveIndex,
  FamilyChapter,
  FamilyMemory,
} from "../domain/family-archive";
export async function familyRequest<T>(
  path = "",
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(`/resources/family-archives${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(method !== "GET" ? { "X-Memories-Request": "family-v1" } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "X-Idempotency-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string };
    id?: unknown;
    version?: unknown;
    archives?: unknown;
    chapters?: unknown;
    memories?: unknown;
  };
  if (!response.ok)
    throw new Error(
      apiMessageKey(
        value?.error?.code,
        "Your private Chapters could not be opened. Please try again.",
      ),
    );
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (method !== "GET" &&
      (typeof value.id !== "string" ||
        !/^[A-Za-z0-9_-]{8,120}$/.test(value.id) ||
        !Number.isSafeInteger(value.version) ||
        Number(value.version) < 1)) ||
    (method === "GET" &&
      (!path || path.startsWith("?")) &&
      (!Array.isArray(value.archives) ||
        !Array.isArray(value.chapters) ||
        !Array.isArray(value.memories)))
  )
    throw new Error(
      "Your private Chapters could not be opened. Please try again.",
    );
  return value as T;
}
export const loadFamilyArchive = (
  archiveId?: string,
  after?: string,
  afterChapter?: string,
) => {
  const params = new URLSearchParams();
  if (archiveId) params.set("archiveId", archiveId);
  if (after) params.set("after", after);
  if (afterChapter) params.set("afterChapter", afterChapter);
  return familyRequest<FamilyArchiveIndex>(params.size ? `?${params}` : "");
};
export const loadChapter = (id: string) =>
  familyRequest<{ chapter: FamilyChapter }>(
    `/chapters/${encodeURIComponent(id)}`,
  );
export const loadFamilyMemory = (id: string) =>
  familyRequest<{ memory: FamilyMemory }>(
    `/memories/${encodeURIComponent(id)}`,
  );

/**
 * The album requests for one actor. With a `grantId` they act for an invited
 * relative under the owner's album permission; without it, for the owner.
 */
export function familyApi(grantId?: string) {
  const scoped = (path: string) =>
    grantId
      ? `${path}${path.includes("?") ? "&" : "?"}grantId=${encodeURIComponent(grantId)}`
      : path;
  const request = <T,>(
    path = "",
    method = "GET",
    body?: unknown,
    key?: string,
  ) => familyRequest<T>(scoped(path), method, body, key);
  return {
    grantId,
    familyRequest: request,
    loadFamilyArchive: (
      archiveId?: string,
      after?: string,
      afterChapter?: string,
    ) => {
      const params = new URLSearchParams();
      if (archiveId) params.set("archiveId", archiveId);
      if (after) params.set("after", after);
      if (afterChapter) params.set("afterChapter", afterChapter);
      return request<FamilyArchiveIndex>(params.size ? `?${params}` : "");
    },
    loadChapter: (id: string) =>
      request<{ chapter: FamilyChapter }>(
        `/chapters/${encodeURIComponent(id)}`,
      ),
    loadFamilyMemory: (id: string) =>
      request<{ memory: FamilyMemory }>(`/memories/${encodeURIComponent(id)}`),
  };
}
export type FamilyApi = ReturnType<typeof familyApi>;

