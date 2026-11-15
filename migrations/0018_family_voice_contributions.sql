-- E04b: a relative's own voice as an immutable, separately attributed source.
-- A voice recollection is never revised in place; a new recording is a new
-- contribution. Text and voice sources never mix inside one contribution.
CREATE TABLE family_contribution_voice_sources (
 id TEXT PRIMARY KEY,
 contribution_id TEXT NOT NULL UNIQUE REFERENCES family_contributions(id) ON DELETE CASCADE,
 author_user_id TEXT NOT NULL REFERENCES users(id),
 source_grant_id TEXT,
 attribution TEXT NOT NULL CHECK(length(attribution) BETWEEN 1 AND 120),
 agreement_version TEXT NOT NULL,
 r2_key TEXT NOT NULL UNIQUE,
 content_type TEXT NOT NULL CHECK(content_type IN ('audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg')),
 byte_size INTEGER NOT NULL CHECK(byte_size>0),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 r2_etag TEXT NOT NULL,
 duration_ms INTEGER NOT NULL CHECK(duration_ms>0),
 created_at TEXT NOT NULL
);
CREATE TRIGGER family_contribution_voice_author BEFORE INSERT ON family_contribution_voice_sources
WHEN NOT EXISTS(SELECT 1 FROM family_contributions c WHERE c.id=NEW.contribution_id AND c.author_user_id=NEW.author_user_id AND (c.author_user_id=c.owner_user_id OR EXISTS(SELECT 1 FROM family_access_grants g WHERE g.id=NEW.source_grant_id AND g.accepted_by_user_id=NEW.author_user_id AND g.owner_user_id=c.owner_user_id AND g.state='accepted' AND g.role='contributor')))
BEGIN SELECT RAISE(ABORT,'family_contribution_author'); END;
CREATE TRIGGER family_contribution_voice_immutable BEFORE UPDATE ON family_contribution_voice_sources
BEGIN SELECT RAISE(ABORT,'family_contribution_source_immutable'); END;
CREATE TRIGGER family_contribution_voice_not_text BEFORE INSERT ON family_contribution_voice_sources
WHEN EXISTS(SELECT 1 FROM family_contribution_revisions v WHERE v.contribution_id=NEW.contribution_id)
BEGIN SELECT RAISE(ABORT,'family_contribution_source_kind'); END;
CREATE TRIGGER family_contribution_text_not_voice BEFORE INSERT ON family_contribution_revisions
WHEN EXISTS(SELECT 1 FROM family_contribution_voice_sources s WHERE s.contribution_id=NEW.contribution_id)
BEGIN SELECT RAISE(ABORT,'family_contribution_source_kind'); END;
-- One read shape for both source kinds. Voice rows carry no machine or human text.
CREATE VIEW family_contribution_sources AS
 SELECT id,contribution_id,author_user_id,source_grant_id,previous_revision_id,attribution,human_text,source_kind,created_at,NULL AS duration_ms,NULL AS content_type
 FROM family_contribution_revisions
 UNION ALL
 SELECT id,contribution_id,author_user_id,source_grant_id,NULL,attribution,'','human_voice',created_at,duration_ms,content_type
 FROM family_contribution_voice_sources;
