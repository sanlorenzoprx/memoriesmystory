PRAGMA foreign_keys = ON;

-- Clerk proves the person. This table binds that external subject to the
-- stable, provider-independent user ID that owns data inside memoriesmystory.
CREATE TABLE auth_principals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer TEXT NOT NULL CHECK (issuer = 'clerk'),
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (issuer, subject)
);

CREATE INDEX auth_principals_user_id_idx ON auth_principals (user_id);

-- One immutable receipt makes anonymous-to-account promotion idempotent and
-- prevents the same local draft from ever being claimed by two accounts.
CREATE TABLE draft_ownership_claims (
  draft_id TEXT PRIMARY KEY REFERENCES memory_story_drafts(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  anonymous_identity_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL
);

CREATE INDEX draft_ownership_claims_user_time_idx
  ON draft_ownership_claims (user_id, claimed_at DESC);

CREATE TRIGGER draft_ownership_claim_requires_owner
BEFORE INSERT ON draft_ownership_claims
WHEN NOT EXISTS (
  SELECT 1 FROM memory_story_drafts
  WHERE id = NEW.draft_id AND owner_user_id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'draft owner must match ownership claim');
END;

CREATE TRIGGER draft_ownership_claims_immutable
BEFORE UPDATE ON draft_ownership_claims
BEGIN
  SELECT RAISE(ABORT, 'draft ownership claims are immutable');
END;

-- Billing stays disabled in Packet 4.1. This provider-neutral link means a
-- later Stripe customer can attach to the stable internal user without making
-- Clerk, Stripe, or an email address the data owner.
CREATE TABLE billing_customer_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'stripe'),
  provider_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
