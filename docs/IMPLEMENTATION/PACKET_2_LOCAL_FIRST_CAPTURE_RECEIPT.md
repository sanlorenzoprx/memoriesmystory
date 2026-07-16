# Packet 2 — Local-First Capture and Onboarding Receipt

**Date:** 2026-07-16

**Branch:** `packet-2/local-first-capture`

**Implementation commit verified by CI:** `3ce659af0e354f9a7d419d3ff9d2485e6fafd202`

**Draft pull request:** `https://github.com/sanlorenzoprx/memoriesmystory/pull/1`

**Application:** `memoriesmystory`

## User outcome delivered

A person can now begin with the photograph rather than an account or technology tour, choose a camera or imported image only when ready, receive one useful quality correction at a time, deliberately keep a usable photograph despite an uncertain automated check, and return to the same local photograph after a reload.

The interface says **Kept on this device** and **It is not backed up yet.** It never claims the local photograph is durably saved and never shows the locked completion sentence.

## Delivered

### Phone-first capture route

- Replaced the static capture introduction with `/capture/:draftId`.
- Starts a stable local draft only after the person chooses camera or import.
- Keeps the photograph visually dominant during camera preview, review, and the ready state.
- Requests camera permission only after **Open camera** is selected.
- Uses the environment-facing camera when supported and retains photo import as the universal fallback.
- Keeps Muse out of the way; brief photo guidance is skippable and replayable.

### Recoverable local original

- Added a versioned IndexedDB database and `memory-story-drafts` store.
- Stores the stable draft ID, entry path, locale, state, original `Blob`, SHA-256 checksum, capture metadata, inspection result, manual acceptance, and timestamps.
- Recovers the same review or ready state after browser reload.
- Keeps offline capture local and labels the state honestly.
- Does not upload, transform, overwrite, or expose the imported original.

### Quality guidance and choice

- Added lightweight, capability-safe checks for minimum resolution, bright glare, heavy shadow/low contrast, and focus/detail.
- Shows only the highest-priority corrective instruction.
- Keeps framing and steadiness guidance visible during capture.
- Allows **Use this photo anyway** after every warning.
- Retains the warning and original bytes when manual acceptance is recorded.

### Permission and failure recovery

- Camera denial returns to an import-first recovery state without losing the draft.
- Unsupported camera behavior uses the same fallback rather than blocking the person.
- File type and the centrally configured 25 MiB image limit are validated before local inspection.
- Storage and image-read failures state that nothing was uploaded or shared.

### Scale boundary

- Local draft state is an explicit versioned record independent of React component memory.
- Browser persistence and photo inspection remain narrow services.
- No fake R2 transport, server durability, authentication, voice recording, or completion state was added ahead of its owning packet.
- CI now covers all `packet-*/**` branches so later packet gates cannot silently skip browser evidence.

## Product Invariant evidence

| Invariant | Packet 2 evidence |
| --- | --- |
| I-06 Immutable originals | Imported bytes are stored as the original `Blob`; quality inspection and manual acceptance do not replace it. |
| I-08 Saved means durable | The UI uses local-only language and explicitly says the photograph is not backed up. |
| I-11 Technology background | The route speaks about the photograph, light, and story—not IndexedDB, hashes, models, or storage architecture. |
| I-13 Recoverable guidance | Photo tips are skippable/replayable; denial and reload return to a useful step. |
| I-14 Accessibility | Large actions, route-heading focus, live recovery/status messages, keyboard traversal, reduced-motion inheritance, and no phone-width overflow are covered. |
| I-22 Central limits | Image size and MIME checks read the central Phase 1 configuration. |

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 8 files and 31 tests.
- `npm run test:schema`: passed.
- `npm run build`: passed.
- `npm run deploy:dry-run`: passed; no deployment occurred.
- `npx playwright test --list`: passed, 6 phone-Chromium tests discovered.
- GitHub Actions CI run `29496575881`: passed every step, including Playwright Chromium installation and all 6 phone-first tests.
- `git diff --check`: passed.

The workspace's Playwright browser download endpoint returned an empty archive, so local browser execution was unavailable. The same pinned dependency and committed tests executed successfully in GitHub Actions; this limitation was not reported as a product pass until that independent run succeeded.

## Browser evidence covered

- Approved first screen and emotional language.
- Both entry paths produce stable local capture URLs.
- Imported original survives reload in IndexedDB.
- No false durable-save or completion copy appears.
- Camera permission is requested only after the contextual action.
- Camera denial retains import and retry paths.
- A capability-qualified synthetic camera captures and accepts a photograph.
- Route focus, keyboard action order, and phone-width overflow pass.

## Deliberately deferred

- R2 upload, D1 media receipt, retry transport, and independent durable retrieval: Packet 3.
- Original voice recording, local audio recovery, upload, and playback: Packet 3.
- Account binding and draft promotion: Packet 4.
- Transcription and Muse processing: Packet 5.
- Review completion and private sharing: Packets 6–7.
- Physical-device camera evaluation and manual screen-reader review: final Phase 1 acceptance gate.

## Next bounded task

Packet 3 — immutable photo and voice durability. The task queue activates Packet 3 and no later packet.

