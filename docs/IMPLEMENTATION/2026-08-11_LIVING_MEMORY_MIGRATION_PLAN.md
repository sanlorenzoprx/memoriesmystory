# Living Memory Doctrine Migration Plan

**Date:** 2026-08-11  
**Status:** active implementation map  
**Starting code:** `packet-4/account-binding-recovery` at `2df806817142b57058dbe25cadb90dbfe1c0f915`

## Purpose

Move the current implementation from the earlier Memory Story / share-to-unlock product model to the ratified Living Memory doctrine without discarding validated persistence, local-first capture, original-media durability, truth-state, or identity work.

## What is preserved

The following existing work is intentionally retained:

- branded IDs and explicit domain boundaries;
- `MemoryStory` persistence record and draft state machine;
- immutable `MediaAsset` originals;
- original-photo and original-audio durability gates;
- transcript revision lineage;
- truth states and attributed facts;
- generated-artifact/source-reference separation;
- operation receipts and idempotency;
- IndexedDB/local-first capture and reload recovery;
- D1/R2 durability contracts;
- Clerk account binding and cross-device recovery foundations.

## What changes now

### Phase 0 — Ratified

- Foundation v2 documents define Idea → Mechanism → Product.
- Living Memory is canonical.
- Product language is updated.
- Voluntary Share Policy V2 supersedes Good Karma share-to-unlock.
- Anti-drift checklist is mandatory.
- Execution docs no longer instruct agents to rebuild share-to-unlock.

### Phase 1 — Intentionally held

Landing-page replacement is not part of this doctrine/domain branch.

Do not polish obsolete positioning. The dedicated landing slice must be designed after the contracts in this branch are accepted and should express:

**Idea → Living Memory demonstration → Magic Moment → trust/ownership/privacy → family/social sharing → create first Living Memory.**

The primary product is software with AI integration. Do not reintroduce mail-in digitization as the main mechanism.

### Phase 2 — Domain overlay started

- `LivingMemoryId` aliases the existing persistence identifier.
- `LivingMemory` aggregate composes the existing MemoryStory record with durable original media and source-grounded structures.
- No D1/table rename is required now.

### Phase 3 — Instrumentation contract started

- canonical activation: `first_living_memory_completed`;
- supporting share/referral event vocabulary established;
- runtime emission remains a later vertical slice.

### Phase 4 — Existing evidence retained

Original image/audio immutability, durability, receipts, and recovery already exist from Packets 1–4 and remain prerequisites. They must later be revalidated under Living Memory acceptance language rather than rebuilt.

### Phases 5–13 — Planned

Follow `docs/FOUNDATION/08_BUILD_ORDER.md` and `docs/EXECUTION/PHASE_GATES.md`.

## Compatibility debt to retire deliberately

Existing names may still include:

- `MemoryStory`;
- `MemoryStoryId`;
- database table/column names;
- route names;
- historical implementation receipts.

Do not perform broad search/replace. Rename only when the migration has a functional, operational, or maintainability benefit and can be proven safe.

The old `grantShareUnlock` function and `grant_share_unlock` operation kind remain deprecated compatibility surfaces. They must never grant a reward and should be removed only after all runtime callers are migrated.

## Immediate next implementation slices

1. Run typecheck, lint, unit, schema, build, and dry-run checks against this doctrine/domain branch.
2. Fix any compatibility failures without weakening doctrine.
3. Add runtime emission for `first_living_memory_completed` at the durable completion boundary.
4. Build a first bounded Share Artifact contract with explicit projection tests; do not yet require direct Facebook API publishing if a standard share handoff can validate the experience.
5. Create the dedicated landing-page replacement slice only after the doctrine/domain branch is green.

## Non-goals for this branch

- no production deployment;
- no landing-page redesign;
- no destructive database rename;
- no broad visual redesign;
- no full Muse runtime;
- no Memory Circle implementation;
- no pricing expansion;
- no public-feed implementation.
