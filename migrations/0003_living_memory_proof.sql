PRAGMA foreign_keys = ON;

-- Storyteller-owned context replaces new runtime use of legacy truth-state facts.
-- These rows describe what the storyteller wants attached to their memory.
CREATE TABLE living_memory_context_entries (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'place', 'time', 'event')),
  value TEXT,
  context_state TEXT NOT NULL CHECK (context_state IN ('stated', 'approximate', 'unknown', 'omitted')),
  source_type TEXT NOT NULL DEFAULT 'storyteller' CHECK (source_type = 'storyteller'),
  source_ref TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (context_state IN ('stated', 'approximate') AND value IS NOT NULL AND length(trim(value)) > 0) OR
    (context_state IN ('unknown', 'omitted') AND value IS NULL)
  )
);

CREATE INDEX living_memory_context_story_kind_idx
  ON living_memory_context_entries (memory_story_id, kind, created_at);

CREATE TRIGGER living_memory_context_owner_only
BEFORE INSERT ON living_memory_context_entries
WHEN NOT EXISTS (
  SELECT 1 FROM memory_stories
  WHERE id = NEW.memory_story_id AND owner_user_id = NEW.created_by_user_id
)
BEGIN
  SELECT RAISE(ABORT, 'story context must be created by the Living Memory owner');
END;
-- Product-level events are distinct from low-level preservation events.
CREATE TABLE product_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'first_living_memory_started',
    'first_living_memory_completed',
    'living_memory_share_prompt_viewed',
    'living_memory_share_started',
    'living_memory_share_artifact_created',
    'living_memory_share_opened',
    'living_memory_referred_visitor',
    'referred_first_living_memory_started',
    'referred_first_living_memory_completed'
  )),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  memory_story_id TEXT REFERENCES memory_stories(id) ON DELETE SET NULL,
  session_id TEXT,
  referral_id TEXT,
  share_channel TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL
);

CREATE INDEX product_events_story_time_idx
  ON product_events (memory_story_id, occurred_at);

CREATE UNIQUE INDEX product_events_first_completion_once_per_user
  ON product_events (user_id, event_name)
  WHERE event_name = 'first_living_memory_completed' AND user_id IS NOT NULL;
-- A Share Artifact is an explicit allowlist projection, not a view over the
-- private archive. Arbitrary private metadata has nowhere to be stored here.
CREATE TABLE living_memory_share_artifacts (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL UNIQUE REFERENCES memory_story_shares(id) ON DELETE CASCADE,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  include_photo INTEGER NOT NULL DEFAULT 1 CHECK (include_photo = 1),
  include_voice INTEGER NOT NULL DEFAULT 1 CHECK (include_voice IN (0, 1)),
  include_captions INTEGER NOT NULL DEFAULT 0 CHECK (include_captions IN (0, 1)),
  include_narrator_attribution INTEGER NOT NULL DEFAULT 0 CHECK (include_narrator_attribution IN (0, 1)),
  include_brand_attribution INTEGER NOT NULL DEFAULT 1 CHECK (include_brand_attribution IN (0, 1)),
  caption TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX living_memory_share_artifacts_owner_story_idx
  ON living_memory_share_artifacts (owner_user_id, memory_story_id);

CREATE TRIGGER living_memory_share_artifact_owner_match
BEFORE INSERT ON living_memory_share_artifacts
WHEN NOT EXISTS (
  SELECT 1
  FROM memory_story_shares s
  JOIN memory_stories m ON m.id = s.memory_story_id
  WHERE s.id = NEW.share_id
    AND s.memory_story_id = NEW.memory_story_id
    AND s.owner_user_id = NEW.owner_user_id
    AND m.owner_user_id = NEW.owner_user_id
)
BEGIN
  SELECT RAISE(ABORT, 'share artifact owner/story scope mismatch');
END;
