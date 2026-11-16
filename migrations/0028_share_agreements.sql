-- One-time sharing agreement (owner decision 2026-11-16). An adult agrees once
-- to how they may share: with friends and family, and optionally in public.
-- Each agreement is kept with its wording version and time and is never
-- changed. A new wording version would be agreed to as a new row.
CREATE TABLE share_agreements (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 scope TEXT NOT NULL CHECK(scope IN ('family_friends','public')),
 agreement_version TEXT NOT NULL CHECK(length(agreement_version) BETWEEN 1 AND 64),
 agreed_at TEXT NOT NULL,
 PRIMARY KEY(user_id,scope,agreement_version)
);
CREATE TRIGGER share_agreements_immutable BEFORE UPDATE ON share_agreements
BEGIN SELECT RAISE(ABORT,'share agreements are append-only'); END;
