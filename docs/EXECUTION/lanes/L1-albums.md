# L1 — Albums and keepsakes

**Scope:** Person albums; album export (G01); reload-safe unsent media; HEIC viewing copy; relative-added images (blocked on owner decision D3).
**Migration numbers:** 0036–0037
**Owns:** app/features/family-archive/ (album, people, export panels), worker/people-routes.ts, app/domain/archive-export.ts, app/domain/album-export.ts, app/localization/catalog/albums.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L1.1 and L1.2 merged.

## Merged

- L1.1 person albums — PR #58, `bc39ce7`.
- L1.2 album export — PR #59, `cb550d4`. The ZIP keeps the archive export's `index.html` and `manifest.json` names rather than `album.html` and `sources.json`, so one verification reader serves both.

## Evidence level reached

L1.1: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/PERSON_ALBUMS_2026-11-16.md`).
L1.2: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/ALBUM_EXPORT_2026-11-16.md`).

## Next

L1.3 reload-safe unsent media; L1.4 HEIC viewing copy. Relative-added images wait on owner decision D3.

## Waiting on the owner

—
