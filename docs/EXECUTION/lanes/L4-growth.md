# L4 — Growth

**Scope:** Share handoff (G02); referral events (G03); landing page (G04); share page headers.
**Migration numbers:** 0028–0029
**Owns:** worker/sharing.ts, app/features/first-experience/, worker/referral.ts, public/, app/localization/catalog/growth.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

Paused for an owner decision on G04. L4.1–L4.2 merged; L4.4 share-page headers landed with L7.1.

## Merged

- L4.1 share handoff and L4.2 referral events — PR #67, `fcb6106`.
- L4.4 share-page headers — with L7.1, PR #57.

## Evidence level reached

L4.1–L4.2: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/SHARE_HANDOFF_AND_REFERRAL_2026-11-16.md`); real-device handoff pending.

## Next

Lane paused at L4.3 pending the owner question below.

## Waiting on the owner

- **G04 landing page.** The current first screen already explains the product in English and Spanish and leads straight to capture. The first-five-minute decision (2026-07-15) rejects starting with a product tour, and `docs/FOUNDATION/03_USER_EXPERIENCE.md` governs this screen. Adding a demonstration section (synthetic photograph and voice) or a separate marketing page changes a locked contract, so it needs an owner decision: keep the first screen as the landing page, add a short demonstration below the first actions, or build a separate public page that links to capture.
