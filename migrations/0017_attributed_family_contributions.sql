CREATE TABLE family_contributions (
 id TEXT PRIMARY KEY,
 memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
 owner_user_id TEXT NOT NULL REFERENCES users(id),
 author_user_id TEXT NOT NULL REFERENCES users(id),
 author_state TEXT NOT NULL CHECK(author_state IN ('submitted','withdrawn')),
 latest_revision_id TEXT NOT NULL,
 included_revision_id TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX family_contributions_memory ON family_contributions(memory_story_id,id);
CREATE TABLE family_contribution_revisions (
 id TEXT PRIMARY KEY,
 contribution_id TEXT NOT NULL REFERENCES family_contributions(id) ON DELETE CASCADE,
 author_user_id TEXT NOT NULL REFERENCES users(id),
 source_grant_id TEXT,
 previous_revision_id TEXT,
 attribution TEXT NOT NULL CHECK(length(attribution) BETWEEN 1 AND 120),
 human_text TEXT NOT NULL CHECK(length(human_text) BETWEEN 1 AND 8000),
 agreement_version TEXT NOT NULL,
 source_kind TEXT NOT NULL DEFAULT 'human_text' CHECK(source_kind='human_text'),
 created_at TEXT NOT NULL
);
CREATE INDEX family_contribution_revision_history ON family_contribution_revisions(contribution_id,created_at,id);
CREATE TABLE family_contribution_events (
 id TEXT PRIMARY KEY,
 contribution_id TEXT NOT NULL REFERENCES family_contributions(id) ON DELETE CASCADE,
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL CHECK(action IN ('submitted','revised','included','excluded','withdrawn')),
 revision_id TEXT,
 created_at TEXT NOT NULL
);
CREATE TRIGGER family_contribution_owner_insert BEFORE INSERT ON family_contributions
WHEN NOT EXISTS(SELECT 1 FROM memory_stories m WHERE m.id=NEW.memory_story_id AND m.owner_user_id=NEW.owner_user_id AND m.status='complete')
BEGIN SELECT RAISE(ABORT,'family_contribution_scope'); END;
CREATE TRIGGER family_contribution_identity_immutable BEFORE UPDATE ON family_contributions
WHEN OLD.id<>NEW.id OR OLD.memory_story_id<>NEW.memory_story_id OR OLD.owner_user_id<>NEW.owner_user_id OR OLD.author_user_id<>NEW.author_user_id OR OLD.created_at<>NEW.created_at
BEGIN SELECT RAISE(ABORT,'family_contribution_identity'); END;
CREATE TRIGGER family_contribution_revision_author BEFORE INSERT ON family_contribution_revisions
WHEN NOT EXISTS(SELECT 1 FROM family_contributions c WHERE c.id=NEW.contribution_id AND c.author_user_id=NEW.author_user_id AND (c.author_user_id=c.owner_user_id OR EXISTS(SELECT 1 FROM family_access_grants g WHERE g.id=NEW.source_grant_id AND g.accepted_by_user_id=NEW.author_user_id AND g.owner_user_id=c.owner_user_id AND g.state='accepted' AND g.role='contributor')))
BEGIN SELECT RAISE(ABORT,'family_contribution_author'); END;
CREATE TRIGGER family_contribution_revision_immutable BEFORE UPDATE ON family_contribution_revisions
WHEN OLD.id<>NEW.id OR OLD.contribution_id<>NEW.contribution_id OR OLD.author_user_id<>NEW.author_user_id OR OLD.attribution<>NEW.attribution OR OLD.human_text<>NEW.human_text OR OLD.agreement_version<>NEW.agreement_version OR OLD.source_kind<>NEW.source_kind OR OLD.created_at<>NEW.created_at OR OLD.source_grant_id IS NOT NEW.source_grant_id OR OLD.previous_revision_id IS NOT NEW.previous_revision_id
BEGIN SELECT RAISE(ABORT,'family_contribution_source_immutable'); END;
CREATE TRIGGER family_contribution_event_immutable BEFORE UPDATE ON family_contribution_events
BEGIN SELECT RAISE(ABORT,'family_contribution_event_immutable'); END;

CREATE TRIGGER family_contribution_previous_scope BEFORE INSERT ON family_contribution_revisions
WHEN NEW.previous_revision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM family_contribution_revisions v WHERE v.id=NEW.previous_revision_id AND v.contribution_id=NEW.contribution_id AND v.author_user_id=NEW.author_user_id)
BEGIN SELECT RAISE(ABORT,'family_contribution_previous_scope'); END;
