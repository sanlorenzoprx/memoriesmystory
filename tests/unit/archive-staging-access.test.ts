import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Read-only operator script is shared with manual Actions.
import { checkArchiveStagingAccess } from "../../scripts/check-archive-staging-access.mjs";
const env = {
  REALTIMEKIT_ACCOUNT_ID: "a".repeat(32),
  REALTIMEKIT_API_TOKEN: "SECRET_CANARY",
};
describe("read-only archive staging capability preflight", () => {
  it("does not request anything without valid existing configuration", async () => {
    const fetch = vi.fn();
    expect(await checkArchiveStagingAccess({}, fetch)).toMatchObject({
      ok: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports denied metadata permissions without exposing provider content or treating call access as archive access", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ message: "PRIVATE_PROVIDER_CANARY" }, { status: 403 }),
    );
    const result = await checkArchiveStagingAccess(env, fetch);
    expect(result.checks).toHaveLength(3);
    expect(
      result.checks.every(
        (item: { status: string; accessible: boolean }) =>
          item.status === "access_denied" && !item.accessible,
      ),
    ).toBe(true);
    expect(result.deploymentWriteAccess).toBe("not_tested");
    expect(JSON.stringify(result)).not.toMatch(/CANARY/);
    for (const [url, init] of fetch.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(url).toMatch(
        /^https:\/\/api.cloudflare.com\/client\/v4\/accounts\//,
      );
      expect(init.method).toBeUndefined();
      expect(init.body).toBeUndefined();
    }
  });
  it("returns only a bounded candidate count, not unrelated resource names, identifiers, settings or secrets", async () => {
    const fetch = vi.fn(async (input: string) =>
      Response.json({
        success: true,
        result: input.endsWith("/r2/buckets")
          ? {
              buckets: [
                {
                  name: "memoriesmystory-staging-media",
                  id: "PRIVATE_ID_CANARY",
                },
                { name: "unrelated-private-resource" },
              ],
            }
          : [
              { name: "memoriesmystory-staging", id: "PRIVATE_ID_CANARY" },
              { name: "other-project" },
            ],
      }),
    );
    const result = await checkArchiveStagingAccess(env, fetch);
    expect(
      result.checks.every(
        (item: { accessible: boolean; matchingStagingResourceCount: number }) =>
          item.accessible && item.matchingStagingResourceCount === 1,
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /CANARY|unrelated|other-project|memoriesmystory-staging/,
    );
  });
});
