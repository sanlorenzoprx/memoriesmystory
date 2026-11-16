/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { runFamilyUpdatePass } from "../../worker/notifications";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

const day1 = new Date("2026-11-20T08:00:00.000Z"),
  day2 = new Date("2026-11-21T08:00:00.000Z");

async function setup(options: { sending?: boolean; preference?: boolean } = {}) {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const db = s.db.database,
    owner = "owner_legacy_test",
    member = "family_update_member",
    accepted = "2026-11-19T00:00:00.000Z";
  db.prepare("INSERT INTO users(id,email,created_at,updated_at) VALUES(?,?,?,?)").run(member, "Member@Example.test", accepted, accepted);
  db.prepare("INSERT INTO family_archives(id,owner_user_id,title,description,created_at,updated_at) VALUES('archive_updates',?,?,'',?,?)").run(owner, "Familia Rivera", accepted, accepted);
  db.prepare("INSERT INTO family_chapters(id,archive_id,title,description,created_at,updated_at) VALUES('chapter_updates','archive_updates','Veranos','',?,?)").run(accepted, accepted);
  db.prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)").run(s.memory, "La cocina de la tía María", owner, accepted);
  db.prepare(
    "INSERT INTO family_access_grants(id,archive_id,owner_user_id,role,scope_kind,scope_id,target_email,token_hash,state,accepted_by_user_id,accepted_at,expires_at,created_at,updated_at) VALUES('grant_updates','archive_updates',?,'viewer','chapter','chapter_updates','member@example.test',?,'accepted',?,?,'2026-12-31T00:00:00.000Z',?,?)",
  ).run(owner, "f".repeat(64), member, accepted, accepted, accepted);
  if (options.preference !== false)
    db.prepare("INSERT INTO email_preferences(user_id,family_updates,owner_reminders,updated_at) VALUES(?,1,0,?)").run(member, accepted);
  const sent: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }[] = [];
  const env = s.env as typeof s.env & Record<string, unknown>;
  env.PUBLIC_APP_ORIGIN = "https://app.example.test";
  if (options.sending !== false) {
    env.EMAIL_SENDING_ENABLED = "true";
    env.EMAIL_FROM_ADDRESS = "family@mail.example.test";
    env.EMAIL = { send: async (message: (typeof sent)[number]) => (sent.push(message), { messageId: "m" }) };
  }
  const place = (at: string) =>
    db.prepare("INSERT OR REPLACE INTO family_chapter_memories(chapter_id,memory_story_id,added_by_user_id,position,created_at) VALUES('chapter_updates',?,?,0,?)").run(s.memory, owner, at);
  const notices = () => db.prepare("SELECT member_user_id,sent_on,status,code FROM family_update_notices ORDER BY rowid").all();
  return { ...s, env: env as unknown as Parameters<typeof runFamilyUpdatePass>[0], db, sent, place, notices, member };
}

describe("'something new is waiting' notices to invited family (L2.4)", () => {
  it("sends nothing and records nothing while email is off", async () => {
    const s = await setup({ sending: false });
    s.place("2026-11-19T12:00:00.000Z");
    expect(await runFamilyUpdatePass(s.env, { now: day1 })).toEqual({ skipped: "email_sending_off", sent: 0, notSent: 0 });
    expect(s.notices()).toEqual([]);
  });

  it("tells a relative who asked, once a day, with only a link and a one-click unsubscribe", async () => {
    const s = await setup();
    s.place("2026-11-19T12:00:00.000Z");
    expect(await runFamilyUpdatePass(s.env, { now: day1 })).toEqual({ skipped: null, sent: 1, notSent: 0 });
    const message = s.sent[0]!;
    expect(message.to).toBe("Member@Example.test");
    expect(message.text).toContain("https://app.example.test/family");
    expect(message.headers?.["List-Unsubscribe"]).toMatch(/^<https:\/\/app\.example\.test\/resources\/email\/unsubscribe\?t=.+>$/);
    expect(message.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    for (const part of [message.subject, message.text, message.html])
      for (const secret of ["La cocina de la tía María", "Familia Rivera", "Veranos", "owner_legacy_test", s.memory])
        expect(part).not.toContain(secret);
    // Once a day, and nothing again until something newer arrives.
    expect((await runFamilyUpdatePass(s.env, { now: day1 })).sent).toBe(0);
    expect((await runFamilyUpdatePass(s.env, { now: day2 })).sent).toBe(0);
    expect(s.notices()).toEqual([{ member_user_id: s.member, sent_on: "2026-11-20", status: "sent", code: null }]);
  });

  it("stays silent without the person's choice, for things from before they joined, and after access ends", async () => {
    const off = await setup({ preference: false });
    off.place("2026-11-19T12:00:00.000Z");
    expect((await runFamilyUpdatePass(off.env, { now: day1 })).sent).toBe(0);

    const early = await setup();
    early.place("2026-11-18T12:00:00.000Z");
    expect((await runFamilyUpdatePass(early.env, { now: day1 })).sent).toBe(0);

    const revoked = await setup();
    revoked.place("2026-11-19T12:00:00.000Z");
    revoked.db.prepare("UPDATE family_access_grants SET state='revoked' WHERE id='grant_updates'").run();
    expect((await runFamilyUpdatePass(revoked.env, { now: day1 })).sent).toBe(0);
    expect(revoked.sent).toEqual([]);
  });

  it("tells them when the owner includes someone else's recollection, but not their own", async () => {
    const s = await setup(),
      at = "2026-11-19T12:00:00.000Z";
    // The memory was shared before they joined; only the inclusion is new.
    s.place("2026-11-18T12:00:00.000Z");
    const include = (id: string, author: string) => {
      s.db.prepare("INSERT INTO family_contributions(id,memory_story_id,owner_user_id,author_user_id,author_state,latest_revision_id,included_revision_id,created_at,updated_at) VALUES(?,?,?,?,'submitted',?,?,?,?)")
        .run(id, s.memory, "owner_legacy_test", author, `${id}_r1`, `${id}_r1`, at, at);
      s.db.prepare("INSERT INTO family_contribution_events(id,contribution_id,actor_user_id,action,revision_id,created_at) VALUES(?,?,?,'included',?,?)")
        .run(`${id}_e`, id, "owner_legacy_test", `${id}_r1`, at);
    };
    include("contribution_own", s.member);
    expect((await runFamilyUpdatePass(s.env, { now: day1 })).sent).toBe(0);
    include("contribution_other", "owner_legacy_test");
    expect((await runFamilyUpdatePass(s.env, { now: day1 })).sent).toBe(1);
  });

  it("does not send links it cannot build", async () => {
    const s = await setup();
    s.place("2026-11-19T12:00:00.000Z");
    delete (s.env as unknown as Record<string, unknown>).PUBLIC_APP_ORIGIN;
    expect(await runFamilyUpdatePass(s.env, { now: day1 })).toEqual({ skipped: "email_links_unconfigured", sent: 0, notSent: 0 });
  });
});
