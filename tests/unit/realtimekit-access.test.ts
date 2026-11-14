import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Dependency-free operator script shared with Actions.
import { checkRealtimeKitAccess } from "../../scripts/check-realtimekit-access.mjs";
const config = { REALTIMEKIT_ACCOUNT_ID: "a".repeat(32), REALTIMEKIT_API_TOKEN: "PRIVATE_TOKEN_CANARY" };
describe("read-only Actions RealtimeKit access check", () => {
  it("rejects missing/malformed configuration before any request", async () => {
    const fetch = vi.fn();
    expect(await checkRealtimeKitAccess({}, fetch)).toMatchObject({ok:false});
    expect(await checkRealtimeKitAccess({...config,REALTIMEKIT_ACCOUNT_ID:"invalid"},fetch)).toMatchObject({ok:false});
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses an account-scoped read request and never returns provider identifiers or credentials", async () => {
    const fetch = vi.fn(async () => Response.json({success:true,data:[{id:"APP_CANARY",name:"FAMILY_CANARY"}]}));
    const result = await checkRealtimeKitAccess(config,fetch);
    expect(result).toEqual({ok:true,status:"realtimekit_read_access_verified"});
    const [url,options] = fetch.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${config.REALTIMEKIT_ACCOUNT_ID}/realtime/kit/apps`);
    expect(options.method).toBeUndefined();
    expect(options.redirect).toBe("error");
    expect(JSON.stringify(result)).not.toMatch(/CANARY/);
    expect(JSON.stringify(result)).not.toContain(config.REALTIMEKIT_ACCOUNT_ID);
  });
  it("does not echo error bodies, exception text or credentials", async () => {
    for (const status of [401,403,429,500]) {
      const result = await checkRealtimeKitAccess(config,async () => new Response("PRIVATE_ERROR_CANARY",{status}));
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("CANARY");
    }
    expect(await checkRealtimeKitAccess(config,async () => {throw new Error(config.REALTIMEKIT_API_TOKEN);})).toEqual({ok:false,status:"provider_connection_failed"});
    expect(await checkRealtimeKitAccess(config,async () => Response.json({success:false,data:[]}))).toEqual({ok:false,status:"unexpected_provider_response"});
  });
});
