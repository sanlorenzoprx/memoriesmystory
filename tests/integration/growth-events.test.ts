/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleReferralRoute } from "../../worker/referral";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});
const ref = `ref_${"a1".repeat(12)}`;

async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const now = new Date().toISOString();
  s.db.database.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run("growth_newcomer", now, now);
  const newcomer = (await createAppSession(s.env, "growth_newcomer")).cookie.split(";")[0]!;
  const send = async (body: Record<string, unknown>, cookie = s.owner, header = true) =>
    (await handleReferralRoute(
      new Request("https://example.test/resources/growth/events", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json", ...(header ? { "X-Memories-Request": "growth-v1" } : {}) },
        body: JSON.stringify({ key: `key_${crypto.randomUUID().replace(/-/g, "")}`, ...body }),
      }),
      s.env,
    ))!;
  const rows = () =>
    s.db.database.prepare("SELECT event_name,user_id,memory_story_id,referral_id,share_channel FROM product_events ORDER BY rowid").all();
  return { ...s, newcomer, send, rows };
}

describe("content-free growth events (G03)", () => {
  it("records the share prompt once per memory and each share start with its channel", async () => {
    const s = await setup();
    expect((await s.send({ event: "share_prompt_viewed", memoryId: s.memory }, s.owner, false)).status).toBe(400);
    expect((await s.send({ event: "share_prompt_viewed", memoryId: s.memory }, "")).status).toBe(401);
    expect((await s.send({ event: "share_prompt_viewed", memoryId: s.memory }, s.newcomer)).status).toBe(400);
    expect((await s.send({ event: "share_prompt_viewed", memoryId: s.memory })).status).toBe(202);
    expect((await s.send({ event: "share_prompt_viewed", memoryId: s.memory })).status).toBe(202);
    expect((await s.send({ event: "share_started", memoryId: s.memory, channel: "telegram" })).status).toBe(400);
    expect((await s.send({ event: "share_started", memoryId: s.memory, channel: "whatsapp" })).status).toBe(202);
    expect(s.rows()).toEqual([
      { event_name: "living_memory_share_prompt_viewed", user_id: "owner_legacy_test", memory_story_id: s.memory, referral_id: null, share_channel: null },
      { event_name: "living_memory_share_started", user_id: "owner_legacy_test", memory_story_id: s.memory, referral_id: null, share_channel: "whatsapp" },
    ]);
  });

  it("records a referred visitor without an account, once per browser session key", async () => {
    const s = await setup(),
      key = `visit_${"b".repeat(20)}`;
    expect((await s.send({ event: "referred_visitor", ref: "ref_not_valid" }, "")).status).toBe(400);
    expect((await s.send({ event: "referred_visitor", ref, key }, "")).status).toBe(202);
    expect((await s.send({ event: "referred_visitor", ref, key }, "")).status).toBe(202);
    expect(s.rows()).toEqual([{ event_name: "living_memory_referred_visitor", user_id: null, memory_story_id: null, referral_id: ref, share_channel: null }]);
  });

  it("counts a referred first memory only when it really is the person's first, and only once", async () => {
    const s = await setup(),
      entitlement = () => s.db.database.prepare("SELECT free_stories_completed FROM story_entitlements WHERE user_id='owner_legacy_test'").get(),
      before = entitlement();
    expect((await s.send({ event: "referred_first_started", ref }, s.newcomer)).status).toBe(409);
    expect((await s.send({ event: "referred_first_completed", ref })).status).toBe(202);
    expect((await s.send({ event: "referred_first_completed", ref })).status).toBe(202);
    expect((await s.send({ event: "referred_first_started", ref })).status).toBe(202);
    expect(s.rows().map((row) => (row as { event_name: string }).event_name)).toEqual([
      "referred_first_living_memory_completed",
      "referred_first_living_memory_started",
    ]);
    // Recording an event grants nothing.
    expect(entitlement()).toEqual(before);
  });
});
