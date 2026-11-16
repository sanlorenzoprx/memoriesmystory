-- Talk with Muse M4a (decision 2026-11-16): the open conversation.
--
-- A person confirms once that they are an adult and that they understand
-- Muse is an AI; the confirmation is kept with its wording version. Each
-- conversation keeps its turns in order, the person's words exactly as
-- given, and records when Muse last said it is an AI and whether it has
-- suggested sharing with family. The person can delete a conversation.
CREATE TABLE muse_companion_consents (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disclosure_version TEXT NOT NULL,
  adult_confirmed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, disclosure_version)
);

CREATE TABLE muse_talks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ui_locale TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  last_disclosure_at TEXT NOT NULL,
  family_suggested_at TEXT
);

CREATE INDEX muse_talks_user_activity_idx ON muse_talks (user_id, last_activity_at DESC);

CREATE TABLE muse_talk_turns (
  id TEXT PRIMARY KEY,
  talk_id TEXT NOT NULL REFERENCES muse_talks(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL CHECK (turn_index >= 0),
  speaker TEXT NOT NULL CHECK (speaker IN ('muse', 'person')),
  kind TEXT NOT NULL CHECK (kind IN ('greeting', 'question', 'disclosure', 'support', 'family', 'words')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 4000),
  model_config_version TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (talk_id, turn_index),
  CHECK ((speaker = 'person') = (kind = 'words'))
);

-- The person's words are kept exactly as given.
CREATE TRIGGER muse_talk_turns_append_only
BEFORE UPDATE ON muse_talk_turns
BEGIN
  SELECT RAISE(ABORT, 'conversation turns are append only');
END;
