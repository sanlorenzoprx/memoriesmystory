/// <reference types="@cloudflare/workers-types" />
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { addSyntheticMemory, setupLegacyFixture } from "../helpers/legacy-fixture";
import { createAppSession } from "../../worker/auth-session";
import { handleArchiveExportRoute } from "../../worker/archive-export";
import { handleFamilyContributionRoute } from "../../worker/family-contributions";
import type { ArchiveExportManifest } from "../../app/domain/archive-export";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
const agreement = "family-contribution-review-v1";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function setup() {
  const s = await setupLegacyFixture();
  cleanup.push(() => s.db.close());
  const db = s.db.database,
    now = "2026-11-15T00:00:00.000Z",
    owner = "owner_legacy_test",
    archive = "family_export_archive";
  db.prepare("INSERT INTO family_archives(id,owner_user_id,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(archive, owner, "Synthetic family", "", now, now);
  db.prepare("INSERT INTO family_memory_labels(memory_story_id,title,updated_by_user_id,updated_at) VALUES(?,?,?,?)").run(s.memory, "La cocina de la tía María", owner, now);
  db.prepare("INSERT INTO family_chapters(id,archive_id,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("chapter_export_one", archive, "Summers", "Synthetic", now, now);
  db.prepare("INSERT INTO family_chapter_memories(chapter_id,memory_story_id,added_by_user_id,position,created_at) VALUES(?,?,?,0,?)").run("chapter_export_one", s.memory, owner, now);
  db.prepare("INSERT INTO family_people_records(id,archive_id,kind,document_json,created_by_user_id,created_at,updated_at) VALUES(?,?,'person',?,?,?,?)").run("person_export_one", archive, JSON.stringify({ label: "Abuelo Joaquín", notes: "", dateText: "", datePrecision: "unknown", memoryIds: [s.memory] }), owner, now, now);
  const context = db.prepare("INSERT INTO living_memory_context_entries(id,memory_story_id,kind,value,context_state,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)");
  context.run("export_time_old", s.memory, "time", "1949", "stated", owner, "2026-11-14T00:00:00.000Z", "2026-11-14T00:00:00.000Z");
  context.run("export_time_new", s.memory, "time", "about 1950", "approximate", owner, now, now);

  const cookies: Record<string, string> = { owner: s.owner },
    grants: Record<string, string> = {};
  for (const user of ["export_contributor", "export_stranger"]) {
    db.prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)").run(user, now, now);
    cookies[user] = (await createAppSession(s.env, user)).cookie.split(";")[0];
  }
  grants.export_contributor = "grant_export_contributor";
  db.prepare(
    "INSERT INTO family_access_grants(id,archive_id,owner_user_id,role,scope_kind,scope_id,target_email,token_hash,state,accepted_by_user_id,accepted_at,expires_at,created_at,updated_at) VALUES(?,?,?,'contributor','memory',?,?,?,'accepted',?,?,'2099-01-01T00:00:00Z',?,?)",
  ).run(grants.export_contributor, archive, owner, s.memory, "c@example.test", "hash_export", "export_contributor", now, now, now);
  const contribute = async (path: string, init: RequestInit & { headers: Record<string, string> }) =>
    (await handleFamilyContributionRoute(
      new Request(`https://example.test/resources/family-contributions/${s.memory}${path}?grantId=${grants.export_contributor}`, {
        method: "POST",
        ...init,
        headers: { Cookie: cookies.export_contributor, "X-Memories-Request": "family-v1", "X-Idempotency-Key": `export_key_${crypto.randomUUID()}`, ...init.headers },
      }),
      s.env,
    ))!;
  const voice = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 9, 8, 7, 6, 5, 4, 3, 2]);
  const voiceId = ((await (await contribute("/voice", {
    body: voice,
    headers: { "Content-Type": "audio/webm", "X-Content-SHA256": sha(voice), "X-Audio-Duration-MS": "9000", "X-Contribution-Attribution": encodeURIComponent("Prima Lucía"), "X-Contribution-Agree": "true", "X-Agreement-Version": agreement },
  })).json()) as { id: string }).id;
  await contribute(`/${voiceId}/transcript`, { body: JSON.stringify({ version: 1, text: "Dije que fue en mayo.", agree: true, agreementVersion: agreement }), headers: {} });
  const textId = ((await (await contribute("", { body: JSON.stringify({ attribution: "Prima Lucía", text: "Yo recuerdo 1951.", agree: true, agreementVersion: agreement }), headers: {} })).json()) as { id: string }).id;
  const withdrawnId = ((await (await contribute("", { body: JSON.stringify({ attribution: "Prima Lucía", text: "I take this back.", agree: true, agreementVersion: agreement }), headers: {} })).json()) as { id: string }).id;
  await contribute(`/${withdrawnId}/withdraw`, { body: JSON.stringify({ version: 1 }), headers: {} });

  const call = (actor: string, path: string, method = "GET") =>
    handleArchiveExportRoute(new Request(`https://example.test/resources/archive-export/${path}`, { method, headers: { Cookie: cookies[actor] ?? "" } }), s.env);
  async function manifest(actor = "owner") {
    const response = (await call(actor, "manifest"))!;
    expect(response.status).toBe(200);
    return { response, body: (await response.json()) as ArchiveExportManifest };
  }
  return { ...s, fixture: s, db, voice, voiceId, textId, withdrawnId, call, manifest };
}

describe("owner archive export", () => {
  it("lists every exportable source with a hash that matches the preserved bytes", async () => {
    const s = await setup(),
      { response, body } = await s.manifest();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toMatchObject({ format: "memoriesmystory-archive-export", formatVersion: 1 });
    const memory = body.memories.find((entry) => entry.id === s.memory)!;
    expect(memory.title).toBe("La cocina de la tía María");
    expect(memory.files.map((file) => file.role).sort()).toEqual(["family_voice_recollection", "original_photograph", "original_voice"]);
    // Round trip: every listed file downloads, and its bytes hash to the manifest value.
    for (const file of memory.files) {
      const download = (await s.call("owner", `file/${file.kind}/${file.id}`))!;
      expect(download.status).toBe(200);
      const bytes = new Uint8Array(await download.arrayBuffer());
      expect(bytes.byteLength).toBe(file.byteSize);
      // The shared fixture stores placeholder hashes for its two solo originals;
      // the contributed voice went through the real upload path and must match.
      if (file.kind === "contribution-voice") expect(sha(bytes)).toBe(file.sha256);
      expect(download.headers.get("X-Content-SHA256")).toBe(file.sha256);
      expect(file.path.startsWith(`memories/${s.memory}/${file.role}/`)).toBe(true);
    }
    const spoken = memory.files.find((file) => file.role === "family_voice_recollection")!;
    expect(spoken).toMatchObject({ attribution: "Prima Lucía", original: true, durationMs: 9000 });

    // Context history is kept, with only the latest answer marked current.
    expect(memory.storytellerContext.map((entry) => [entry.value, entry.state, entry.current])).toEqual([
      ["1949", "stated", false],
      ["about 1950", "approximate", true],
    ]);
    const voiceEntry = memory.familyContributions.find((entry) => entry.id === s.voiceId)!;
    expect(voiceEntry).toMatchObject({ kind: "human_voice", attribution: "Prima Lucía", byOwner: false, fileId: spoken.id });
    expect(voiceEntry.speakerWrittenWords.map((words) => words.text)).toEqual(["Dije que fue en mayo."]);
    expect(memory.familyContributions.find((entry) => entry.id === s.textId)!.writtenVersions.map((v) => v.text)).toEqual(["Yo recuerdo 1951."]);
    expect(body.chapters).toEqual([{ id: "chapter_export_one", title: "Summers", description: "Synthetic", memoryIds: [s.memory] }]);
    expect(body.people).toHaveLength(1);
  });

  it("never looks complete when something is left out, and leaves a withdrawn recollection out", async () => {
    const s = await setup(),
      { body } = await s.manifest(),
      text = JSON.stringify(body);
    expect(body.complete).toBe(false);
    expect(body.notIncluded).toContainEqual({ code: "recollections_withdrawn_by_their_author", count: 1 });
    expect(body.memories.flatMap((memory) => memory.familyContributions).some((entry) => entry.id === s.withdrawnId)).toBe(false);
    expect(text).not.toContain("I take this back.");
    // No storage keys, tokens or account identifiers leave in an export.
    for (const secret of ["contributions/", "r2_key", "token", "owner_legacy_test", "export_contributor", "grant_export_contributor", "example.test"])
      expect(text).not.toContain(secret);
  });

  it("exports nothing of another account's archive and nothing without a session", async () => {
    const s = await setup(),
      { body } = await s.manifest("export_stranger");
    expect(body.memories).toEqual([]);
    expect(body.chapters).toEqual([]);
    expect(body.people).toEqual([]);
    const owned = (await s.manifest()).body.memories.flatMap((memory) => memory.files);
    for (const file of owned) {
      expect((await s.call("export_stranger", `file/${file.kind}/${file.id}`))!.status).toBe(404);
      // A contributor cannot pull the owner's export either, even their own voice.
      expect((await s.call("export_contributor", `file/${file.kind}/${file.id}`))!.status).toBe(404);
      expect((await s.call("nobody", `file/${file.kind}/${file.id}`))!.status).toBe(401);
    }
    expect((await s.call("nobody", "manifest"))!.status).toBe(401);
    expect((await s.call("owner", "manifest", "POST"))!.status).toBe(405);
    // A file id is only valid under its own kind.
    expect((await s.call("owner", `file/voice-reply/${owned[0].id}`))!.status).toBe(404);
  });

  it("reports a missing stored object instead of serving a partial or empty file", async () => {
    const s = await setup(),
      file = (await s.manifest()).body.memories.flatMap((memory) => memory.files).find((entry) => entry.role === "family_voice_recollection")!;
    for (const key of [...s.bucket.objects.keys()].filter((key) => key.startsWith("contributions/"))) s.bucket.objects.delete(key);
    expect((await s.call("owner", `file/${file.kind}/${file.id}`))!.status).toBe(503);
  });

  it("includes a second memory and flags unfinished ones as not included", async () => {
    const s = await setup(),
      second = await addSyntheticMemory(s.fixture, "memory_export_second");
    s.db.prepare("INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES('draft_export_unfinished','owner_legacy_test','local_draft','en-US','2026-11-15T00:00:00Z','2026-11-15T00:00:00Z','2099-01-01T00:00:00Z')").run();
    s.db.prepare("INSERT INTO memory_stories(id,owner_user_id,status,created_at,updated_at) VALUES('draft_export_unfinished','owner_legacy_test','draft','2026-11-15T00:00:00Z','2026-11-15T00:00:00Z')").run();
    const { body } = await s.manifest();
    expect(body.memories.map((memory) => memory.id).sort()).toEqual([s.memory, second].sort());
    expect(body.notIncluded).toContainEqual({ code: "unfinished_memories", count: 1 });
  });
});
