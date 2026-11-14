import { afterEach, expect, it, vi } from "vitest";
import { peopleRequest, loadPeople } from "../../app/services/family-people";
afterEach(() => vi.unstubAllGlobals());
it("rejects malformed success acknowledgements and old fallback responses before showing saved", async () => {
  for (const value of [
    {},
    { id: "bad", version: 1 },
    { id: "person_valid_id", version: 0 },
  ]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(value)),
    );
    await expect(
      peopleRequest("archive_valid_id", "/person", "POST", {}, "request_key"),
    ).rejects.toThrow("People could not be opened");
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({})),
  );
  await expect(
    peopleRequest("archive_valid_id", "/person/person_valid_id"),
  ).rejects.toThrow("People could not be opened");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<html>Old app</html>")),
  );
  await expect(loadPeople("archive_valid_id")).rejects.toThrow(
    "People could not be opened",
  );
});
