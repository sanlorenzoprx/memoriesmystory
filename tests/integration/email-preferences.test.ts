/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleEmailPreferenceRoute, unsubscribeToken } from "../../worker/email-preferences";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const now = new Date().toISOString();
  s.db.database.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run("other_email_user", now, now);
  const other = (await createAppSession(s.env, "other_email_user")).cookie.split(";")[0]!;
  const call = async (path: string, init: RequestInit = {}) =>
    (await handleEmailPreferenceRoute(new Request(`https://example.test/resources/email${path}`, init), s.env))!;
  const save = (cookie: string, body: unknown, header = true) =>
    call("/preferences", {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json", ...(header ? { "X-Memories-Request": "email-v1" } : {}) },
      body: JSON.stringify(body),
    });
  const read = async (cookie: string) => (await (await call("/preferences", { headers: { Cookie: cookie } })).json()) as Record<string, unknown>;
  const events = () => s.db.database.prepare("SELECT user_id,kind,enabled,source FROM email_preference_events ORDER BY rowid").all();
  const secret = s.env.SESSION_SECRET;
  return { ...s, other, call, save, read, events, secret };
}

describe("email preferences and one-step unsubscribe (L2.3)", () => {
  it("starts with every optional email off and records each change", async () => {
    const s = await setup();
    expect(await s.read(s.owner)).toEqual({ family_updates: false, owner_reminders: false, reminderCadence: "weekly", version: 0 });
    expect((await s.call("/preferences")).status).toBe(401);
    expect((await s.save(s.owner, { family_updates: true, owner_reminders: false, version: 0 }, false)).status).toBe(400);
    const saved = await s.save(s.owner, { family_updates: true, owner_reminders: false, version: 0 });
    expect(await saved.json()).toEqual({ family_updates: true, owner_reminders: false, reminderCadence: "weekly", version: 1 });
    // Cadence is a choice among three; anything else is refused.
    expect((await s.save(s.owner, { family_updates: true, owner_reminders: true, reminderCadence: "daily", version: 1 })).status).toBe(400);
    expect(await (await s.save(s.owner, { family_updates: true, owner_reminders: true, reminderCadence: "biweekly", version: 1 })).json()).toMatchObject({ reminderCadence: "biweekly", version: 2 });
    // A stale view cannot overwrite a newer choice.
    expect((await s.save(s.owner, { family_updates: false, owner_reminders: false, version: 0 })).status).toBe(409);
    expect(await s.read(s.other)).toMatchObject({ family_updates: false });
    expect(s.events()).toEqual([
      { user_id: "owner_legacy_test", kind: "family_updates", enabled: 1, source: "settings" },
      { user_id: "owner_legacy_test", kind: "owner_reminders", enabled: 1, source: "settings" },
    ]);
  });

  it("opening the link changes nothing; pressing the button or a one-click POST turns off only that kind", async () => {
    const s = await setup();
    await s.save(s.owner, { family_updates: true, owner_reminders: true, version: 0 });
    const token = await unsubscribeToken(s.secret, "owner_legacy_test", "family_updates");
    const opened = await s.call(`/unsubscribe?t=${encodeURIComponent(token)}`);
    expect(opened.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await opened.text()).toContain('method="post"');
    expect(await s.read(s.owner)).toMatchObject({ family_updates: true });
    const done = await s.call(`/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST", body: "List-Unsubscribe=One-Click" });
    expect(await done.text()).toContain("You will not get emails when something new is shared with you anymore.");
    expect(await s.read(s.owner)).toMatchObject({ family_updates: false, owner_reminders: true });
    // Pressing again is harmless and records nothing new.
    await s.call(`/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" });
    expect(s.events()).toEqual([
      { user_id: "owner_legacy_test", kind: "family_updates", enabled: 1, source: "settings" },
      { user_id: "owner_legacy_test", kind: "owner_reminders", enabled: 1, source: "settings" },
      { user_id: "owner_legacy_test", kind: "family_updates", enabled: 0, source: "unsubscribe_link" },
    ]);
  });

  it("a link cannot be changed to reach another person or another kind of email", async () => {
    const s = await setup();
    await s.save(s.other, { family_updates: true, owner_reminders: true, version: 0 });
    const [, kind, signed] = (await unsubscribeToken(s.secret, "owner_legacy_test", "family_updates")).split(".");
    const otherUser = btoa("other_email_user").replace(/=+$/, "");
    for (const forged of [`${otherUser}.${kind}.${signed}`, `${(await unsubscribeToken(s.secret, "other_email_user", "family_updates")).split(".")[0]}.owner_reminders.${signed}`, "garbage", ""]) {
      const response = await s.call(`/unsubscribe?t=${encodeURIComponent(forged)}`, { method: "POST" });
      expect(await response.text()).toContain("This unsubscribe link is not valid.");
    }
    // A link signed with a different secret is refused too.
    const foreign = await unsubscribeToken("another-deployment-secret".repeat(2), "other_email_user", "family_updates");
    expect(await (await s.call(`/unsubscribe?t=${encodeURIComponent(foreign)}`, { method: "POST" })).text()).toContain("not valid");
    expect(await s.read(s.other)).toMatchObject({ family_updates: true, owner_reminders: true });
  });
});
