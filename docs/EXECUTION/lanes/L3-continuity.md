# L3 — Continuity

**Scope:** Export verification page; server-built export; fixity checks; backup and restore rehearsal; stewardship behind an off switch.
**Migration numbers:** 0025–0027
**Owns:** worker/archive-export.ts, worker/deletion.ts, worker/fixity.ts, worker/stewardship.ts, docs/OPERATIONS/, app/localization/catalog/continuity.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L3.1 merged; L3.2 fixity checks implemented by the coordinator, CI pending.

## Merged

- L3.1 export verification — PR #61, `c65a95a`.

## Evidence level reached

L3.1: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/EXPORT_VERIFICATION_2026-11-16.md`). A large export on a real phone is still needed.
L3.2: INTEGRATION_PROVEN locally (receipt `docs/IMPLEMENTATION/FIXITY_CHECKS_2026-11-16.md`); migration 0025.

## Next

A server-built export for archives over the device limit; backup and restore rehearsal with L8 on staging.

## Waiting on the owner

—
