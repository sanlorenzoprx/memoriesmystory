-- E04d: the speaker's own written words for their voice recollection.
-- These are typed by the person who spoke; no machine transcript is created.
-- Every version is kept. Invited family sees only the version the owner pinned.
CREATE TABLE family_contribution_voice_transcripts (
 id TEXT PRIMARY KEY,
 contribution_id TEXT NOT NULL REFERENCES family_contributions(id) ON DELETE CASCADE,
 author_user_id TEXT NOT NULL REFERENCES users(id),
 previous_transcript_id TEXT,
 written_text TEXT NOT NULL CHECK(length(written_text) BETWEEN 1 AND 8000),
 origin TEXT NOT NULL DEFAULT 'speaker_written' CHECK(origin='speaker_written'),
 agreement_version TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX family_contribution_voice_transcript_history ON family_contribution_voice_transcripts(contribution_id,id);
CREATE TRIGGER family_contribution_transcript_speaker BEFORE INSERT ON family_contribution_voice_transcripts
WHEN NOT EXISTS(SELECT 1 FROM family_contribution_voice_sources s WHERE s.contribution_id=NEW.contribution_id AND s.author_user_id=NEW.author_user_id)
  OR (NEW.previous_transcript_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM family_contribution_voice_transcripts t WHERE t.id=NEW.previous_transcript_id AND t.contribution_id=NEW.contribution_id))
BEGIN SELECT RAISE(ABORT,'family_contribution_transcript_speaker'); END;
CREATE TRIGGER family_contribution_transcript_immutable BEFORE UPDATE ON family_contribution_voice_transcripts
BEGIN SELECT RAISE(ABORT,'family_contribution_source_immutable'); END;
CREATE TABLE family_contribution_transcript_pins (
 contribution_id TEXT PRIMARY KEY REFERENCES family_contributions(id) ON DELETE CASCADE,
 transcript_id TEXT NOT NULL REFERENCES family_contribution_voice_transcripts(id),
 pinned_by_user_id TEXT NOT NULL REFERENCES users(id),
 pinned_at TEXT NOT NULL
);
-- Only the owner pins, only a version of this contribution, only while its voice is included.
CREATE TRIGGER family_contribution_transcript_pin_insert BEFORE INSERT ON family_contribution_transcript_pins
WHEN NOT EXISTS(SELECT 1 FROM family_contribution_voice_transcripts t JOIN family_contributions c ON c.id=t.contribution_id WHERE t.id=NEW.transcript_id AND c.id=NEW.contribution_id AND c.owner_user_id=NEW.pinned_by_user_id AND c.author_state='submitted' AND c.included_revision_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'family_contribution_transcript_pin'); END;
CREATE TRIGGER family_contribution_transcript_pin_update BEFORE UPDATE ON family_contribution_transcript_pins
WHEN OLD.contribution_id<>NEW.contribution_id OR NOT EXISTS(SELECT 1 FROM family_contribution_voice_transcripts t JOIN family_contributions c ON c.id=t.contribution_id WHERE t.id=NEW.transcript_id AND c.id=NEW.contribution_id AND c.owner_user_id=NEW.pinned_by_user_id AND c.author_state='submitted' AND c.included_revision_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'family_contribution_transcript_pin'); END;
-- Withdrawing or excluding the voice also removes its written words from family view;
-- a later inclusion needs a fresh owner choice.
CREATE TRIGGER family_contribution_transcript_pin_clear AFTER UPDATE ON family_contributions
WHEN NEW.included_revision_id IS NULL OR NEW.author_state='withdrawn'
BEGIN DELETE FROM family_contribution_transcript_pins WHERE contribution_id=NEW.id; END;
