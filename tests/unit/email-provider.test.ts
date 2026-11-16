import { describe, expect, it } from "vitest";
import { sendEmail } from "../../worker/providers/email-provider";
import { invitationEmail } from "../../worker/notifications";

const message = { to: "person@example.test", subject: "s", text: "t", html: "<p>t</p>" };
const binding = { send: async () => ({ messageId: "m1" }) };

describe("email adapter fails closed (L2.1)", () => {
  it("refuses with a stable code for each missing piece", async () => {
    expect(await sendEmail({}, message)).toEqual({ status: "not_sent", code: "email_sending_off" });
    expect(await sendEmail({ EMAIL_SENDING_ENABLED: "yes", EMAIL: binding, EMAIL_FROM_ADDRESS: "a@b.example" }, message)).toEqual({ status: "not_sent", code: "email_sending_off" });
    expect(await sendEmail({ EMAIL_SENDING_ENABLED: "true", EMAIL: binding }, message)).toEqual({ status: "not_sent", code: "email_sender_unconfigured" });
    expect(await sendEmail({ EMAIL_SENDING_ENABLED: "true", EMAIL_FROM_ADDRESS: "a@b.example" }, message)).toEqual({ status: "not_sent", code: "email_binding_missing" });
    const ready = { EMAIL_SENDING_ENABLED: "true", EMAIL: binding, EMAIL_FROM_ADDRESS: "a@b.example" };
    expect(await sendEmail(ready, { ...message, to: "not an address" })).toEqual({ status: "not_sent", code: "email_recipient_invalid" });
    expect(await sendEmail(ready, message)).toEqual({ status: "sent", messageId: "m1" });
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
