-- Durable voice replies inside the Muse conversation.
-- These are storyteller testimony, preserved separately from the primary story recording.
CREATE TABLE muse_voice_reply_assets (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  reply_to_turn_id TEXT NOT NULL REFERENCES muse_conversation_turns(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 100 AND duration_ms <= 31000),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  r2_etag TEXT,
  durability_status TEXT NOT NULL CHECK (durability_status IN ('pending', 'durable', 'failed')),
  transcript_text TEXT,
  transcript_locale TEXT,
  transcription_model_config_version TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  transcribed_at TEXT,
  CHECK (durability_status <> 'durable' OR r2_etag IS NOT NULL),
  CHECK (
    (transcript_text IS NULL AND transcribed_at IS NULL) OR
    (transcript_text IS NOT NULL AND length(trim(transcript_text)) > 0 AND transcribed_at IS NOT NULL)
  )
);

CREATE INDEX muse_voice_reply_story_time_idx
  ON muse_voice_reply_assets (memory_story_id, created_at);

CREATE INDEX muse_voice_reply_question_idx
  ON muse_voice_reply_assets (reply_to_turn_id, created_at);

ALTER TABLE muse_conversation_turns
  ADD COLUMN reply_to_turn_id TEXT;

ALTER TABLE muse_conversation_turns
  ADD COLUMN voice_reply_asset_id TEXT;
