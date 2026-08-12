PRAGMA foreign_keys = ON;

CREATE TABLE commerce_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  offer_id TEXT NOT NULL CHECK (offer_id IN ('chapter', 'life', 'family')),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  amount_total INTEGER NOT NULL CHECK (amount_total > 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (length(currency) = 3),
  status TEXT NOT NULL CHECK (status IN (
    'created', 'checkout_open', 'paid', 'fulfilled', 'expired', 'payment_failed', 'refunded'
  )),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  fulfilled_at TEXT,
  CHECK (fulfilled_at IS NULL OR paid_at IS NOT NULL)
);

CREATE INDEX commerce_orders_account_created_idx
  ON commerce_orders (account_id, created_at DESC);
CREATE INDEX commerce_orders_status_updated_idx
  ON commerce_orders (status, updated_at);

CREATE TABLE entitlement_grants (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_order_id TEXT NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE RESTRICT,
  offer_id TEXT NOT NULL CHECK (offer_id IN ('chapter', 'life', 'family')),
  living_memory_limit INTEGER NOT NULL CHECK (living_memory_limit > 0),
  voice_seconds_per_memory INTEGER NOT NULL CHECK (voice_seconds_per_memory > 0),
  memory_circle_enabled INTEGER NOT NULL DEFAULT 0 CHECK (memory_circle_enabled IN (0, 1)),
  family_archive_level TEXT NOT NULL CHECK (family_archive_level IN ('chapter', 'life', 'family')),
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX entitlement_grants_account_granted_idx
  ON entitlement_grants (account_id, granted_at DESC);
CREATE INDEX entitlement_grants_active_account_idx
  ON entitlement_grants (account_id, offer_id)
  WHERE revoked_at IS NULL;

CREATE TABLE stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  error TEXT
);

CREATE INDEX stripe_events_status_received_idx
  ON stripe_events (processing_status, received_at);
