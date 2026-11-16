/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { runOwnerReminderPass } from "../../worker/notifications";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

async function setup(options: { sending?: boolean; optedIn?: boolean; cadence?: "weekly" | "biweekly" | "monthly" } = {}) {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const db = s.db.database,
    owner = "owner_legacy_test";
  db.prepare("UPDATE users SET email=? WHERE id=?").run("owner@example.test", owner);
  db.prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)").run(s.memory, "La cocina de la tía María", owner, new Date().toISOString());
  if (options.optedIn !== false)
    db.prepare("INSERT INTO email_preferences(user_id,family_updates,owner_reminders,reminder_cadence,updated_at) VALUES(?,0,1,?,?)").run(owner, options.cadence ?? "monthly", new Date().toISOString());
  const sent: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }[] = [];
  const env = s.env as typeof s.env & Record<string, unknown>;
  env.PUBLIC_APP_ORIGIN = "https://app.example.test";
  if (options.sending !== false) {
    env.EMAIL_SENDING_ENABLED = "true";
    env.EMAIL_FROM_ADDRESS = "family@mail.example.test";
    env.EMAIL = { send: async (message: (typeof sent)[number]) => (sent.push(message), { messageId: "m" }) };
  }
  const run = (iso: string) => runOwnerReminderPass(env as unknown as Parameters<typeof runOwnerReminderPass>[0], { now: new Date(iso) });
  return { ...s, sent, run };
}

describe("opt-in owner reminders at the person's chosen cadence (L2.5)", () => {
  it("sends and records nothing while email is off", async () => {
    const s = await setup({ sending: false });
    expect(await s.run("2027-01-10T08:00:00.000Z")).toEqual({ skipped: "email_sending_off", sent: 0, notSent: 0 });
  });

  it("reminds an owner who asked, at most once a month, with no memory content", async () => {
    const s = await setup();
    expect((await s.run("2027-01-10T08:00:00.000Z")).sent).toBe(1);
    const message = s.sent[0]!;
    expect(message.to).toBe("owner@example.test");
    // The link opens straight into starting a new memory.
    expect(message.text).toContain("https://app.example.test/?start=camera");
    expect(message.text).toContain("at most once a month");
    expect(message.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    for (const part of [message.subject, message.text, message.html])
      for (const secret of ["La cocina de la tía María", "owner_legacy_test", s.memory]) expect(part).not.toContain(secret);
    expect((await s.run("2027-01-10T20:00:00.000Z")).sent).toBe(0);
    expect((await s.run("2027-01-30T08:00:00.000Z")).sent).toBe(0); // same month
    expect((await s.run("2027-02-01T08:00:00.000Z")).sent).toBe(0); // new month, but only 22 days
    expect((await s.run("2027-02-10T08:00:00.000Z")).sent).toBe(1);
    expect(s.sent).toHaveLength(2);
  });

  it("follows a weekly or every-two-weeks choice", async () => {
    const weekly = await setup({ cadence: "weekly" });
    expect((await weekly.run("2027-01-04T08:00:00.000Z")).sent).toBe(1);
    expect(weekly.sent[0]!.text).toContain("about once a week");
    expect((await weekly.run("2027-01-08T08:00:00.000Z")).sent).toBe(0);
    expect((await weekly.run("2027-01-11T08:00:00.000Z")).sent).toBe(1);
    expect((await weekly.run("2027-01-11T20:00:00.000Z")).sent).toBe(0);
    const biweekly = await setup({ cadence: "biweekly" });
    expect((await biweekly.run("2027-01-04T08:00:00.000Z")).sent).toBe(1);
    expect((await biweekly.run("2027-01-11T08:00:00.000Z")).sent).toBe(0);
    expect((await biweekly.run("2027-01-18T08:00:00.000Z")).sent).toBe(1);
    expect(biweekly.sent[0]!.text).toContain("about every two weeks");
  });

  it("stays silent without the owner's choice, or soon after they finished a memory", async () => {
    const off = await setup({ optedIn: false });
    expect((await off.run("2027-01-10T08:00:00.000Z")).sent).toBe(0);
    const busy = await setup();
    // The fixture's memory was finished today.
    expect((await busy.run(new Date(Date.now() + 5 * 86_400_000).toISOString())).sent).toBe(0);
    expect(busy.sent).toEqual([]);
  });
});
