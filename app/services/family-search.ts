import type { FamilySearchResponse } from "../domain/family-search";
import { apiMessageKey } from "../localization/errors";

const fallback = "The search could not be completed. Please try again.";

/** Literal search of what this account may see. Nothing is saved or logged on the device. */
export async function searchFamilyArchive(
  query: string,
  grantId?: string,
  signal?: AbortSignal,
): Promise<FamilySearchResponse> {
  let response: Response;
  try {
    response = await fetch(
      `/resources/family-search?q=${encodeURIComponent(query)}${grantId ? `&grantId=${encodeURIComponent(grantId)}` : ""}`,
      { credentials: "same-origin", signal },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(fallback, { cause: error });
  }
  const value = (await response.json().catch(() => null)) as
    | (Partial<FamilySearchResponse> & { error?: { code?: string } })
    | null;
  if (!response.ok) throw new Error(apiMessageKey(value?.error?.code, fallback));
  if (
    !value ||
    !Array.isArray(value.results) ||
    value.results.some(
      (result) =>
        typeof result?.memoryId !== "string" || !Array.isArray(result.matches),
    )
  )
    throw new Error(fallback);
  return {
    query: typeof value.query === "string" ? value.query : query,
    results: value.results,
    truncated: value.truncated === true,
  };
}
