import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const migrationsDirectory = new URL("../migrations/", import.meta.url);
const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();
const migrations = await Promise.all(
  migrationNames.map(async (name) => ({
    name,
    sql: await readFile(new URL(name, migrationsDirectory), "utf8")
  }))
);
const database = new DatabaseSync(":memory:");

try {
  for (const migration of migrations) {
    database.exec(migration.sql);
  }

  const objects = database
    .prepare(
      "SELECT type, name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
    )
    .all();
  const names = new Set(objects.map((object) => object.name));
  const requiredObjects = [
    "family_contributions","family_contributions_memory","family_contribution_revisions","family_contribution_revision_history","family_contribution_events","family_contribution_owner_insert","family_contribution_identity_immutable","family_contribution_revision_author","family_contribution_revision_immutable","family_contribution_event_immutable","family_contribution_previous_scope","family_contribution_voice_sources","family_contribution_voice_author","family_contribution_voice_immutable","family_contribution_voice_not_text","family_contribution_text_not_voice","family_contribution_sources","family_contribution_photo_sources","family_contribution_photo_author","family_contribution_photo_immutable","family_contribution_photo_single_kind","family_contribution_text_not_photo","family_contribution_voice_not_photo","family_contribution_voice_transcripts","family_contribution_voice_transcript_history","family_contribution_transcript_speaker","family_contribution_transcript_immutable","family_contribution_transcript_pins","family_contribution_transcript_pin_insert","family_contribution_transcript_pin_update","family_contribution_transcript_pin_clear",
    "family_access_grants","family_access_events","family_access_owner","family_access_member","family_access_owner_insert","family_access_identity_immutable","family_access_revocation_final","family_access_events_immutable",
    "family_people_records","family_people_history","family_people_archive","family_people_owner_insert","family_people_identity_immutable","family_people_history_immutable",
    "family_archives","family_chapters","family_chapter_memories","family_memory_labels",
    "family_archive_owner_immutable","family_chapter_move_scope","family_chapter_member_scope",
    "family_chapter_member_identity","family_chapter_cover_scope","family_chapter_cover_insert",
    "family_chapter_remove_cover","family_memory_label_scope","family_memory_label_owner",
    "legacy_remote_recordings",
    "legacy_remote_sources",
    "legacy_remote_source_claims",
    "legacy_remote_recording_usage",
    "legacy_remote_recording_create_scope",
    "legacy_remote_recording_preserved",
    "legacy_remote_recording_partial_preserved",
    "legacy_remote_source_durable_consent",
    "legacy_remote_source_receipt_immutable",
    "legacy_remote_recording_daily_limit",
    "archival_scan_provenance",
    "archival_scan_source_scope",
    "archival_scan_provenance_immutable",
    "archival_scan_identity_immutable",
    "living_memory_share_pins_legacy_captions",
    "living_memory_share_caption_revision_immutable",
    "living_memory_reviews",
    "living_memory_review_scope_version",
    "living_memory_reviews_append_only",
    "living_memory_context_append_only",
    "living_memory_context_bumps_story_version",
    "users",
    "auth_principals",
    "user_sessions",
    "draft_ownership_claims",
    "billing_customer_links",
    "deletion_receipts",
    "memory_story_drafts",
    "memory_stories",
    "media_assets",
    "transcript_revisions",
    "story_entitlements",
    "living_memory_context_entries",
    "muse_conversation_turns",
    "muse_voice_reply_assets",
    "product_events",
    "living_memory_share_artifacts",
    "memory_story_shares",
    "share_events",
    "operation_receipts",
    "memory_story_events",
    "media_assets_immutable_original_identity",
    "memory_stories_complete_requires_originals",
    "memory_stories_complete_insert_forbidden",
    "memory_stories_cannot_reopen_complete",
    "memory_stories_complete_requires_entitlement",
    "memory_stories_complete_consumes_entitlement",
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
    INSERT INTO story_entitlements (
      user_id, plan, free_story_limit, free_stories_unlocked,
      free_stories_completed, paid_story_capacity, updated_at
    ) VALUES (
      'user-1', 'free', 1, 1, 0, 0, '2026-07-16T00:00:00Z'
    );
    INSERT INTO memory_stories (
      id, owner_user_id, status, visibility, created_at, updated_at, version
    ) VALUES (
      'story-1', 'user-1', 'draft', 'private', '2026-07-16T00:00:00Z',
      '2026-07-16T00:00:00Z', 1
    );
  `);

  assert.deepEqual(
    {
      ...database.prepare(
        "SELECT free_story_limit, free_stories_unlocked, free_stories_completed FROM story_entitlements WHERE user_id = 'user-1'"
      ).get()
    },
    { free_story_limit: 1, free_stories_unlocked: 1, free_stories_completed: 0 }
  );

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

  assert.deepEqual(
    {
      ...database.prepare(
        "SELECT free_stories_completed FROM story_entitlements WHERE user_id = 'user-1'"
      ).get()
    },
    { free_stories_completed: 1 }
  );

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
