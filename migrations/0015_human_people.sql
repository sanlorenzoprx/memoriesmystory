-- Human-entered private archive references; never face or identity inference.
CREATE TABLE family_people_records (
 id TEXT PRIMARY KEY,
 archive_id TEXT NOT NULL REFERENCES family_archives(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('person','relationship')),
 document_json TEXT NOT NULL CHECK(json_valid(document_json)),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX family_people_archive ON family_people_records(archive_id,kind,active,id);
CREATE TABLE family_people_history (
 record_id TEXT NOT NULL REFERENCES family_people_records(id) ON DELETE CASCADE,
 version INTEGER NOT NULL,
 document_json TEXT NOT NULL CHECK(json_valid(document_json)),
 active INTEGER NOT NULL CHECK(active IN (0,1)),
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(record_id,version)
);
CREATE TRIGGER family_people_owner_insert BEFORE INSERT ON family_people_records
WHEN NOT EXISTS(SELECT 1 FROM family_archives WHERE id=NEW.archive_id AND owner_user_id=NEW.created_by_user_id)
BEGIN SELECT RAISE(ABORT,'private_people_owner'); END;
CREATE TRIGGER family_people_identity_immutable BEFORE UPDATE ON family_people_records
WHEN OLD.id<>NEW.id OR OLD.archive_id<>NEW.archive_id OR OLD.kind<>NEW.kind OR OLD.created_by_user_id<>NEW.created_by_user_id OR OLD.created_at<>NEW.created_at
BEGIN SELECT RAISE(ABORT,'private_people_identity'); END;
CREATE TRIGGER family_people_history_immutable BEFORE UPDATE ON family_people_history
BEGIN SELECT RAISE(ABORT,'private_people_history_immutable'); END;
