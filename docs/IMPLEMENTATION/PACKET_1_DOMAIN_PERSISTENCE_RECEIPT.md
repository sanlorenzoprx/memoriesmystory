# Packet 1 — Domain, Configuration, and Persistence Receipt

**Date:** 2026-07-16

**Branch:** `packet-1/domain-persistence`

**Application:** `memoriesmystory`

## User outcome protected

Later capture packets now build on contracts that make it structurally difficult to lose or overwrite a person's original photograph or voice, claim completion without durable evidence, duplicate a paid/free entitlement effect, or blend machine suggestions into human testimony.

## Delivered

### Domain

- Branded IDs and framework-independent Memory Story types.
- Explicit recoverable draft-state transitions.
- Immutable-original application guard.
- Durable photo/audio completion blockers.
- Transcript, generated-artifact, fact, provenance, and truth-state types.
- Idempotent operation resolution and durable asset receipt contract.

### Configuration and entitlement

- One source for the five-story cap and 30-second voice allowance.
- Central media size/MIME and English/Spanish locale configuration.
- One-unlock-per-story behavior capped at five.
- Retention, token lifetime, and model IDs remain explicitly pending their owning legal/security/provider gates.

### D1

- Initial migration for users, identities, sessions, drafts, stories, media, transcripts, generated artifacts, facts, entitlements, shares/events, agreements, operation receipts, and story events.
- Ownership/retry/query indexes.
- Database constraints for five-story entitlement integrity.
- Triggers for immutable original identity, fail-closed completion with both durable originals, no reopening a completed story, and append-only transcript revisions.
- Local migration verifier for schema objects, integrity, foreign keys, immutable originals, and completion requirements.

### R2 and scale boundaries

- Private identity-based original and derivative key builders.
- Safe key-segment and extension validation.
- No user filenames, email addresses, titles, or intimate content in keys.
- Private bucket/access/durability policy documented without pretending transport exists before Packet 3.
- D1 binding declared with an explicit non-deployable zero ID until authorized staging provisioning.

## Product Invariant evidence

| Invariant | Packet 1 evidence |
| --- | --- |
| I-01 / I-02 | Original photo/audio roles and completion requirements are distinct and required together. |
| I-04 / I-18 | Truth states and machine-generated artifacts remain separate from testimony and corrections. |
| I-06 | Application guard plus D1 trigger reject original identity mutation; R2 keys never overwrite by filename. |
| I-07 | Transcript revisions and story events are additive; transcript updates are rejected. |
| I-08 | Completion requires durable original records and durable receipts require R2 entity-tag evidence. |
| I-15 | UI/spoken locale fields remain separate; English/Spanish locale fallback is configured centrally. |
| I-16 | Story defaults and R2 policy remain private. |
| I-24 | Entitlement logic and D1 uniqueness/constraints prevent duplicate unlock and cap free stories at five. |

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 7 files and 23 tests.
- `npm run test:schema`: passed, 15 required schema objects plus integrity, foreign-key, immutable-original, and fail-closed completion evidence.
- `npm run build`: passed.
- `npm run deploy:dry-run`: passed; assets and the local-placeholder `DB` binding were recognized and no deployment occurred.
- `npx playwright test --list`: passed, 2 unchanged phone-Chromium first-experience tests discovered.
- `git diff --check`: passed.

## Deliberately deferred

- Real IndexedDB local drafts and camera/import behavior: Packet 2.
- R2 transport, signature validation, upload/recovery, audio recording, and authorized playback: Packet 3.
- Auth provider implementation and draft promotion: Packet 4.
- Queue/Workers AI processing: Packet 5.
- Completion transaction routes, review UI, and private share execution: Packets 6–7.
- Staging migration and production resource IDs: authorized staging/Packet 8 gates.

## Next bounded task

Packet 2 — local-first capture and onboarding. The task queue activates Packet 2 and no later packet.
