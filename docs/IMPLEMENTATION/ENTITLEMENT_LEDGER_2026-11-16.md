# Plans and entitlement ledger (L5.2)

**Result:** PARTIAL — implemented and proven; the deletion policy and prices await owner decision D1.
**Base:** `main` `74968e6` (PR #70).
**Authority:** V1 launch handoff lane L5 item 2: "A configurable plan model and a server-side entitlement ledger separate from the free grant. Proof: deleting a memory follows a stated policy rather than silently restoring a free grant."

## Outcome

- **The ledger.** Every change to a person's Living Memory capacity is recorded in an append-only ledger:
  - the grant when their allowance is created;
  - each completed memory, written by a trigger in the same transaction as the counter;
  - each deletion of a completed memory, under the stated deletion policy and its version.
- **Agreement with the counters.** `story_entitlements` remains the fast enforcement path, and a test proves the two agree.
- **The plan model.** `app/domain/entitlement.ts` has one plan, `free`: one Living Memory, no price shown (D1 default). Sharing never adds capacity.

## Deletion policy

The policy is now stated, versioned and recorded rather than implicit:
- `phase1Config.entitlements.deletionReturnsCapacity` is `true`, at version `deletion-returns-capacity-v1`.
- This keeps today's behaviour: deleting a completed memory returns its capacity.
- With `false`, deletion keeps the capacity used and records that instead.

Which policy to use is part of owner decision D1. Returning capacity lets a person replace their one free memory; keeping it means the free memory can be used once.

## Change

- `migrations/0030_entitlement_ledger.sql`: table, append-only trigger, grant and completion triggers, backfill.
- `worker/deletion.ts`: applies the policy and records the ledger entry in the deletion batch.
- `config/phase-1.ts`: the policy and its version.
- `app/domain/entitlement.ts`: `plans` and `summarizeLedger`.
- `scripts/verify-d1-schema.mjs` and hand-listed test migration sets include 0030.

## Evidence

| Check | Result |
| --- | --- |
| Integration `memory-deletion.test.ts`, run under both policies | Ledger shows grant, use, then returned or kept; the ledger summary equals the counters; the counter follows the policy |
| Unit `entitlement.test.ts` | Plan model; summaries for grant, use, returned and kept |
| `npm run verify:core` | Pass — 335 tests in 79 files; schema 144 objects |

**Reversible:** yes. **Migration:** 0030. **Production deployed:** no.
