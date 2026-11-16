# Album export (G01, L1.2)

**Result:** PARTIAL — implemented and locally proven; CI, device and human acceptance pending.
**Base:** `main` `bc39ce7` (PR #58).
**Authority:** owner decision 2026-11-15, `docs/DECISIONS/2026-11-15-albums-reminders-export-tiers.md` (answer 5: basic and premium can both export albums).

## Human outcome

From **Export my archive**, an owner can choose the whole archive, one album, or one Chapter. An album copy is a ZIP the owner saves to their device. It opens without the app as a readable page titled "Album: …", with each Chapter in order followed by its memories, plus `manifest.json` with the SHA-256 of every file. Every file is downloaded, re-hashed and compared with the preserved original before it is packaged, exactly as the archive export does. It works on every plan.

## Promises protected

- **Originals are immutable and provable:** stored ZIP entries hold byte-identical originals, checked on the device before packaging.
- **Creator control and privacy:** an album copy is easy to hand to relatives. It therefore carries only the owner's own recollections and the versions the owner included for family. A relative's recollection or voice the owner has not included is never downloaded, and its count is named under "Not included". People and relationship notes stay in the full archive export.
- **Truthful completeness:** account-wide counts, such as unfinished memories elsewhere, are not claimed for one album. A truncated archive's notice is kept, because the album may be missing memories too.
- **No reward for sharing:** export is not counted, credited or tracked.

## Change

- `worker/archive-export.ts`: the manifest gains `albums` (id, title, description, Chapter ids in order), and each Chapter gains `albumId`. Both are additive fields within format version 1. No migration.
- `app/domain/album-export.ts`: `albumExportChoices` and `selectAlbumExport`.
- `app/domain/archive-export.ts`: the readable page can render in album order, with heading levels kept consistent.
- `app/features/family-archive/ArchiveExportPanel.tsx`: the choice of what to export, the album wording and the file name `family-album-export-<date>.zip`.
- `app/localization/catalog/albums.ts`: Spanish copy.

## Evidence

| Check | Result |
| --- | --- |
| `npm run verify:core` | Pass — 293 tests in 68 files, build and deploy dry run |
| Unit `tests/unit/album-export.test.ts` | 6 pass: choices, album and Chapter selection, family-visibility filter, omission notices, album-ordered escaped page |
| Integration `archive-export.test.ts` | Albums and Chapter `albumId` in the manifest; another account sees no albums |
| Browser `tests/e2e/album-export.spec.ts` (EN, ES) | 2 pass: only the chosen album's original is fetched and packaged; the private voice is never fetched; the page is titled for the album |
| Existing `archive-export.spec.ts` | 2 pass, unchanged |
| Staging / device / human | NOT_RUN |

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
