# L7 — Hardening and trust

**Scope:** Security headers and CSP; rate limiting and Turnstile; error fallback, dead-letter queue, invitation secret; dependency audit in CI; legal pages with placeholder text and versioned acceptance; threat model and observability; route splitting and accessibility.
**Migration numbers:** 0034–0035
**Owns:** worker/index.ts structure, worker/rate-limit.ts, public/_headers, app/features/legal/, docs/SECURITY/, app/localization/catalog/hardening.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

Not started.

## Merged

None yet.

## Evidence level reached

—

## Next

The first packet in section 4 of `../V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md`.

## Waiting on the owner

—
