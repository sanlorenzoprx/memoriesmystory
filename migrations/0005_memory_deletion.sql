PRAGMA foreign_keys = ON;

-- Minimal audit receipt for a user-requested deletion. It retains no photograph,
-- audio, transcript, Muse output, context, share token, or other memory content.
CREATE TABLE deletion_receipts (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  memory_story_id TEXT,
  owner_user_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('owner', 'anonymous')),
  deleted_asset_count INTEGER NOT NULL CHECK (deleted_asset_count >= 0),
  deleted_at TEXT NOT NULL
);

CREATE INDEX deletion_receipts_owner_time_idx
  ON deletion_receipts (owner_user_id, deleted_at DESC);
