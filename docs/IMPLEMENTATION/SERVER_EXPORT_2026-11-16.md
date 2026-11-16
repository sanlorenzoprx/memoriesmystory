# Server-built export for large archives (L3)

**Result:** PARTIAL — implemented and proven against the real schema with test storage; needs a staging run with a real large archive.
**Base:** `main` `dfe33dc` (PR #77).
**Authority:** owner request 2026-11-16; V1 launch handoff group A item A4 ("server-built export for large archives").

## Outcome

When an archive is too large to prepare on one device (over 1.5 GB), the export panel offers **Prepare it on our server**:
1. A background job reads each original once, in steps of up to 40 files or 256 MB. It records the CRC-32 the ZIP needs and confirms the SHA-256 against the preserved record. Progress shows as "Checked N of M files".
2. A file that no longer matches its record is left out and named, exactly as the device export does.
3. The archive is offered in **parts of up to 1.5 GB**, split between memories. Each part is a complete ZIP with its own `manifest.json` and `index.html`, so **Check an export** confirms each part on its own.
4. Parts are kept for **seven days**, then removed. Deleting a memory removes its owner's prepared exports at once.

## How it avoids copying gigabytes

Nothing large is held in memory or copied:
- A download streams each file's 30-byte ZIP header and then the stored original itself.
- It ends with a small prepared tail: `manifest.json`, `index.html` and the ZIP directory.
- Before a byte is sent, every original's size is checked again. If one changed or disappeared, the download is refused with `409` rather than producing a broken file.

## Promises protected

- **Originals byte-identical:** stored entries are never re-encoded. A test compares every packaged original with storage.
- **Honest completeness:** unmatched files are named; a multi-part export never claims to be complete in one part.
- **Owner only:** another account sees nothing.
- **Deletion means deletion:** prepared parts hold transcripts and media, so they are purged on memory deletion and on expiry by the daily job.

## Change

- `migrations/0026_server_exports.sql`.
- `worker/server-export.ts`: create, step, finalize, stream, purge, and the routes under `/resources/archive-export/jobs`.
- `worker/index.ts`: the route, the queue dispatch (export steps and transcription share the queue) and the daily purge.
- `worker/deletion.ts`: purges the owner's prepared exports.
- `worker/archive-export.ts`: exports `buildArchiveManifest` and `fileSources`, so the server uses exactly the device manifest.
- `app/domain/archive-export.ts`: shared `zipLocalHeader`, `zipCentralDirectory` and `crc32Update`. The device ZIP writer now uses the same helpers.
- `app/domain/archive-export-wording.ts`: index wording shared by device and server.
- `ArchiveExportPanel.tsx`: the offer, progress and part links, with Spanish copy.

## Evidence

| Check | Result |
| --- | --- |
| Integration `tests/integration/server-export.test.ts` | 5 pass: job checked in steps (6 files, 3 steps); same job returned while building; downloaded ZIP confirmed by the app's own checker; each packaged original byte-identical to storage; manifest names its part and language; split into three whole-memory parts that each check on their own; a changed original left out, named and the export marked incomplete; a changed original after checking refuses the download; another account sees nothing; purge on deletion and on expiry |
| Browser `tests/e2e/server-export.spec.ts` (EN, ES) | Too-large archive offered on the server; progress shown; part links for each part |
| Existing device and album export journeys | Pass (the album stub now answers the job status request separately) |
| `npm run verify:core` | Pass — 353 tests in 83 files; schema 151 objects |
| Full phone-viewport suite locally | 99 pass |
| Staging with a real multi-gigabyte archive | NOT_RUN |

**Reversible:** yes. **Migration:** 0026. **Production deployed:** no.
