import { afterEach, expect, it, vi } from "vitest";
import { removeLocalContributionDrafts } from "../../app/services/family-contributions";
afterEach(() => vi.unstubAllGlobals());
it("removes only the deleted memory contribution drafts and preserves other device data", () => {
  const data = new Map([
    [
      "memoriesmystory:contribution:author_one",
      JSON.stringify({
        memoryId: "memory_deleted",
        text: "Private unsent words",
      }),
    ],
    [
      "memoriesmystory:contribution:author_two",
      JSON.stringify({ memoryId: "memory_kept", text: "Other words" }),
    ],
    ["memoriesmystory:ui-locale", "es-PR"],
  ]);
  vi.stubGlobal("localStorage", {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => data.delete(key),
  });
  removeLocalContributionDrafts("memory_deleted");
  expect(data.has("memoriesmystory:contribution:author_one")).toBe(false);
  expect(data.has("memoriesmystory:contribution:author_two")).toBe(true);
  expect(data.get("memoriesmystory:ui-locale")).toBe("es-PR");
});
