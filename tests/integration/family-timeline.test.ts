/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { addSyntheticMemory, setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleFamilyTimelineRoute } from "../../worker/family-timeline";
import type { FamilyTimelineResponse } from "../../app/domain/family-timeline";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});

describe("owner timeline of when the storyteller said memories happened", () => {
  it("returns the current answer unchanged, keeps approximate and unknown, and never another account's memories", async () => {
    const s = await setupLegacyFixture();
    cleanup.push(() => s.db.close());
    const db = s.db.database,
      owner = "owner_legacy_test",
      second = await addSyntheticMemory(s, "memory_timeline_second"),
      third = await addSyntheticMemory(s, "memory_timeline_third");
    db.prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)").run(s.memory, "Abuela's kitchen", owner, "2026-11-15T00:00:00Z");
    const context = db.prepare("INSERT INTO living_memory_context_entries(id,memory_story_id,kind,value,context_state,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)");
    context.run("timeline_old", s.memory, "time", "1949", "stated", owner, "2026-11-14T00:00:00Z", "2026-11-14T00:00:00Z");
    context.run("timeline_new", s.memory, "time", "verano de 1950, creo", "approximate", owner, "2026-11-15T00:00:00Z", "2026-11-15T00:00:00Z");
    context.run("timeline_place", s.memory, "place", "Ponce 1999", "stated", owner, "2026-11-15T00:00:00Z", "2026-11-15T00:00:00Z");
    context.run("timeline_second", second, "time", "one Christmas", "stated", owner, "2026-11-15T00:00:00Z", "2026-11-15T00:00:00Z");
    context.run("timeline_third", third, "time", null, "unknown", owner, "2026-11-15T00:00:00Z", "2026-11-15T00:00:00Z");
    db.prepare("INSERT INTO users(id,created_at,updated_at) VALUES('timeline_stranger','2026-11-15T00:00:00Z','2026-11-15T00:00:00Z')").run();
    const stranger = (await createAppSession(s.env, "timeline_stranger")).cookie.split(";")[0];
    const call = (cookie: string, method = "GET") =>
      handleFamilyTimelineRoute(new Request("https://example.test/resources/family-timeline", { method, headers: { Cookie: cookie } }), s.env);

    const response = (await call(s.owner))!;
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const { entries, truncated } = (await response.json()) as FamilyTimelineResponse;
    expect(truncated).toBe(false);
    const byId = new Map(entries.map((entry) => [entry.memoryId, entry]));
    // The superseded "1949" and the place's "1999" never reach the timeline.
    expect(byId.get(s.memory)).toEqual({
      memoryId: s.memory,
      title: "Abuela's kitchen",
      when: { text: "verano de 1950, creo", approximate: true },
      orderingYear: 1950,
    });
    expect(byId.get(second)).toMatchObject({ when: { text: "one Christmas", approximate: false }, orderingYear: null });
    expect(byId.get(third)).toMatchObject({ when: null, orderingYear: null });

    expect(((await (await call(stranger))!.json()) as FamilyTimelineResponse).entries).toEqual([]);
    expect((await call(""))!.status).toBe(401);
    expect((await call(s.owner, "POST"))!.status).toBe(405);
  });
});
