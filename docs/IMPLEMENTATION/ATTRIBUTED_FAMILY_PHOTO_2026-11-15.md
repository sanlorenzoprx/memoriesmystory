# E04c — Independent attributed supplementary family photographs

**Result:** PARTIAL — implemented and locally proven; clean-install CI, hosted identity, real storage, device and human acceptance pending.
**Base:** `main` `a9cc1c7ddbdc5065385fef2c28ddb7810a601ef2` (PR #45: share-link routing and E04b voice recollections).
**Scope:** the third E04 slice. Each author's transcript review of a contributed voice remains required; this is not whole-E04 completion.

## Human outcome

An owner or invited contributor can add a photograph of their own to a Living Memory — for example the back of the print, or another picture from that day — choose how they are named, and submit it for the owner's review. The file is kept exactly as provided: it is never resized, re-encoded, corrected or described by a model. It is private until the owner includes it, and it never replaces or alters the Living Memory's own original photograph. An added photograph cannot be revised in place; the author withdraws it and adds another.

**Promises protected:** original photograph immutable and primary; contributions additive and separately attributed; private by default with explicit owner inclusion; "saved" only after durable confirmation; no generated or inferred content (no captioning, OCR, face or identity matching).

## Change

- Migration `0019_family_photo_contributions.sql`: immutable `family_contribution_photo_sources`, authorship and immutability triggers, guards so one contribution holds exactly one kind of source, and the `family_contribution_sources` view recreated to include photographs. Tables from 0017 and 0018 are not altered.
- Worker: the E04b upload and playback paths now serve both kinds (`/voice`, `/photo`) through one implementation: session, request header and same-origin, explicit review choice, supported type with matching file signature, size bound, client SHA-256 matching received bytes, access checked before storage and again inside the D1 batch, private per-attempt R2 key confirmed by head and read-back hash before any record exists, same-key replay, removal of the attempt's object on any failure. Playback is limited to owner, author, or invited family when the owner-included version is that source and its grant still holds. A source is not reachable through the other kind's address.
- Whole-memory deletion removes family photograph objects with the voices.
- Client: choose a photograph, see it, submit after naming and choosing review; truthful saved notice after an authoritative read-back; same-key retry after a failed send; English and Spanish copy. The recollection form now lays out one field per line.

## Evidence

| Check | Result |
| --- | --- |
| New Worker tests | 3 pass: exact bytes private until inclusion with the memory's own originals unchanged; cross-kind address refused; viewer, consent, checksum, non-image, signature, CSRF and session refusals store nothing; replay and changed-retry conflict; no revision or rewrite; revocation hides from family; removed with the memory |
| `npm run verify:core` | Pass — typecheck, lint, 248 tests in 56 files, 100 schema objects, build, deploy dry run |
| New browser journeys (EN, ES) | 2 pass: chosen file shown, blocked until named and review chosen, failed send keeps the photograph with no saved claim, retry sends the same key, and the bytes sent equal the chosen file's SHA-256 |
| Full phone-viewport suite locally | 53 pass; 9 not run |
| Phone-viewport screenshots (EN, ES) | Reviewed; no horizontal overflow |
| Staging / real R2 and D1 / hosted Clerk / real device / human | NOT_RUN |

The nine checks not run are all in `tests/e2e/legacy-recording.spec.ts`, which launches its own browser build that is not installed in the review sandbox. Clean-install CI is the authority for the full suite.

## Known limits and open decisions

- **Size limit** is 15 MiB (`familyContributions.photoBytes`), below the 25 MiB solo-photo limit, because the Worker buffers the file to hash and confirm it. Raise it with a streaming upload if real phone photographs exceed it.
- **HEIC/HEIF** files are accepted and preserved, but most non-Apple browsers cannot display them; no converted viewing copy is made yet.
- **Reload recovery:** an unsent photograph lives only in the open page, and the page says so.
- **No pairing semantics:** a photograph is not yet marked as "back of this print"; it is simply an attributed addition.
- **Contributor rights** (owner deletion removes contributions; withdrawn sources remain available to the owner) follow existing behaviour and remain owner policy decisions.
- **Export:** F01 must include these photograph originals and hashes.

Migration 0019 is required before a matching deployment. **Reversible:** yes (additive schema; the view is recreated). **Production deployed:** no.
