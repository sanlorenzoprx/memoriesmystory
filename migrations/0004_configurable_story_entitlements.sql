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

-- Completion capacity is a persistence invariant, not a UI promise. The BEFORE
-- trigger blocks a draft->complete transition without available entitlement.
CREATE TRIGGER memory_stories_complete_requires_entitlement
BEFORE UPDATE OF status ON memory_stories
WHEN OLD.status = 'draft' AND NEW.status = 'complete'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM story_entitlements
    WHERE user_id = NEW.owner_user_id
      AND free_stories_completed < free_stories_unlocked
  ) THEN RAISE(ABORT, 'completion requires an available story entitlement') END;
END;

-- Consume exactly once because this runs only on the draft->complete transition.
CREATE TRIGGER memory_stories_complete_consumes_entitlement
AFTER UPDATE OF status ON memory_stories
WHEN OLD.status = 'draft' AND NEW.status = 'complete'
BEGIN
  UPDATE story_entitlements
  SET free_stories_completed = free_stories_completed + 1,
      updated_at = NEW.updated_at
  WHERE user_id = NEW.owner_user_id;
END;
