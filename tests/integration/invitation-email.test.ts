/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { handleArchiveRoute } from "../../worker/archive-routes";
import { handleFamilyAccessRoute } from "../../worker/family-access-routes";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  vi.restoreAllMocks();
});

async function setup(sending: "off" | "on" | "failing" = "on") {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const sent: { from: unknown; to: string; subject: string; text: string; html: string }[] = [];
  const env = s.env as typeof s.env & Record<string, unknown>;
  if (sending !== "off") {
    env.EMAIL_SENDING_ENABLED = "true";
    env.EMAIL_FROM_ADDRESS = "family@mail.example.test";
    env.EMAIL = {
      send: async (message: (typeof sent)[number]) => {
        if (sending === "failing") throw new Error(`rejected ${message.to}`);
        sent.push(message);
        return { messageId: "message_synthetic_1" };
      },
    };
  }
  const archive = (await (await handleArchiveRoute(
    new Request("https://example.test/resources/family-archives/archives", {
      method: "POST",
      headers: { Cookie: s.owner, "X-Memories-Request": "family-v1", "X-Idempotency-Key": `archive_${crypto.randomUUID()}` },
      body: JSON.stringify({ title: "Familia Rivera" }),
    }),
    s.env,
  ))!.json()) as { id: string };
  s.db.database
    .prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)")
    .run(s.memory, "La cocina de la tía María", "owner_legacy_test", new Date().toISOString());
  const call = async (path: string, body: unknown, key = `family_access_${crypto.randomUUID()}`) =>
    (await handleFamilyAccessRoute(
      new Request(`https://example.test/resources/family-access${path}`, {
        method: "POST",
        headers: { Cookie: s.owner, "X-Idempotency-Key": key, "X-Memories-Request": "family-v1" },
        body: JSON.stringify(body),
      }),
      s.env,
    ))!;
  const invitation = { archiveId: archive.id, scopeKind: "memory", scopeId: s.memory, role: "viewer", targetEmail: "Prima.Lucia@Example.test" };
  const deliveries = () =>
    s.db.database.prepare("SELECT purpose,subject_id,status,code FROM email_deliveries ORDER BY rowid").all();
  return { ...s, sent, call, invitation, deliveries };
}

describe("invitations by email (L2.1, L2.2)", () => {
  it("sends nothing while email is switched off, and says so", async () => {
    const s = await setup("off"),
      response = await s.call("/grants", { ...s.invitation, emailInvitation: true }),
      result = (await response.json()) as { id: string; email: unknown };
    expect(response.status).toBe(201);
    expect(result.email).toEqual({ status: "not_sent", code: "email_sending_off" });
    expect(s.deliveries()).toEqual([{ purpose: "family_invitation", subject_id: result.id, status: "not_sent", code: "email_sending_off" }]);
  });

  it("emails the link only when asked, once, to the invited address, with no memory content", async () => {
    const s = await setup(),
      quiet = await s.call("/grants", { ...s.invitation, targetEmail: "quiet@example.test" });
    expect(((await quiet.json()) as { email?: unknown }).email).toBeUndefined();
    expect(s.sent).toHaveLength(0);

    const key = `family_access_${crypto.randomUUID()}`,
      first = (await (await s.call("/grants", { ...s.invitation, emailInvitation: true }, key)).json()) as { id: string; joinPath: string; email: unknown };
    expect(first.email).toEqual({ status: "sent" });
    expect(s.sent).toHaveLength(1);
    const message = s.sent[0]!;
    expect(message.to).toBe("prima.lucia@example.test");
    expect(message.from).toEqual({ email: "family@mail.example.test", name: "Memories: My Story" });
    expect(message.text).toContain(`https://example.test${first.joinPath}`);
    expect(message.html).toContain(`href="https://example.test${first.joinPath}"`);
    // Never a memory's title, the album's name, or anyone's name.
    for (const part of [message.subject, message.text, message.html])
      for (const secret of ["La cocina de la tía María", "Familia Rivera", "owner_legacy_test", "memory_legacy_test"])
        expect(part).not.toContain(secret);

    // A retried request replays the same invitation and never emails twice.
    const replay = (await (await s.call("/grants", { ...s.invitation, emailInvitation: true }, key)).json()) as { replayed: boolean; email: unknown };
    expect(replay).toMatchObject({ replayed: true, email: { status: "sent" } });
    expect(s.sent).toHaveLength(1);
    expect(s.deliveries()).toEqual([{ purpose: "family_invitation", subject_id: first.id, status: "sent", code: null }]);
  });

  it("asking afterwards with the same request emails an invitation that was made without email", async () => {
    const s = await setup(),
      key = `family_access_${crypto.randomUUID()}`;
    await s.call("/grants", s.invitation, key);
    expect(s.sent).toHaveLength(0);
    const later = (await (await s.call("/grants", { ...s.invitation, emailInvitation: true }, key)).json()) as { email: unknown };
    expect(later.email).toEqual({ status: "sent" });
    expect(s.sent).toHaveLength(1);
  });

  it("sends nothing for a revoked invitation", async () => {
    const s = await setup(),
      key = `family_access_${crypto.randomUUID()}`,
      made = (await (await s.call("/grants", s.invitation, key)).json()) as { id: string };
    expect((await s.call(`/grants/${made.id}/revoke`, { version: 1 })).status).toBe(200);
    const retry = await s.call("/grants", { ...s.invitation, emailInvitation: true }, key);
    expect(retry.status).toBe(409);
    expect(s.sent).toHaveLength(0);
  });

  it("records a provider failure without logging the address", async () => {
    const s = await setup("failing"),
      logged = vi.spyOn(console, "error").mockImplementation(() => undefined),
      result = (await (await s.call("/grants", { ...s.invitation, emailInvitation: true })).json()) as { email: unknown };
    expect(result.email).toEqual({ status: "not_sent", code: "email_provider_failed" });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("example.test");
    expect(s.deliveries()).toMatchObject([{ status: "not_sent", code: "email_provider_failed" }]);
  });
});
