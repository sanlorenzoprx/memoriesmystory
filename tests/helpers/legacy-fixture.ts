/// <reference types="@cloudflare/workers-types" />
import { TestD1, TestR2 } from "./legacy-runtime";
import { createAppSession } from "../../worker/auth-session";
import { handleLegacySessionRoute } from "../../worker/legacy-sessions";
import { handleLegacyRecordingRoute } from "../../worker/legacy-recordings";
export async function setupLegacyFixture(
  mode: "in_person" | "remote" = "in_person",
) {
  const db = new TestD1(),
    bucket = new TestR2();
  const env = {
    DB: db as unknown as D1Database,
    MEDIA_BUCKET: bucket as unknown as R2Bucket,
    SESSION_SECRET: "synthetic-legacy-secret-".repeat(3),
  };
  const now = new Date().toISOString(),
    user = "owner_legacy_test",
    memory = "memory_legacy_test";
  db.database
    .prepare("INSERT INTO users(id,created_at,updated_at) VALUES(?,?,?)")
    .run(user, now, now);
  db.database
    .prepare("INSERT INTO story_entitlements(user_id,updated_at) VALUES(?,?)")
    .run(user, now);
  db.database
    .prepare(
      "INSERT INTO memory_story_drafts(id,owner_user_id,status,ui_locale,created_at,updated_at,expires_at) VALUES(?,?,'complete','en-US',?,?,'2099-01-01T00:00:00Z')",
    )
    .run(memory, user, now, now);
  db.database
    .prepare(
      "INSERT INTO memory_stories(id,owner_user_id,status,created_at,updated_at) VALUES(?,?,'draft',?,?)",
    )
    .run(memory, user, now, now);
  for (const role of ["original_photo", "original_audio"]) {
    const id = `asset_legacy_${role}`;
    db.database
      .prepare(
        "INSERT INTO media_assets(id,draft_id,memory_story_id,role,r2_key,content_type,byte_size,sha256,r2_etag,durability_status,created_at) VALUES(?,?,?,?,?,?,4,?,'etag','durable',?)",
      )
      .run(
        id,
        memory,
        memory,
        role,
        id,
        role === "original_photo" ? "image/png" : "audio/webm",
        "a".repeat(64),
        now,
      );
    await bucket.put(id, new Uint8Array([1, 2, 3, 4]).buffer);
  }
  db.database
    .prepare(
      "UPDATE memory_stories SET status='complete',completed_at=?,primary_photo_asset_id='asset_legacy_original_photo',primary_audio_asset_id='asset_legacy_original_audio' WHERE id=?",
    )
    .run(now, memory);
  const owner = (await createAppSession(env, user)).cookie.split(";")[0]!;
  async function call(
    path = "",
    method = "GET",
    body?: unknown,
    cookie = owner,
    key = "legacy_request_001",
  ) {
    return (await (
      path.includes("/recordings")
        ? handleLegacyRecordingRoute
        : handleLegacySessionRoute
    )(
      new Request(`https://example.test/resources/legacy-sessions${path}`, {
        method,
        headers: {
          Cookie: cookie,
          "X-Memories-Request": "legacy-v1",
          "X-Idempotency-Key": key,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    ))!;
  }
  async function create() {
    const response = await call("", "POST", {
      memoryId: memory,
      displayName: "Host",
      mode,
    });
    if (response.status !== 201)
      throw new Error(`Fixture creation failed: ${response.status}`);
    return (await response.json()) as { sessionId: string; joinPath: string };
  }
  async function join(id: string, path: string, key = "legacy_guest_join_001") {
    return call(
      `/${id}/join`,
      "POST",
      { displayName: "Guest", inviteToken: path.split("#")[1] },
      "",
      key,
    );
  }
  return { db, bucket, env, owner, memory, call, create, join };
}
