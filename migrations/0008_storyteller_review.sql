PRAGMA foreign_keys = ON;

-- An owner review is an attributable snapshot; edits never rewrite prior sources.
CREATE TABLE living_memory_reviews (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('edit', 'completion')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  base_story_version INTEGER NOT NULL CHECK (base_story_version > 0),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  source_photo_asset_id TEXT NOT NULL,
  source_audio_asset_id TEXT NOT NULL,
  transcript_revision_id TEXT,
  context_json TEXT NOT NULL CHECK (json_valid(context_json)),
  created_at TEXT NOT NULL,
  UNIQUE (memory_story_id, base_story_version)
);

CREATE INDEX living_memory_reviews_story_version_idx
  ON living_memory_reviews(memory_story_id, base_story_version DESC);

-- This insert is first in the same atomic D1 batch as its source/context changes.
-- A concurrent edit/completion must fail the whole batch, never partially save.
CREATE TRIGGER living_memory_review_scope_version
BEFORE INSERT ON living_memory_reviews
WHEN NOT EXISTS (
  SELECT 1 FROM memory_stories
  WHERE id = NEW.memory_story_id AND owner_user_id = NEW.created_by_user_id
    AND version = NEW.base_story_version
    AND primary_photo_asset_id = NEW.source_photo_asset_id
    AND primary_audio_asset_id = NEW.source_audio_asset_id
)
BEGIN
  SELECT RAISE(ABORT, 'story review version conflict');
END;

CREATE TRIGGER living_memory_reviews_append_only
BEFORE UPDATE ON living_memory_reviews
BEGIN
  SELECT RAISE(ABORT, 'story reviews are append only');
END;

CREATE TRIGGER living_memory_context_append_only
BEFORE UPDATE ON living_memory_context_entries
BEGIN
  SELECT RAISE(ABORT, 'story context is append only');
END;

-- Older Muse/context writers also invalidate a stale review opened elsewhere.
CREATE TRIGGER living_memory_context_bumps_story_version
AFTER INSERT ON living_memory_context_entries
BEGIN
  UPDATE memory_stories SET version = version + 1, updated_at = NEW.created_at
  WHERE id = NEW.memory_story_id;
END;

-- A shared artifact keeps the transcript selected when it was created. A later
-- private correction must not change the content available through an old link.
ALTER TABLE living_memory_share_artifacts ADD COLUMN transcript_revision_id TEXT;
UPDATE living_memory_share_artifacts
SET transcript_revision_id = (
  SELECT current_transcript_revision_id FROM memory_stories
  WHERE id = living_memory_share_artifacts.memory_story_id
)
WHERE include_captions = 1;

-- During a staged cutover the preceding Worker may still create artifacts.
-- Pin those captions too, before the new editing endpoint becomes available.
CREATE TRIGGER living_memory_share_pins_legacy_captions
AFTER INSERT ON living_memory_share_artifacts
WHEN NEW.include_captions = 1 AND NEW.transcript_revision_id IS NULL
BEGIN
  UPDATE living_memory_share_artifacts SET transcript_revision_id = (
    SELECT current_transcript_revision_id FROM memory_stories WHERE id = NEW.memory_story_id
  ) WHERE id = NEW.id;
END;

CREATE TRIGGER living_memory_share_caption_revision_immutable
BEFORE UPDATE OF transcript_revision_id ON living_memory_share_artifacts
WHEN OLD.transcript_revision_id IS NOT NULL AND NEW.transcript_revision_id IS NOT OLD.transcript_revision_id
BEGIN
  SELECT RAISE(ABORT, 'shared caption revision is immutable');
END;
