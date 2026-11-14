import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Trusted operator module shared with manual Actions.
import { createCloudArchiveRuntime } from "../../scripts/realtimekit-cloud-archive-runtime.mjs";
const credentials = {
  REALTIMEKIT_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_API_TOKEN: "DEPLOYMENT_CANARY",
};
const options = {
  modulesRoot: "/candidate",
  modules: [
    {
      path: "/candidate/native-archive-proof.js",
      contents: "export default {};",
      type: "ESModule",
    },
  ],
  bindings: {
    SESSION_SECRET: "SESSION_CANARY",
    REALTIMEKIT_API_TOKEN: "MEDIA_CANARY",
    LEGACY_REMOTE_RECORDING_ENABLED: "true",
  },
};
function setup(denyBucket = false, failWorkerDelete = false) {
  const calls: { path: string; method: string }[] = [],
    uploads: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input),
      method = init.method ?? "GET";
    calls.push({ path: url.pathname, method });
    if (url.hostname.endsWith("workers.dev")) {
      if (method === "GET") return new Response(null, { status: 404 });
      if (url.pathname === "/__archive-proof/generation")
        return Response.json({
          generation: (
            uploads[uploads.length - 1].bindings as {
              name: string;
              text: string;
            }[]
          ).find((binding) => binding.name === "ARCHIVE_PROOF_GENERATION")!
            .text,
        });
      if (url.pathname === "/__archive-proof/head")
        return Response.json({ cacheControl: "private, no-store", size: 3 });
      return Response.json({ empty: true, count: 3 });
    }
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer DEPLOYMENT_CANARY",
    );
    const ok = (result: unknown) => Response.json({ success: true, result });
    if (url.pathname.endsWith("/workers/subdomain"))
      return ok({ subdomain: "synthetic-account" });
    if (url.pathname.endsWith("/d1/database") && method === "POST")
      return ok({ uuid: "11111111-1111-4111-8111-111111111111" });
    if (url.pathname.endsWith("/r2/buckets") && method === "POST") {
      if (denyBucket)
        return Response.json(
          { private: "PRIVATE_BODY_CANARY" },
          { status: 403 },
        );
      return ok({ name: JSON.parse(String(init.body)).name });
    }
    if (url.pathname.endsWith("/domains/managed"))
      return ok({ enabled: false });
    if (url.pathname.endsWith("/domains/custom")) return ok({ domains: [] });
    if (method === "PUT") {
      const form = init.body as FormData,
        metadata = JSON.parse(String(form.get("metadata")));
      uploads.push(metadata);
      expect(JSON.stringify(metadata)).not.toContain("DEPLOYMENT_CANARY");
      return ok({});
    }
    if (
      method === "DELETE" &&
      url.pathname.includes("/workers/") &&
      failWorkerDelete
    )
      return Response.json({ private: "PRIVATE_BODY_CANARY" }, { status: 500 });
    if (url.pathname.endsWith("/query"))
      return ok([{ success: true, results: [{ n: 1 }], meta: { changes: 1 } }]);
    if (url.pathname.includes("/objects/"))
      return new Response(new Uint8Array([1, 2, 3]));
    return ok({});
  });
  return { fetch, calls, uploads };
}
describe("isolated cloud archive runtime", () => {
  it("rejects missing deployment access before provisioning any resource", async () => {
    const fetch = vi.fn();
    await expect(createCloudArchiveRuntime(options, {}, fetch)).rejects.toThrow(
      "archive_cloud_configuration_missing",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("creates only fresh private resources, keeps deployment credentials out of Worker bindings, and independently reads sources", async () => {
    const s = setup(),
      runtime = await createCloudArchiveRuntime(options, credentials, s.fetch);
    await runtime.ready;
    expect(
      await (await runtime.getD1Database()).prepare("SELECT 1 AS n").first(),
    ).toEqual({ n: 1 });
    const source = await (
      await runtime.getR2Bucket()
    ).get("legacy/synthetic/source");
    expect([...new Uint8Array(await source.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(source.httpMetadata.cacheControl).toBe("private, no-store");
    const bindings = s.uploads[0].bindings as { name: string; type: string }[];
    expect(
      bindings.find((binding) => binding.name === "REALTIMEKIT_API_TOKEN")
        ?.type,
    ).toBe("secret_text");
    expect(
      bindings.some((binding) => binding.name === "CLOUDFLARE_API_TOKEN"),
    ).toBe(false);
    expect(() =>
      runtime.dispatchFetch("https://other.test/private", {}),
    ).toThrow();
    await runtime.dispose();
  });
  it("redeploys without creating replacement namespaces and removes owned resources independently", async () => {
    const s = setup(),
      runtime = await createCloudArchiveRuntime(options, credentials, s.fetch);
    await runtime.ready;
    await runtime.restart();
    await runtime.dispose();
    expect(s.uploads[0].migrations).toMatchObject({
      new_sqlite_classes: ["LegacyRecorder"],
    });
    expect(s.uploads[1].migrations).toBeUndefined();
    expect(s.uploads[2].migrations).toMatchObject({
      deleted_classes: ["LegacyRecorder"],
    });
    expect(s.calls.filter((call) => call.method === "DELETE")).toHaveLength(3);
    expect(
      s.calls
        .filter(
          (call) =>
            call.method === "DELETE" && call.path.includes("/r2/buckets/"),
        )
        .every((call) => call.path.includes("memoriesmystory-archive-proof-")),
    ).toBe(true);
  });
  it("cleans up a confirmed database after a rejected bucket allocation without reading/logging provider errors", async () => {
    const s = setup(true);
    await expect(
      createCloudArchiveRuntime(options, credentials, s.fetch),
    ).rejects.toMatchObject({
      message: "archive_cloud_request_failed",
      httpStatus: 403,
    });
    expect(s.calls.filter((call) => call.method === "DELETE")).toEqual([
      {
        method: "DELETE",
        path: `/client/v4/accounts/${credentials.REALTIMEKIT_ACCOUNT_ID}/d1/database/11111111-1111-4111-8111-111111111111`,
      },
    ]);
  });
  it("continues bucket/database cleanup after Worker deletion fails and never confirms cleanup", async () => {
    const s = setup(false, true),
      runtime = await createCloudArchiveRuntime(options, credentials, s.fetch);
    await runtime.ready;
    await expect(runtime.dispose()).rejects.toThrow(
      "archive_cloud_cleanup_unconfirmed",
    );
    expect(s.calls.filter((call) => call.method === "DELETE")).toHaveLength(3);
  });
});
