import type { FamilyContribution } from "../domain/family-contribution";
import { apiMessageKey } from "../localization/errors";
export async function contributionRequest<T>(
  memoryId: string,
  grantId: string | undefined,
  path = "",
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(
    `/resources/family-contributions/${encodeURIComponent(memoryId)}${path}${grantId ? `${path.includes("?") ? "&" : "?"}grantId=${encodeURIComponent(grantId)}` : ""}`,
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
    contributions?: FamilyContribution[];
  } | null;
  if (!response.ok)
    throw new Error(
      apiMessageKey(
        value?.error?.code,
        "Family recollections could not be opened. Please try again.",
      ),
    );
  if (
    !value ||
    typeof value !== "object" ||
    (method !== "GET" &&
      (typeof value.id !== "string" ||
        !/^[A-Za-z0-9_-]{8,120}$/.test(value.id) ||
        !Number.isSafeInteger(value.version) ||
        Number(value.version) < 1))
  )
    throw new Error(
      "Family recollections could not be opened. Please try again.",
    );
  return value as T;
}
export type ContributionIndex = {
  contributions: FamilyContribution[];
  canContribute: boolean;
  draftScope: string;
  nextCursor: string | null;
};

/** Called only after confirmed whole-memory deletion; unrelated local drafts stay. */
export function removeLocalContributionDrafts(memoryId: string) {
  if (typeof localStorage === "undefined") return;
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (!key?.startsWith("memoriesmystory:contribution:")) continue;
    const raw = localStorage.getItem(key);
    let value: { memoryId?: string } | null;
    try {
      value = JSON.parse(raw ?? "null");
    } catch {
      continue;
    }
    if (value?.memoryId === memoryId) localStorage.removeItem(key);
  }
}
