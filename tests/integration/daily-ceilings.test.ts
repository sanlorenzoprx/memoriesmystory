/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it } from "vitest";
import { setupLegacyFixture } from "../helpers/legacy-fixture";
import { ceilingOperation, enforceDailyCeiling } from "../../worker/usage-ceilings";
import { phase1Config } from "../../config/phase-1";

const cleanup: (() => void)[] = [];
const ceilings = phase1Config.dailyCeilings as Record<string, number>;
const original = { ...ceilings };
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  Object.assign(ceilings, original);
});

const post = (path: string, cookie: string) =>
  new Request(`https://example.test${path}`, { method: "POST", headers: { Cookie: cookie } });

describe("per-account daily ceilings (L5.4)", () => {
  it("counts only budget-spending operations, never uploads, saves or reads", () => {
    expect(ceilingOperation(post("/resources/drafts/draft_12345678/muse", ""))).toBe("muse");
    expect(ceilingOperation(post("/resources/drafts/draft_12345678/muse-tts", ""))).toBe("muse_speech");
    expect(ceilingOperation(post("/resources/drafts/draft_12345678/muse-voice-replies/turn_12345678", ""))).toBe("voice_reply");
    expect(ceilingOperation(post("/resources/drafts/draft_12345678/process", ""))).toBe("transcription");
    expect(ceilingOperation(post("/resources/legacy-sessions/session_1234/call", ""))).toBe("call");
    expect(ceilingOperation(post("/resources/drafts/draft_12345678/media", ""))).toBeNull();
    expect(ceilingOperation(post("/resources/drafts/draft_12345678/complete", ""))).toBeNull();
    expect(ceilingOperation(new Request("https://example.test/resources/drafts/draft_12345678/muse"))).toBeNull();
  });

  it("refuses past the ceiling for that person and operation only, and says nothing was lost", async () => {
    const s = await setupLegacyFixture();
    cleanup.push(() => s.db.close());
    ceilings.transcription = 2;
    const path = `/resources/drafts/${s.memory}/process`;
    expect(await enforceDailyCeiling(post(path, s.owner), s.env)).toBeNull();
    expect(await enforceDailyCeiling(post(path, s.owner), s.env)).toBeNull();
    const refused = (await enforceDailyCeiling(post(path, s.owner), s.env))!;
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: { code: "daily_limit_reached" } });
    // Another operation is counted separately; without a session the address limits apply instead.
    expect(await enforceDailyCeiling(post(`/resources/drafts/${s.memory}/muse`, s.owner), s.env)).toBeNull();
    expect(await enforceDailyCeiling(post(path, ""), s.env)).toBeNull();
    expect(s.db.database.prepare("SELECT operation,count FROM account_daily_usage ORDER BY operation").all()).toEqual([
      { operation: "muse", count: 1 },
      { operation: "transcription", count: 2 },
    ]);
  });
});
