import { afterEach, expect, it, vi } from "vitest";
import { contributionRequest } from "../../app/services/family-contributions";
afterEach(() => vi.unstubAllGlobals());
it("rejects malformed durable acknowledgements and does not expose arbitrary server text", async () => {
  for (const body of [
    {},
    { id: "bad", version: 1 },
    { id: "contribution_valid", version: 0 },
  ]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body)),
    );
    await expect(
      contributionRequest(
        "memory_valid",
        undefined,
        "",
        "POST",
        {},
        "request_valid",
      ),
    ).rejects.toThrow("Family recollections could not be opened");
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { error: { code: "unknown", message: "PRIVATE_TEXT_CANARY" } },
        { status: 503 },
      ),
    ),
  );
  await expect(
    contributionRequest(
      "memory_valid",
      undefined,
      "",
      "POST",
      {},
      "request_valid",
    ),
  ).rejects.toThrow("Family recollections could not be opened");
});
