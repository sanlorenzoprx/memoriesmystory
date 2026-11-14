import { randomUUID, createHash } from "node:crypto";
import { Buffer } from "node:buffer";

// Operator-only synthetic check. Uses the actual private application routes.
export async function verifyPrivateChapters({
  runtime,
  db,
  bucket,
  owner,
  guest,
  memoryId,
}) {
  const snapshot = async () => {
    const rows = (
      await db
        .prepare(
          "SELECT id,r2_key,sha256,byte_size FROM legacy_remote_sources ORDER BY id",
        )
        .all()
    ).results;
    const result = [];
    for (const row of rows) {
      const object = await bucket.get(row.r2_key);
      if (!object) throw new Error("chapter_source_missing");
      const bytes = Buffer.from(await object.arrayBuffer());
      result.push({
        ...row,
        actualHash: createHash("sha256").update(bytes).digest("hex"),
        actualSize: bytes.length,
      });
    }
    if (result.length < 3) throw new Error("chapter_sources_missing");
    return JSON.stringify(result);
  };
  const before = await snapshot();
  async function call(
    path = "",
    method = "GET",
    body,
    cookie = owner,
    key = `chapter_proof_${randomUUID()}`,
  ) {
    return runtime.dispatchFetch(
      `https://example.test/resources/family-archives${path}`,
      {
        method,
        headers: {
          Cookie: cookie,
          "X-Memories-Request": "family-v1",
          "X-Idempotency-Key": key,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
  }
  async function expect(response, status) {
    if (response.status !== status)
      throw new Error("chapter_route_check_failed");
    return response.json();
  }
  for (const cookie of ["", guest]) {
    await expect(await call("", "GET", undefined, cookie), 401);
    await expect(
      await call("/archives", "POST", { title: "Denied" }, cookie),
      401,
    );
  }
  const archive = await expect(
    await call("/archives", "POST", { title: "Synthetic private family" }),
    201,
  );
  const chapters = [];
  for (const title of ["Synthetic Chapter A", "Synthetic Chapter B"]) {
    const chapter = await expect(
      await call("/chapters", "POST", { archiveId: archive.id, title }),
      201,
    );
    const body = { version: 1, memoryIds: [memoryId], coverMemoryId: memoryId },
      key = `chapter_retry_${randomUUID()}`;
    await expect(
      await call(`/chapters/${chapter.id}`, "PATCH", body, owner, key),
      200,
    );
    const replay = await expect(
      await call(`/chapters/${chapter.id}`, "PATCH", body, owner, key),
      200,
    );
    if (!replay.replayed || replay.version !== 2)
      throw new Error("chapter_retry_failed");
    await expect(
      await call(`/chapters/${chapter.id}`, "PATCH", {
        ...body,
        title: "Stale",
      }),
      409,
    );
    const view = await expect(await call(`/chapters/${chapter.id}`), 200);
    if (
      view.chapter.coverMemoryId !== memoryId ||
      JSON.stringify(view.chapter.memoryIds) !== JSON.stringify([memoryId])
    )
      throw new Error("chapter_references_failed");
    chapters.push(chapter.id);
  }
  await expect(
    await call(`/chapters/${chapters[0]}`, "DELETE", { version: 2 }),
    200,
  );
  await expect(
    await call(`/archives/${archive.id}`, "DELETE", { version: 1 }),
    200,
  );
  const memory = await db
    .prepare("SELECT status FROM memory_stories WHERE id=?")
    .bind(memoryId)
    .first();
  const references = await db
    .prepare(
      "SELECT count(*) AS n FROM family_chapter_memories WHERE memory_story_id=?",
    )
    .bind(memoryId)
    .first();
  if (
    memory?.status !== "complete" ||
    references?.n !== 0 ||
    before !== (await snapshot())
  )
    throw new Error("chapter_preservation_failed");
  return true;
}
