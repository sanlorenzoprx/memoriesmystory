PRAGMA foreign_keys = ON;

-- The original Phase 1 schema hard-coded the superseded five-story Good Karma
-- model. Preserve existing rows, but allow the centrally configured product
-- limit (currently one free Living Memory) for new/updated accounts.
CREATE TABLE story_entitlements_next (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan = 'free'),
  free_story_limit INTEGER NOT NULL DEFAULT 1 CHECK (free_story_limit >= 1),
  free_stories_unlocked INTEGER NOT NULL DEFAULT 1,
  free_stories_completed INTEGER NOT NULL DEFAULT 0,
  paid_story_capacity INTEGER NOT NULL DEFAULT 0 CHECK (paid_story_capacity >= 0),
  updated_at TEXT NOT NULL,
  CHECK (free_stories_unlocked BETWEEN 1 AND free_story_limit),
  CHECK (free_stories_completed BETWEEN 0 AND free_stories_unlocked)
);

INSERT INTO story_entitlements_next (
  user_id,
  plan,
  free_story_limit,
  free_stories_unlocked,
  free_stories_completed,
  paid_story_capacity,
  updated_at
)
SELECT
  user_id,
  plan,
  free_story_limit,
  free_stories_unlocked,
  free_stories_completed,
  paid_story_capacity,
  updated_at
FROM story_entitlements;

DROP TABLE story_entitlements;
ALTER TABLE story_entitlements_next RENAME TO story_entitlements;
