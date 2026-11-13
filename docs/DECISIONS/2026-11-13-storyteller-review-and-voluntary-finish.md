# Storyteller-owned review and voluntary finish

**Date:** 2026-11-13  
**Status:** implementation decision within the owner-authorized release work  
**Authority:** Product Invariants I-03–I-10, I-16, I-19–I-21, I-25–I-26; Storyteller Sovereignty; Living Memory completion definition; the owner's expanded release request and continuation. No constitutional promise is amended.

## Decision

A person can choose **Finish for now** after the first Muse question or while transcription is unavailable. Original photograph and voice must be durable, ownership established, and the owner must explicitly confirm the source pair. Names, dates, other context, a successful transcription and a minimum count of Muse turns are not completion prerequisites. Unsent text/voice replies require a deliberate discard choice. Interrupted/retried completion still consumes capacity and emits activation once.

Review before or after completion can revise readable text and optional person/place/time/event details. The original media, machine transcript and earlier accepted text/context remain separate and unchanged. Every save adds an owner-attributed review snapshot with source IDs, a base version, transcript lineage and context states. Version conflicts fail the whole D1 batch and retain unsaved browser words; an identical retry returns the same review. New context written through existing Muse routes also invalidates a stale open review.

Sharing remains a bounded artifact. Preview identifies a transcript revision; creation explicitly selects that revision, and the public page reads the pinned revision rather than the memory's current private transcript. Existing links are pinned to the transcript effective when migration 0008 runs; this is not a reconstruction of historical recipient downloads. Transitional writes from the preceding Worker are pinned too. Revocation and deletion semantics remain independently enforced.

## Integration and rollback

This work is a dependent PR on #21 (`be1e85e`), whose own base is current main (`0d4452e`). Main remains unchanged until review and merge. Apply additive migration 0008 before deploying its matching Worker and assets. Verify legacy/backfilled shares in staging before enabling the editor. The migration has deterministic local coverage; no remote migration or live deployment is claimed.

After private corrections exist, do not roll back to the old sharing reader: it joins the current transcript and could expose corrected text through an existing link. Retain the caption-pinning reader and additive schema. Pause new edits with `STORY_REVIEW_WRITES_PAUSED=true` if necessary; authorized history/source reads remain available. Prefer a reviewed roll-forward repair. Do not reverse or erase accepted revisions as rollback. A paused editor cannot satisfy first-release feature acceptance.

## Evidence limits and unchanged economics

Synthetic integration and browser tests are evidence of local behavior, not legal, live-provider, physical-phone or human acceptance. First-release EN/ES UI work remains separate.

The current deletion implementation decrements `free_stories_completed`; the existing deletion test expects zero after deletion. This conflicts with the former CURRENT_STATE claim that deleting does not restore free capacity. This PR preserves that existing economic behavior and records the discrepancy instead of silently choosing a new trial/retention policy. Resolve it explicitly with paid-capacity policy before release. Review saves themselves do not change allowance or emit another activation.
