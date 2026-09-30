-- Muse conversational story elicitation.
-- Dialogue is preserved separately from storyteller-owned context.
CREATE TABLE muse_conversation_turns (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL CHECK (turn_index >= 0),
  speaker TEXT NOT NULL CHECK (speaker IN ('muse', 'storyteller')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 4000),
  focus_kind TEXT CHECK (
    focus_kind IS NULL OR focus_kind IN (
      'person', 'place', 'time', 'event',
      'detail', 'meaning', 'sensory', 'emotion', 'sequence', 'open'
    )
  ),
  response_state TEXT CHECK (
    response_state IS NULL OR response_state IN ('stated', 'approximate', 'unknown', 'omitted')
  ),
  source_ref TEXT,
  model_config_version TEXT,
  prompt_version TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (memory_story_id, turn_index)
);

CREATE INDEX muse_conversation_story_turn_idx
  ON muse_conversation_turns (memory_story_id, turn_index);
