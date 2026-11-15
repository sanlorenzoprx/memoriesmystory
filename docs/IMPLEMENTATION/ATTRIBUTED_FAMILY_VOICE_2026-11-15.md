# E04b — Independent attributed family voice recollections

**Result:** PARTIAL — implemented and locally proven; clean-install CI, hosted identity, real storage, device and human acceptance pending.
**Base:** `main` `d0a550b0a9cd7b6920f3cdfb8d1f5307917d75da` plus the share-link routing fix on `claude/wonderful-einstein-lhk453`.
**Scope:** the second E04 slice. Supplementary-photo contributions and each author's transcript review remain required; this is not whole-E04 completion.

## Human outcome

An owner or an invited contributor can record a recollection about a photograph in their own voice, choose how they are named, listen to it, and submit it for the owner's review. The recording is preserved exactly as spoken. It is private until the owner includes it; invited family then hears that person's real voice beside the other recollections. A written account and a spoken account of the same photograph stay separate and separately attributed. Nothing is transcribed, summarized or generated from the voice in this slice.

A spoken original is never revised in place. To say it differently, the author withdraws it and records a new one. Withdrawal, or loss of the author's access, hides it from invited family while the owner keeps the preserved source and the author can still hear and withdraw their own.

**Promises protected:** the real voice is the primary source and is immutable; differing recollections are preserved, not reconciled; private by default with explicit owner inclusion; "saved" only after durable confirmation; human testimony stays distinct from Muse material (none is produced here).

## Persistence, privacy and recovery

- Migration `0018_family_voice_contributions.sql` adds `family_contribution_voice_sources` (one immutable voice per contribution: private R2 key, content type, byte size, SHA-256, R2 ETag, duration, attribution, agreement version, source grant), database triggers for authorship, immutability and no mixing of text and voice inside one contribution, and the read-only view `family_contribution_sources` that presents text revisions and voice sources in one shape. Migration 0017's tables are not altered.
- `POST /resources/family-contributions/:memoryId/voice` requires the account session, the request header and same-origin check, an explicit review choice at the current agreement version, a supported audio type with a matching file signature, a duration within the limit and a client SHA-256 that matches the received bytes. Access is checked before anything is written to storage and again inside the D1 batch that creates the contribution, receipt, voice source and event.
- The voice is written to a per-attempt private key under `contributions/<memory>/<contribution>/…`, then confirmed by head (size, ETag) and by re-hashing a read-back before any D1 record exists. If storage, confirmation or authorization fails, that attempt's object is removed and no record or receipt is created. A retry with the same key replays the first result without storing a second object; a changed retry conflicts.
- `GET /resources/family-contributions/:memoryId/:contributionId/voice` streams the original (full or ranged) to the owner, the author, or an invited family member only when the owner-included version is this voice and its source grant still holds. Authorization is re-checked after the storage read. Responses are `private, no-store`.
- Whole-memory deletion now removes every family voice object for the memory, including unreferenced attempt objects, before the D1 cascade.
- The existing list, history, owner inclusion and withdrawal routes read through the view, so review and family visibility behave the same for both kinds.
- Client: `ContributionVoiceRecorder` records on the device, stops the microphone if permission arrives after the panel closed, and lets the person listen and record again. The panel shows the saved notice only after the server acknowledgement and an authoritative read-back of the person's own voice contribution. A failed send keeps the recording and reuses the same key on retry. English and Spanish copy added.

## Evidence

| Check | Result |
| --- | --- |
| New Worker tests (`family-voice-contributions.test.ts`) | 7 pass: exact bytes preserved; private until inclusion; owner/author/family playback incl. ranged; text and voice kept separate; replay without a second object; changed retry conflicts; viewer, consent, checksum, format, signature, length, attribution, CSRF and session refusals store nothing; storage failure and revoked access leave nothing; no revision or rewrite; revocation and withdrawal; whole-memory deletion incl. unreferenced attempts |
| Existing text contribution tests | 10 pass unchanged |
| `npm test` | 245 tests in 56 files pass |
| `npm run test:schema` | 94 required objects, integrity and foreign keys pass |
| typecheck, lint, build, deploy dry run | Pass |
| New browser journeys (EN, ES) | 2 pass: record, listen, blocked until named and review chosen, failed send keeps the recording with no saved claim, retry sends the same key and identical bytes, saved notice, voice shown with no revise control |
| Full phone-viewport suite locally | 51 pass; 9 not run |
| Staging / real R2 and D1 / hosted Clerk | NOT_RUN |
| Real device microphone (Android, iPhone Safari) | NOT_RUN |
| Human | NOT_RUN |

The nine checks not run are all in `tests/e2e/legacy-recording.spec.ts`, which launches its own browser build that is not installed in the review sandbox. Clean-install CI is the authority for the full suite. Two older deletion fixtures were brought up to the current migration list so they exercise the real schema.

## Known limits and open decisions

- **Length limit.** Voice recollections use the same 30-second limit as the solo voice (`familyContributions.voiceSeconds`). This reuses the existing product hypothesis; it is not a new decision and should be settled with the H01 evidence.
- **Reload recovery.** An unsent recording lives only in the open page, and the page says so. Text drafts survive a reload; voice does not yet. Persisting the unsent recording on the device is a follow-up.
- **No transcript.** No machine or human transcript of a contributed voice exists yet; the author's own transcript review is the next E04 slice.
- **Contributor rights.** Owner deletion removes contributors' voices with the memory, and a withdrawn voice remains available to the owner. Both follow the existing text behaviour and remain owner policy decisions (see `REPO_AND_HANDOFF_REVIEW_2026-11-15.md`, F5).
- **Export.** F01 must include these voice originals and their hashes.
- Storage evidence is an in-memory test double; real R2 checksum behaviour is unproven until an isolated cloud run.

Migration 0018 is required before a matching deployment. **Reversible:** yes (additive schema). **Production deployed:** no.
