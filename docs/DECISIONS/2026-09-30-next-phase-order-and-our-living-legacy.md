# Next-Phase Order and the Our Living Legacy Name

**Status:** accepted product-owner decision
**Date:** 2026-09-30
**Scope:** build order after the solo Living Memory release candidate, customer name of the shared family experience, repository cleanup

## Context

Three documents gave different orders for work after the solo Living Memory release candidate: `FOUNDATION/08_BUILD_ORDER.md` (Family Archive first, Memory Circle later), `EXECUTION/NEXT_PHASE_OUR_LIVING_LEGACY_AND_PHOTO_DIGITIZATION.md` (archival photo capture, then a small group video conversation), and a September function audit (albums, then Preserve Together, then a remote Memory Circle). The shared family experience also carried four overlapping names: Preserve Together, Remember Together, Memory Circle, and Our Living Legacy.

## Decisions

1. **Order after the release candidate follows the Next Phase document.** First the solo release candidate is locked and hardened to production-ready-not-live. Then archival physical-photo capture (Phase 2A), then Our Living Legacy (Phase 2B). Family Archive, family contributions, retrieval/timeline, resurfacing, derivative storytelling, legacy infrastructure, and growth follow.
2. **"Our Living Legacy" is the one customer name for the shared family experience,** in person or at a distance. Preserve Together, Remember Together, and Memory Circle are retired as product names.
3. **`chore/known-outcome-engineering-v1` is dropped.** It added process tooling (a CI contract checker) with no value to the product and is removed rather than kept as history.

## Alternatives considered

- Keep the Foundation build order (Family Archive first). Rejected: every later feature benefits from a better source photograph first, and the owner wants group remembering sooner than a full archive model.
- Keep the audit order (albums first). Rejected for the same reason; albums fold into Family Archive.

## Affected Product Invariants

None weakened. Original media stay immutable (the corrected scan is a derivative), attribution and differing recollections survive in shared sessions, and sharing stays voluntary.

## Downstream updates made with this decision

- `FOUNDATION/08_BUILD_ORDER.md` v1.1: Phases 6–7 are archival photo capture and Our Living Legacy; later phases renumbered.
- `EXECUTION/PHASE_GATES.md` and `EXECUTION/TASK_QUEUE.json` reordered to match.
- Product language, vision, user experience, core experiences, canonical scope, traceability, stack, and execution documents use "Our Living Legacy". Dated receipts and earlier decision records keep their original wording.
- `PRODUCT/OPEN_DECISIONS.md`: the open "Memory Circle brand name" question is closed.

## Evidence required

Phase exits stay as written in the Next Phase document: a normal user digitizes one print with visibly better geometry while the source capture stays preserved; two uncoached people join around one photograph, talk, reopen the session, and can tell whose recollection is whose.
