# Implementation Documents

Implementation work is subordinate to the Foundation and approved dated product decisions.

## Start here

1. `../00_START_HERE.md`
2. `../DECISIONS/2026-08-11-living-memory-doctrine.md`
3. `../FOUNDATION/03_USER_EXPERIENCE.md`
4. `../PRODUCT/LIVING_MEMORY_DEFINITION.md`
5. `../PRODUCT/LIVING_MEMORY_ANTI_DRIFT_CHECKLIST.md`
6. `2026-08-11_LIVING_MEMORY_MIGRATION_PLAN.md`
7. `../EXECUTION/TASK_QUEUE.json`

## Historical Phase 1 specification

`PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md` contains useful implementation detail from the earlier campaign and is not erased. It is now a compatibility/historical technical source.

Where that file conflicts with the current Living Memory decision, Foundation v2, current User Experience, Voluntary Share Policy V2, or current Execution gates, the newer source governs. In particular, its former share-to-unlock behavior is superseded and must not be implemented.

Existing packet receipts remain evidence of what was actually built and verified; do not rewrite them to make historical terminology appear current.

Each new build slice must produce a human outcome, anti-drift review, test evidence, and a receipt. Internal code activity is not completion.

## Current bilingual implementation

See [A04 English/Spanish interface receipt](ENGLISH_SPANISH_INTERFACE_2026-11-13.md) for the merged #21/#22 baseline, current locale behavior, automated evidence and remaining human/device acceptance.

See [R1a archival still acquisition](ARCHIVAL_STILL_CAPTURE_2026-11-13.md) for untouched still bytes, fallback/recovery behavior, the #23 merge record and remaining separate-scan/physical-print work.

See [R1b scans and steadiness](ARCHIVAL_SCANS_STEADINESS_2026-11-13.md) for separate scan provenance/durability, owner-only replay, digital assistance limits and deferred MVP v0.5 physical testing.
