-- Talk with Muse M3 (decision 2026-11-16): what Muse could see in a
-- Living Memory's photograph, described without names, dates, places or
-- relationships. It is Muse-generated material, used only to shape Muse's
-- questions; it is never testimony and never replaces the storyteller's words.
CREATE TABLE muse_photo_notes (
  memory_story_id TEXT PRIMARY KEY REFERENCES memory_stories(id) ON DELETE CASCADE,
  photo_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 600),
  source_type TEXT NOT NULL DEFAULT 'muse_generated' CHECK (source_type = 'muse_generated'),
  model_config_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- The note must describe the memory's own original photograph.
CREATE TRIGGER muse_photo_notes_own_photo
BEFORE INSERT ON muse_photo_notes
WHEN NOT EXISTS (
  SELECT 1 FROM media_assets
  WHERE id = NEW.photo_asset_id AND memory_story_id = NEW.memory_story_id AND role = 'original_photo'
)
BEGIN
  SELECT RAISE(ABORT, 'a photo note must describe the memory''s own original photograph');
END;
