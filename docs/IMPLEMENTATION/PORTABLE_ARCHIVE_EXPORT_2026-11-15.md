# F01a — Portable archive export with verified originals

**Result:** PARTIAL — implemented and locally proven; clean-install CI, real storage, hosted identity, device and human acceptance pending. The export format does not yet carry every source type (see Not yet exported).
**Base:** `main` `344a96f6609d20e5ab908979e43de3bccccc6600` (PR #49).

## Human outcome

An owner can take a copy of their archive with them. On the archive page they prepare an export; the device downloads every original, re-computes its SHA-256 and compares it with the preserved original before packaging it into one ZIP file. The ZIP holds the untouched originals, a `manifest.json` listing every file with its hash, and an `index.html` a person can open without the app. The page and the index both say plainly whether the export is complete and list anything that is missing. A file that fails the check is left out and named, never packaged as if it were the original.

**Promises protected:** portable and understandable archive; originals byte-identical and provable; human testimony, machine transcripts and Muse questions kept in separately labelled fields; "complete" is claimed only when nothing is missing; no bearer links, storage keys or account identifiers leave in an export.

## Change

- `app/domain/archive-export.ts`: format version 1 types; a stored (uncompressed) ZIP writer so originals stay byte-identical; CRC-32; an escaped, localizable readable index.
- `worker/archive-export.ts`, owner only:
  - `GET /resources/archive-export/manifest` — complete memories with titles; original photograph and voice; corrected scans with the id of the original they derive from; voice replies to Muse; every transcript version labelled machine or person, with the current one marked; the storyteller's context with history and the current answer marked; the Muse conversation with speakers labelled; family contributions (written versions, voice and photograph sources, speaker-written words, the owner's inclusion choices) with the contributor's chosen attribution; Chapters with ordered memory references; named people and relationships.
  - `GET /resources/archive-export/file/:kind/:id` — one durable original with its SHA-256 header, resolved through memory ownership; a missing stored object is a 503, never a partial file.
  - `notIncluded` states what is left out with counts, and `complete` is false whenever that list is not empty.
- Client: `ArchiveExportPanel` on the archive page with progress, the completeness statement, the not-included list and an explicit save link. English and Spanish, including the readable index.
- No migration. Nothing in the archive is written or changed by exporting.

## Evidence

| Check | Result |
| --- | --- |
| Unit tests | 3 pass: CRC-32 against Node's; stored ZIP read back by an independent reader with every entry byte-identical under UTF-8 paths; index escapes people's words, labels a machine transcript, and never hides an incomplete export |
| Worker tests | 5 pass: every listed file downloads with matching size and hash header (real hash for the uploaded contribution); context history with the current answer marked; contributions, speaker-written words, Chapters and people present; withdrawn recollection left out and counted; no storage keys, tokens, account ids or emails in the manifest; another account gets an empty manifest and 404s; a contributor cannot pull the owner's files; session and method checks; kind/id mismatch refused; missing object is a 503; unfinished memories counted |
| `npm run verify:core` | Pass — typecheck, lint, 271 tests in 62 files, 108 schema objects, build, deploy dry run |
| Browser journeys (EN, ES) | 2 pass: a real ZIP is downloaded and parsed; a same-length, wrong-bytes file is left out and the export is marked incomplete; a second run round-trips every original to its manifest hash |
| Full phone-viewport suite locally | 63 pass; 9 not run |
| Staging / real R2 and D1 / hosted Clerk / real device / human | NOT_RUN |

The nine checks not run are all in `tests/e2e/legacy-recording.spec.ts`, which launches its own browser build that is not installed in the review sandbox. Clean-install CI is the authority for the full suite. The shared test fixture stores placeholder hashes for its two solo originals, so the byte-hash round trip in the Worker suite is asserted on the contribution that went through the real upload path.

## Not yet exported (stated in every affected export)

- **Our Living Legacy recordings**: in-person and remote session originals, participant consent records, attribution claims. These are required by F01 and are the next export slice.
- **Withdrawn family recollections**: left out pending the contributor-rights decision; counted in `notIncluded`.
- **Unfinished memories**: counted, not exported.
- Share-link inventory, scan correction parameters, people history versions, product events and receipts are not in format version 1.

## Known limits and open decisions

- **Built on the device.** The export is assembled in the browser, limited to 1.5 GB, and held in memory while it is built. A large archive or an older phone will need a server-built export; nothing is changed if the limit is reached.
- **Not encrypted.** The ZIP has no password; the page says so. Encryption needs a decision about how the person keeps the key.
- **Restore** from an export into an archive is not built; this slice proves the files and manifest round-trip, not re-import.
- **Contributor export rights** are still an owner policy decision: the owner's export includes relatives' submitted contributions, which the owner can already read in the app.
- No rate limit yet on these routes (review finding F3).

**Reversible:** yes (no schema change). **Production deployed:** no.
