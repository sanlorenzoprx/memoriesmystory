import { apiMessageKey } from "../localization/errors";
import type {
  LegacyMode,
  LegacySessionView,
} from "../domain/our-living-legacy";
export class LegacyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}
export async function legacyRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-Memories-Request": "legacy-v1" } : {}),
      ...(key ? { "X-Idempotency-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string };
  };
  if (!response.ok)
    throw new LegacyApiError(
      apiMessageKey(
        value.error?.code,
        "Our Living Legacy could not continue. Please try again.",
      ),
      response.status,
      value.error?.code ?? "legacy_request",
    );
  return value;
}
export const legacyPath = (id: string, guest = false, suffix = "") =>
  `/resources/legacy-sessions/${encodeURIComponent(id)}${suffix}${guest ? "?as=guest" : ""}`;
export const loadLegacySession = (id: string, guest = false) =>
  legacyRequest<LegacySessionView>(legacyPath(id, guest));
export const createLegacySession = (
  input: { memoryId: string; displayName: string; mode: LegacyMode },
  key: string,
) =>
  legacyRequest<{ sessionId: string; joinPath: string }>(
    "/resources/legacy-sessions",
    "POST",
    input,
    key,
  );
