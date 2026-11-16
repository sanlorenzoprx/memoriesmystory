-- Talk with Muse M2 (decision 2026-11-16): what Muse remembers is the
-- person's own confirmed context, already stored with its source on each
-- Living Memory. This table only records what the person asked Muse to stop
-- bringing up in other memories. The memory's own context is never changed
-- or deleted by it. Removing the context entry or the memory removes the row.
CREATE TABLE muse_memory_exclusions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context_entry_id TEXT NOT NULL REFERENCES living_memory_context_entries(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, context_entry_id)
);

CREATE INDEX muse_memory_exclusions_entry_idx ON muse_memory_exclusions (context_entry_id);

-- Only the owner of the memory may tell Muse to forget its context.
CREATE TRIGGER muse_memory_exclusions_owner_only
BEFORE INSERT ON muse_memory_exclusions
WHEN NOT EXISTS (
  SELECT 1 FROM living_memory_context_entries c
  JOIN memory_stories m ON m.id = c.memory_story_id
  WHERE c.id = NEW.context_entry_id AND m.owner_user_id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'only the memory owner can change what Muse remembers');
END;
