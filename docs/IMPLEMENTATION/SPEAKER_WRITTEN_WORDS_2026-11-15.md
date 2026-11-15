# E04d — The speaker's own written words for a voice recollection

**Result:** PARTIAL — implemented and locally proven; clean-install CI, hosted identity, device and human acceptance pending.
**Base:** `main` `8d03ab0e206ac25b130aa6ef90a724856b3161de` (PR #46).
**Scope:** closes the "each author reviews their own transcript" part of E04 with speaker-written words. A machine-drafted transcript of a contributor's voice is deliberately not included (see Open decisions).

## Human outcome

The person who recorded a voice recollection can write the words they said beside it, and change them later. Every version is kept. Only the speaker can write them; the owner cannot edit another person's words. Invited family sees the written words only when the owner includes a specific version, and only beside an included voice. A later version stays private until the owner reviews it. Excluding or withdrawing the voice removes its written words from family view, and a later inclusion needs a fresh owner choice. The recording itself never changes.

**Promises protected:** the real voice stays the primary, immutable source; written words are the speaker's own testimony, never a machine or third-party rewrite; additive history; private by default with explicit owner inclusion; no Muse or model output is presented as testimony.

## Change

- Migration `0020_family_voice_written_words.sql`: append-only `family_contribution_voice_transcripts` (speaker-written, immutable, linked to the previous version), `family_contribution_transcript_pins` (the owner's chosen version), and triggers enforcing speaker-only authorship on a voice contribution, owner-only pinning beside an included voice, and automatic removal of the pin when the voice is excluded or withdrawn. No earlier table is altered.
- Worker: `POST …/:contributionId/transcript` (speaker, explicit review choice, version check, idempotent, access re-checked inside the batch), `POST …/:contributionId/transcript-assembly` (owner include/exclude of one version), `GET …/:contributionId/transcript` (paginated history for speaker and owner only). The contribution list returns `writtenWords.latest` to the speaker and owner and `writtenWords.included` to invited family only while the voice is family-visible.
- Client: `ContributionWrittenWords` under each voice recollection; saved notice only after an authoritative read-back; same-key retry after a failed save keeps the typed words; English and Spanish.

## Evidence

| Check | Result |
| --- | --- |
| New Worker tests | 3 pass: speaker-only writing; consent, stale-version and replay behaviour; all versions kept and immutable; family sees only the pinned version beside an included voice; later versions stay private; owner-only inclusion; history denied to family and other contributors; exclusion and withdrawal clear family view; photographs and text cannot carry speaker words; deleted with the memory |
| `npm run verify:core` | Pass — typecheck, lint, 251 tests in 56 files, 108 schema objects, build, deploy dry run |
| New browser journeys (EN, ES) | 2 pass: failed save keeps the words with no saved claim; retry reuses the key; waiting-for-review state; owner has no edit control and includes the version |
| Full phone-viewport suite locally | 55 pass; 9 not run |
| Staging / hosted Clerk / real device / human | NOT_RUN |

The nine checks not run are all in `tests/e2e/legacy-recording.spec.ts`, which launches its own browser build that is not installed in the review sandbox. Clean-install CI is the authority for the full suite.

## Open decisions and known limits

- **Machine-drafted transcripts for contributors are not built.** Sending a relative's voice to the transcription provider is a new use of their recording that the current contribution agreement (`family-contribution-review-v1`) does not describe. Offering an optional machine draft for the speaker to correct needs an owner-approved, versioned consent wording first.
- **Unsaved written words** live only in the open page; a reload loses them.
- **Contributor rights** (owner deletion removes contributions and their written words; withdrawn sources remain available to the owner) follow existing behaviour and remain owner policy decisions.
- **Export:** F01 must include every written-words version and the pinned choice.

With this slice the four E04 source kinds exist: written recollection, voice recollection, supplementary photograph, and the speaker's written words. E04 acceptance still needs hosted identity, real devices, people, and the policy decisions above.

Migration 0020 is required before a matching deployment. **Reversible:** yes (additive schema). **Production deployed:** no.
