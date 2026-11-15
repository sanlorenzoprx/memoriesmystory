import { apiMessageKey } from "../localization/errors";
export async function familyAccessRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(`/resources/family-access${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "X-Memories-Request": "family-v1",
      "Content-Type": "application/json",
      ...(key ? { "X-Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = (await response.json().catch(() => null)) as {
    id?: string;
    version?: number;
    error?: { code?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      apiMessageKey(
        value?.error?.code,
        "Family access could not be opened. Please try again.",
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
    throw new Error("Family access could not be opened. Please try again.");
  return value as T;
}
