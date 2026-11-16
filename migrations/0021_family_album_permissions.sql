-- Owner-granted permission for one invited relative to organize albums.
-- It is never implied by an invitation: the owner turns it on per person.
CREATE TABLE family_album_permissions (
 grant_id TEXT PRIMARY KEY REFERENCES family_access_grants(id) ON DELETE CASCADE,
 granted_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL
);
CREATE TRIGGER family_album_permission_owner BEFORE INSERT ON family_album_permissions
WHEN NOT EXISTS(SELECT 1 FROM family_access_grants g WHERE g.id=NEW.grant_id AND g.owner_user_id=NEW.granted_by_user_id AND g.state='accepted')
BEGIN SELECT RAISE(ABORT,'family_album_permission_owner'); END;
CREATE TRIGGER family_album_permission_immutable BEFORE UPDATE ON family_album_permissions
BEGIN SELECT RAISE(ABORT,'family_album_permission_immutable'); END;
CREATE TABLE family_album_permission_events (
 id TEXT PRIMARY KEY,
 grant_id TEXT NOT NULL REFERENCES family_access_grants(id) ON DELETE CASCADE,
 action TEXT NOT NULL CHECK(action IN ('allowed','removed')),
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 recorded_at TEXT NOT NULL
);
CREATE TRIGGER family_album_permission_events_immutable BEFORE UPDATE ON family_album_permission_events
BEGIN SELECT RAISE(ABORT,'family_album_permission_events_immutable'); END;
-- An album made by a permitted relative still belongs to the archive owner.
-- This records who made it, so the relative can change only their own albums.
CREATE TABLE family_album_authors (
 archive_id TEXT PRIMARY KEY REFERENCES family_archives(id) ON DELETE CASCADE,
 author_user_id TEXT NOT NULL REFERENCES users(id),
 grant_id TEXT NOT NULL REFERENCES family_access_grants(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL
);
CREATE INDEX family_album_authors_author ON family_album_authors(author_user_id,grant_id);
CREATE TRIGGER family_album_author_scope BEFORE INSERT ON family_album_authors
WHEN NOT EXISTS(SELECT 1 FROM family_archives a JOIN family_access_grants g ON g.owner_user_id=a.owner_user_id JOIN family_album_permissions p ON p.grant_id=g.id WHERE a.id=NEW.archive_id AND g.id=NEW.grant_id AND g.state='accepted' AND g.accepted_by_user_id=NEW.author_user_id)
BEGIN SELECT RAISE(ABORT,'family_album_author_scope'); END;
CREATE TRIGGER family_album_author_immutable BEFORE UPDATE ON family_album_authors
BEGIN SELECT RAISE(ABORT,'family_album_author_immutable'); END;
-- A memory may be placed in a Chapter by the archive owner or by the relative
-- recorded as the maker of that album. It must still be the owner's complete memory.
DROP TRIGGER family_chapter_member_scope;
CREATE TRIGGER family_chapter_member_scope BEFORE INSERT ON family_chapter_memories
WHEN NOT EXISTS(SELECT 1 FROM family_chapters c JOIN family_archives a ON a.id=c.archive_id JOIN memory_stories m ON m.owner_user_id=a.owner_user_id WHERE c.id=NEW.chapter_id AND m.id=NEW.memory_story_id AND m.status='complete' AND (a.owner_user_id=NEW.added_by_user_id OR EXISTS(SELECT 1 FROM family_album_authors x WHERE x.archive_id=a.id AND x.author_user_id=NEW.added_by_user_id)))
BEGIN SELECT RAISE(ABORT,'chapter reference requires an owned complete Living Memory'); END;
