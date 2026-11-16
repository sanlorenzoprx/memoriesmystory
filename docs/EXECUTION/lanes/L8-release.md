# L8 — Staging and release

**Scope:** Whole-application staging deployment and proofs; rollback rehearsal; production runbook and launch checklist; acceptance kit. Deployment needs owner inputs O1–O4.
**Migration numbers:** none
**Owns:** scripts/, .github/workflows/ (except ci.yml), docs/OPERATIONS/, release receipts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

Not started.

## Merged

None yet.

## Evidence level reached

—

## Next

The first packet in section 4 of `../V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md`.

## Provisioning list (collected by the coordinator)

- Dead-letter queue `memoriesmystory-processing-dlq` must be created before `dead_letter_queue` is added to the processing consumer in `wrangler.jsonc` (L7, deferred from PR for L3.2).
- Rate limiting namespaces 4101–4103 (`wrangler.jsonc`) need no provisioning; confirm thresholds on staging.
- The daily fixity cron (`37 7 * * *`) runs once deployed; confirm the first pass in staging logs.

## Waiting on the owner

—
