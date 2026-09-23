# Real-Phone Acceptance Repair Receipt

**Date:** 2026-09-23
**Branch:** `integration/lm-week-one`
**Environment:** MemoriesMyStory staging
**Trigger:** Product-owner test on a real phone after the automated Week-One staging checkpoint.

## Real-phone observations

The real phone successfully demonstrated:

- photograph capture/import;
- durable photograph upload;
- microphone recording;
- original voice playback.

The same run exposed release-blocking product-surface gaps:

1. Muse was not visibly encountered.
2. Who / Where / When / What context was not encountered.
3. Account/save continuation was not obvious and the latest phone-created durable drafts remained anonymous in D1.
4. Family sharing was therefore unreachable from the real journey.
5. No in-product text-size control existed.
6. No delete control existed.

The backend contracts for Muse, storyteller context, completion and bounded sharing already existed and had live synthetic acceptance evidence. The real-device failure was primarily a user-journey/handoff defect: the phone path stopped at durable originals before ownership promotion and the Living Memory continuation route.

## Repair

### Account and continuation

- Added a Clerk-to-application session bridge for already signed-in people.
- Added visible **My account** access on capture and Living Memory screens.
- Changed the durable-original CTA to **Save to my account & continue**.
- Added an explicit next-step explanation:
  **Save to account → Muse → Who / Where / When / What → Preserve → Share**.
- Changed unfinished archive entries to reopen the Living Memory continuation flow instead of a dead-end photo/audio archive view.

### Muse and storyteller context

- Added a visible Muse presence during transcription/listening.
- Added a visible Muse question card after transcription.
- If Muse has no useful question, the UI says so without inventing one.
- Added a clear storyteller-context introduction above Who / Where / When / What.
- Storyteller sovereignty remains unchanged: context may be stated, approximate, unknown or omitted; Muse does not judge or verify the memory.

### Text size

- Added persistent **A / A+ / A++** controls.
- The choice is saved locally and applies across the application.
- Root font sizes are 16px / 18px / 20px, allowing existing rem-based typography and touch UI to scale together.

### Delete

- Added **Delete this draft** during capture.
- Added **Delete this memory** throughout the owned Living Memory flow.
- Deletion requires confirmation.
- Server deletion removes private R2 media and connected D1 memory records.
- Completed share/context/transcript/Muse records are removed through the connected story deletion boundary.
- A minimal `deletion_receipts` row remains for deletion provenance only; it stores no photograph, voice, transcript, Muse output, context or share token.
- Deletion does not restore or manufacture a free-story entitlement.

## Verification

- Client TypeScript: pass.
- Worker TypeScript: pass.
- Vite production build: pass, 149 modules.
- D1 schema verifier: **27 required objects**, integrity/foreign keys/immutable-original/fail-closed completion pass.
- Existing focused Week-One regression: **7 files / 19 tests pass**.
- New deletion integration test: **1 / 1 pass**.
- Total focused regression for this checkpoint: **20 / 20 tests pass**.
- Staging migration `0005_memory_deletion.sql`: applied successfully through normal Wrangler migrations.
- Wrangler reports **No migrations to apply** after deployment.
- Staging health: HTTP 200.
- Deployed Worker version: `d99bf7d7-3657-41fd-b55e-5a2ccf992c39`.
- Live bundle contains the repaired account CTA, visible Muse states, delete controls, text-size state, and family-link flow.

## Anti-drift check

- Idea strengthened: YES — the phone path now continues from source capture into an actual Living Memory.
- Living Memory mechanism strengthened: YES.
- Source authenticity preserved: YES.
- Privacy preserved: YES.
- Ownership preserved: YES.
- Offline/recovery accounted for: YES; deletion fails rather than falsely claiming completion when remote cleanup cannot start.
- Cross-device continuity accounted for: YES; ownership continuation is now explicit and session alignment is automatic for signed-in users.
- AI role source-grounded: YES.
- Share boundary preserved: YES.
- Makes the memory more alive/complete/connected/durable/trustworthy/retrievable: YES.

## Remaining gate

This repair is deployed but **not yet accepted on the same real phone**.

The next acceptance run must confirm, in order:

**Photo → Voice → Save to account → Muse visible → Muse question → Who/Where/When/What → Preserve → Playback → Share link → Delete control → Text-size control.**

Do not lock the Week-One RC until that real-device retest passes and the planned three uncoached human sessions are complete.
