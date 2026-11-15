/// <reference types="@cloudflare/workers-types" />
import { afterEach, expect, it, vi } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { verifiedClerkRecipient } from "../../worker/family-permissions";
afterEach(() => vi.unstubAllGlobals());
it("uses fresh Clerk verification instead of a matching stored email or unverified claim", async () => {
  const fixture = await setupLegacyFixture();
  try {
    const now = new Date().toISOString();
    fixture.db.database
      .prepare(
        "INSERT INTO auth_principals(id,user_id,issuer,subject,created_at,updated_at) VALUES('principal_family_test','owner_legacy_test','clerk','user_clerk_family',?,?)",
      )
      .run(now, now);
    const env = { ...fixture.env, CLERK_SECRET_KEY: "PRIVATE_IDENTITY_CANARY" };
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      expect(new Headers(options.headers).get("Authorization")).toBe(
        "Bearer PRIVATE_IDENTITY_CANARY",
      );
      expect(options.redirect).toBe("manual");
      return Response.json({
        id: "user_clerk_family",
        email_addresses: [
          {
            email_address: "invited@example.test",
            verification: { status: "unverified" },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetch);
    expect(
      await verifiedClerkRecipient(
        env,
        "owner_legacy_test",
        "invited@example.test",
      ),
    ).toBe(false);
    fetch.mockImplementationOnce(async () =>
      Response.json({
        id: "user_clerk_family",
        email_addresses: [
          {
            email_address: "INVITED@example.test",
            verification: { status: "verified" },
          },
        ],
      }),
    );
    expect(
      await verifiedClerkRecipient(
        env,
        "owner_legacy_test",
        "invited@example.test",
      ),
    ).toBe(true);
    fetch.mockImplementationOnce(async () =>
      Response.json({
        id: "different_clerk_user",
        email_addresses: [
          {
            email_address: "invited@example.test",
            verification: { status: "verified" },
          },
        ],
      }),
    );
    await expect(
      verifiedClerkRecipient(env, "owner_legacy_test", "invited@example.test"),
    ).rejects.toThrow("family_identity_unavailable");
    await expect(
      verifiedClerkRecipient(
        fixture.env,
        "owner_legacy_test",
        "invited@example.test",
      ),
    ).rejects.toThrow("family_identity_unavailable");
  } finally {
    fixture.db.close();
  }
});
