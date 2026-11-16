# Export verification on the device (A4, L3.1)

**Result:** PARTIAL — implemented and locally proven; CI, real-device and human acceptance pending.
**Base:** `main` after PR #60.
**Authority:** V1 launch handoff, group A item A4 (lane L3, packet 1).

## Outcome

On the archive page, **Check an export** lets a signed-in person choose an archive or album export they saved earlier. Every file is re-hashed with SHA-256 and compared with the `manifest.json` inside the same ZIP, one file at a time, entirely on the device. Nothing is uploaded or changed.

The result names:
- how many listed files match;
- each file that changed since the export was made;
- how many listed files are missing;
- how many files were added that the export never listed.

When the export itself said it was incomplete, the check says so and points to its `index.html`. A ZIP that was recompressed, encrypted, damaged, not an export, or in an unsupported format is refused with plain wording in English and Spanish.

## Promises protected

- **Originals are provable:** a family can show, years later and without the service, that the bytes they hold are the bytes that were preserved.
- **Honesty about limits:** the page states that it proves the files match the list, not that the list was never edited, because format version 1 has no signature.
- **Privacy:** the export never leaves the device. The browser test asserts that no non-GET request is made.

## Change

- `app/domain/archive-export-verify.ts`: a stored-ZIP central-directory reader with bounded reads and refusals for ZIP64, encryption and compression, plus `verifyArchiveExport`.
- `app/features/continuity/ExportCheckPanel.tsx`, shown on `/archive` once the archive loads.
- `app/localization/catalog/continuity.ts`: Spanish copy and the seven refusal codes.

## Evidence

| Check | Result |
| --- | --- |
| Unit `tests/unit/archive-export-verify.test.ts` (built with the app's own `buildStoredZip`) | 4 pass: whole export with progress; changed, missing and added files named; export's own incompleteness carried; non-ZIP, compressed, no-manifest, wrong-format and truncated files refused |
| Browser `tests/e2e/export-check.spec.ts` (EN, ES) | 2 pass: a matching export, a changed file named by path, a non-ZIP refused, nothing sent |
| `npm run verify:core` | Pass — 302 tests in 70 files |
| Full phone-viewport suite locally | 75 pass; 9 not run (sandbox-only `legacy-recording.spec.ts`) |
| Large export on a real phone | NOT_RUN — memory use follows the largest single file; confirm with a 1 GB export |

## Not done here

- Server-built export for archives over the device limit (L3.2 or later).
- A signed manifest (would need a format version 2 decision).

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
