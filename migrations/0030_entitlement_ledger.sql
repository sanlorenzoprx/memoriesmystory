-- Entitlement ledger (lane L5.2). An append-only record of every change to a
-- person's Living Memory capacity: grants, each completed memory, and what
-- each deletion did under the deletion policy then in force. The counters in
-- story_entitlements stay the fast enforcement path; the ledger is the
-- auditable account they must agree with.
CREATE TABLE entitlement_ledger (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 entry_kind TEXT NOT NULL CHECK(entry_kind IN ('grant','memory_completed','memory_deleted_capacity_returned','memory_deleted_capacity_kept')),
 plan TEXT NOT NULL,
 granted INTEGER NOT NULL DEFAULT 0 CHECK(granted>=0),
 used_delta INTEGER NOT NULL CHECK(used_delta IN (-1,0,1)),
 memory_story_id TEXT,
 policy_version TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX entitlement_ledger_user ON entitlement_ledger(user_id,created_at);
CREATE TRIGGER entitlement_ledger_immutable BEFORE UPDATE ON entitlement_ledger
BEGIN SELECT RAISE(ABORT,'the entitlement ledger is append-only'); END;

-- A new allowance records its grant.
CREATE TRIGGER entitlement_ledger_grant AFTER INSERT ON story_entitlements
BEGIN
 INSERT INTO entitlement_ledger(id,user_id,entry_kind,plan,granted,used_delta,created_at)
 VALUES('ledger_'||lower(hex(randomblob(16))),NEW.user_id,'grant',NEW.plan,NEW.free_stories_unlocked,0,NEW.updated_at);
END;
-- Each completion records its use, in the same transaction as the counter.
CREATE TRIGGER entitlement_ledger_completion AFTER UPDATE OF status ON memory_stories
WHEN OLD.status='draft' AND NEW.status='complete'
BEGIN
 INSERT INTO entitlement_ledger(id,user_id,entry_kind,plan,granted,used_delta,memory_story_id,created_at)
 SELECT 'ledger_'||lower(hex(randomblob(16))),NEW.owner_user_id,'memory_completed',e.plan,0,1,NEW.id,NEW.updated_at
 FROM story_entitlements e WHERE e.user_id=NEW.owner_user_id;
END;

-- Existing accounts: their current grant and each completed memory.
INSERT INTO entitlement_ledger(id,user_id,entry_kind,plan,granted,used_delta,created_at)
SELECT 'ledger_'||lower(hex(randomblob(16))),user_id,'grant',plan,free_stories_unlocked,0,updated_at FROM story_entitlements;
INSERT INTO entitlement_ledger(id,user_id,entry_kind,plan,granted,used_delta,memory_story_id,created_at)
SELECT 'ledger_'||lower(hex(randomblob(16))),m.owner_user_id,'memory_completed',e.plan,0,1,m.id,COALESCE(m.completed_at,m.updated_at)
FROM memory_stories m JOIN story_entitlements e ON e.user_id=m.owner_user_id WHERE m.status='complete';
