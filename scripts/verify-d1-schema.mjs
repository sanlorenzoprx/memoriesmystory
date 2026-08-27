import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const foundationMigration = await readFile(
  new URL("../migrations/0001_phase_1_foundation.sql", import.meta.url),
  "utf8"
);
const accountBindingMigration = await readFile(
  new URL("../migrations/0002_account_binding_recovery.sql", import.meta.url),
  "utf8"
);
const database = new DatabaseSync(":memory:");

try {
  database.exec(foundationMigration);
  database.exec(accountBindingMigration);

  const objects = database
    .prepare(
      "SELECT type, name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
    )
    .all();
  const names = new Set(objects.map((object) => object.name));
  const requiredObjects = [
    "users",
    "auth_principals",
    "user_sessions",
    "draft_ownership_claims",
    "billing_customer_links",
    "memory_story_drafts",
    "memory_stories",
    "media_assets",
    "transcript_revisions",
    "story_entitlements",
    "memory_story_shares",
    "share_events",
    "operation_receipts",
    "memory_story_events",
    "media_assets_immutable_original_identity",
    "memory_stories_complete_requires_originals",
    "memory_stories_complete_insert_forbidden",
    "memory_stories_cannot_reopen_complete",
    "transcript_revisions_append_only",
    "draft_ownership_claim_requires_owner",
    "draft_ownership_claims_immutable"
  ];

  for (const name of requiredObjects) {
    assert(names.has(name), `D1 schema is missing required object: ${name}`);
  }

  database.exec(`
    INSERT INTO memory_story_drafts (
      id, status, ui_locale, created_at, updated_at, expires_at, version
    ) VALUES (
      'draft-1', 'local_draft', 'en-US', '2026-07-16T00:00:00Z',
      '2026-07-16T00:00:00Z', '2026-08-16T00:00:00Z', 1
    );
    INSERT INTO media_assets (
      id, draft_id, role, r2_key, content_type, byte_size, sha256,
      r2_etag, durability_status, created_at
    ) VALUES (
      'asset-1', 'draft-1', 'original_photo',
      'drafts/draft-1/assets/asset-1/original.jpg', 'image/jpeg', 100,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'etag-1', 'durable', '2026-07-16T00:00:00Z'
    );
  `);

  assert.throws(
    () =>
      database.exec(`
        UPDATE media_assets
        SET sha256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        WHERE id = 'asset-1';
      `),
    /immutable original/
  );

  database.exec(`
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES ('user-1', 'owner@example.test', '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z');
    INSERT INTO memory_stories (
      id, owner_user_id, status, visibility, created_at, updated_at, version
    ) VALUES (
      'story-1', 'user-1', 'draft', 'private', '2026-07-16T00:00:00Z',
      '2026-07-16T00:00:00Z', 1
    );
  `);

  assert.throws(
    () =>
      database.exec(`
        INSERT INTO memory_stories (
          id, owner_user_id, status, visibility, primary_photo_asset_id,
          primary_audio_asset_id, created_at, completed_at, updated_at, version
        ) VALUES (
          'story-invalid', 'user-1', 'complete', 'private', 'asset-1', 'asset-2',
          '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z',
          '2026-07-16T00:00:00Z', 1
        );
      `),
    /finalized from a durable draft state/
  );

  assert.throws(
    () =>
      database.exec(`
        UPDATE memory_stories
        SET status = 'complete', completed_at = '2026-07-16T00:00:01Z'
        WHERE id = 'story-1';
      `),
    /durable original photo/
  );

  database.exec(`
    UPDATE media_assets SET memory_story_id = 'story-1' WHERE id = 'asset-1';
    INSERT INTO media_assets (
      id, draft_id, memory_story_id, role, r2_key, content_type, byte_size,
      duration_ms, sha256, r2_etag, durability_status, created_at
    ) VALUES (
      'asset-2', 'draft-1', 'story-1', 'original_audio',
      'drafts/draft-1/assets/asset-2/original.webm', 'audio/webm', 200, 30000,
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'etag-2', 'durable', '2026-07-16T00:00:00Z'
    );
    UPDATE memory_stories
    SET status = 'complete', primary_photo_asset_id = 'asset-1',
        primary_audio_asset_id = 'asset-2', completed_at = '2026-07-16T00:00:01Z',
        updated_at = '2026-07-16T00:00:01Z', version = 2
    WHERE id = 'story-1';
  `);

  assert.throws(
    () => database.exec("UPDATE memory_stories SET status = 'draft' WHERE id = 'story-1';"),
    /cannot return to draft/
  );

  const integrity = database.prepare("PRAGMA integrity_check").get();
  const foreignKeyFailures = database.prepare("PRAGMA foreign_key_check").all();

  assert.equal(integrity.integrity_check, "ok");
  assert.deepEqual(foreignKeyFailures, []);
  console.log(
    `D1 schema verified: ${requiredObjects.length} required objects, integrity, foreign keys, immutable originals, and fail-closed completion.`
  );
} finally {
  database.close();
}
