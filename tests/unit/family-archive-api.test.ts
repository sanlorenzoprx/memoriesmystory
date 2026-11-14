import { afterEach, expect, it, vi } from "vitest";
import {
  familyRequest,
  loadFamilyArchive,
} from "../../app/services/family-archive";
afterEach(() => vi.unstubAllGlobals());
it("never treats an invalid success acknowledgement or HTML fallback as confirmed Chapter metadata", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({})),
  );
  await expect(
    familyRequest(
      "/chapters",
      "POST",
      { title: "Grandmother" },
      "family_test_key_001",
    ),
  ).rejects.toThrow("Your private Chapters could not be opened.");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("<html>old application</html>", {
          headers: { "Content-Type": "text/html" },
        }),
    ),
  );
  await expect(loadFamilyArchive()).rejects.toThrow(
    "Your private Chapters could not be opened.",
  );
});
