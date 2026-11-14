-- Organization references immutable Living Memories; it never copies their media.
CREATE TABLE family_archives (
 id TEXT PRIMARY KEY,
 owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX family_archives_owner ON family_archives(owner_user_id,created_at,id);
CREATE TRIGGER family_archive_owner_immutable BEFORE UPDATE OF owner_user_id,created_at ON family_archives
BEGIN SELECT RAISE(ABORT,'archive ownership is immutable'); END;
CREATE TABLE family_chapters (
 id TEXT PRIMARY KEY,
 archive_id TEXT NOT NULL REFERENCES family_archives(id) ON DELETE CASCADE,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility='private'),
 cover_memory_id TEXT REFERENCES memory_stories(id) ON DELETE SET NULL,
 position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX family_chapters_archive ON family_chapters(archive_id,position,created_at,id);
CREATE TRIGGER family_chapter_move_scope BEFORE UPDATE OF archive_id ON family_chapters
WHEN NOT EXISTS(SELECT 1 FROM family_archives a JOIN family_archives b ON a.owner_user_id=b.owner_user_id WHERE a.id=OLD.archive_id AND b.id=NEW.archive_id)
BEGIN SELECT RAISE(ABORT,'chapter move cannot change ownership'); END;
CREATE TABLE family_chapter_memories (
 chapter_id TEXT NOT NULL REFERENCES family_chapters(id) ON DELETE CASCADE,
 memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
 added_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 position INTEGER NOT NULL CHECK(position>=0),
 created_at TEXT NOT NULL,
 PRIMARY KEY(chapter_id,memory_story_id)
);
CREATE INDEX family_chapter_memories_story ON family_chapter_memories(memory_story_id,chapter_id);
CREATE TRIGGER family_chapter_member_scope BEFORE INSERT ON family_chapter_memories
WHEN NOT EXISTS(SELECT 1 FROM family_chapters c JOIN family_archives a ON a.id=c.archive_id JOIN memory_stories m ON m.owner_user_id=a.owner_user_id WHERE c.id=NEW.chapter_id AND m.id=NEW.memory_story_id AND m.status='complete' AND a.owner_user_id=NEW.added_by_user_id)
BEGIN SELECT RAISE(ABORT,'chapter reference requires an owned complete Living Memory'); END;
CREATE TRIGGER family_chapter_member_identity BEFORE UPDATE OF chapter_id,memory_story_id,added_by_user_id,created_at ON family_chapter_memories
BEGIN SELECT RAISE(ABORT,'chapter source reference identity is immutable'); END;
CREATE TRIGGER family_chapter_cover_scope BEFORE UPDATE OF cover_memory_id ON family_chapters
WHEN NEW.cover_memory_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM family_chapter_memories x WHERE x.chapter_id=NEW.id AND x.memory_story_id=NEW.cover_memory_id)
BEGIN SELECT RAISE(ABORT,'chapter cover must reference a member'); END;
CREATE TRIGGER family_chapter_cover_insert BEFORE INSERT ON family_chapters
WHEN NEW.cover_memory_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'chapter cover requires an existing membership'); END;
CREATE TRIGGER family_chapter_remove_cover AFTER DELETE ON family_chapter_memories
WHEN EXISTS(SELECT 1 FROM family_chapters c WHERE c.id=OLD.chapter_id AND c.cover_memory_id=OLD.memory_story_id)
BEGIN UPDATE family_chapters SET cover_memory_id=NULL WHERE id=OLD.chapter_id; END;
CREATE TABLE family_memory_labels (
 memory_story_id TEXT PRIMARY KEY REFERENCES memory_stories(id) ON DELETE CASCADE,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 updated_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at TEXT NOT NULL
);
CREATE TRIGGER family_memory_label_scope BEFORE INSERT ON family_memory_labels
WHEN NOT EXISTS(SELECT 1 FROM memory_stories m WHERE m.id=NEW.memory_story_id AND m.owner_user_id=NEW.updated_by_user_id)
BEGIN SELECT RAISE(ABORT,'only the owner can title their Living Memory'); END;
CREATE TRIGGER family_memory_label_owner BEFORE UPDATE OF memory_story_id,updated_by_user_id ON family_memory_labels
WHEN NEW.memory_story_id IS NOT OLD.memory_story_id OR NEW.updated_by_user_id IS NOT OLD.updated_by_user_id
BEGIN SELECT RAISE(ABORT,'memory title ownership is immutable'); END;
