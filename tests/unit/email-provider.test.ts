import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../../worker/providers/email-provider";
import { invitationEmail } from "../../worker/notifications";

const message = { to: "person@example.test", subject: "s", text: "t", html: "<p>t</p>" };
const binding = { send: async () => ({ messageId: "m1" }) };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("email adapter fails closed (L2.1)", () => {
  it("refuses with a stable code for each missing piece", async () => {
    expect(await sendEmail({}, message)).toEqual({ status: "not_sent", code: "email_sending_off" });
    expect(await sendEmail({ EMAIL_SENDING_ENABLED: "yes", EMAIL: binding, EMAIL_FROM_ADDRESS: "a@b.example" }, message)).toEqual({ status: "not_sent", code: "email_sending_off" });
    expect(await sendEmail({ EMAIL_SENDING_ENABLED: "true", EMAIL: binding }, message)).toEqual({ status: "not_sent", code: "email_sender_unconfigured" });
    expect(await sendEmail({ EMAIL_SENDING_ENABLED: "true", EMAIL_FROM_ADDRESS: "a@b.example" }, message)).toEqual({ status: "not_sent", code: "email_provider_missing" });
    const ready = { EMAIL_SENDING_ENABLED: "true", EMAIL: binding, EMAIL_FROM_ADDRESS: "a@b.example" };
    expect(await sendEmail(ready, { ...message, to: "not an address" })).toEqual({ status: "not_sent", code: "email_recipient_invalid" });
    expect(await sendEmail(ready, message)).toEqual({ status: "sent", messageId: "m1", provider: "cloudflare" });
  });

  it("sends through Resend first, with an idempotency key, and falls back to Cloudflare", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let resendStatus = 200;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(resendStatus === 200 ? { id: "resend_1" } : { message: "person@example.test rejected" }), { status: resendStatus });
    });
    const cloudflare: string[] = [];
    const env = {
      EMAIL_SENDING_ENABLED: "true",
      EMAIL_FROM_ADDRESS: "family@mail.example.test",
      RESEND_API_KEY: "re_synthetic",
      EMAIL: { send: async (m: { to: string }) => (cloudflare.push(m.to), { messageId: "cf_1" }) },
    };
    expect(await sendEmail(env, message, { idempotencyKey: "family-invitation:grant_1" })).toEqual({ status: "sent", messageId: "resend_1", provider: "resend" });
    const sent = calls[0]!;
    expect(sent.url).toBe("https://api.resend.com/emails");
    expect((sent.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("family-invitation:grant_1");
    expect((sent.init.headers as Record<string, string>).Authorization).toBe("Bearer re_synthetic");
    expect(JSON.parse(String(sent.init.body))).toMatchObject({ from: "Memories: My Story <family@mail.example.test>", to: ["person@example.test"], subject: "s" });
    expect(cloudflare).toEqual([]);

    // Resend refuses: Cloudflare carries the message, and no address reaches the log.
    resendStatus = 503;
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendEmail(env, message)).toEqual({ status: "sent", messageId: "cf_1", provider: "cloudflare" });
    expect(cloudflare).toEqual(["person@example.test"]);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("example.test");
    // Resend alone, refusing: not sent, with a stable code.
    expect(await sendEmail({ ...env, EMAIL: undefined }, message)).toEqual({ status: "not_sent", code: "email_provider_failed" });
  });

  it("writes the invitation in English and Spanish and escapes the link", () => {
    const email = invitationEmail('https://example.test/family/join/abc"<x>', "2026-12-01T00:00:00.000Z", "Memories: My Story");
    expect(email.text).toContain("Forwarding this message gives nobody else access");
    expect(email.text).toContain("Reenviar este mensaje no le da acceso a nadie más");
    expect(email.text).toContain("2026-12-01");
    expect(email.html).not.toContain('"<x>');
    expect(email.html).toContain("&quot;&lt;x&gt;");
  });
});
