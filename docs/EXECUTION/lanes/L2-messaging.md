# L2 — Messaging

**Scope:** Cloudflare Email adapter; invitations by email; preferences and unsubscribe; notifications to invited family; owner reminders. Sending stays off until owner inputs O2 and D6.
**Migration numbers:** 0022–0024
**Owns:** worker/providers/email-provider.ts, worker/notifications.ts, app/features/notifications/, app/localization/catalog/messaging.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

Complete with sending off. L2.1–L2.5 and the owner decision 2026-11-16 follow-up (Resend first, chosen cadence, direct links; PR #70, `74968e6`) merged.

## Merged

- L2.1 email adapter and L2.2 invitations by email — PR #64, `4fa3fbd`.
- L2.3 preferences and one-step unsubscribe — PR #65, `fda32f6`.
- L2.4 family update notices and L2.5 owner reminders — PR #66, `bd70a0f`.

## Evidence level reached

L2.1–L2.2: INTEGRATION_PROVEN with a test double (receipt `docs/IMPLEMENTATION/INVITATION_EMAIL_2026-11-16.md`); migration 0022.
L2.3: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/EMAIL_PREFERENCES_2026-11-16.md`); migration 0023.
L2.4: INTEGRATION_PROVEN with a test double (receipt `docs/IMPLEMENTATION/FAMILY_UPDATE_NOTICES_2026-11-16.md`); migration 0024.
L2.5: INTEGRATION_PROVEN with a test double (receipt `docs/IMPLEMENTATION/OWNER_REMINDERS_2026-11-16.md`); migration 0038 (allocated by the coordinator).

## Next

Lane complete with sending off. Turning sending on needs O2, `PUBLIC_APP_ORIGIN` and D6 approval of the reminder wording.

## Waiting on the owner

- O2: sending domain onboarded for Cloudflare Email and the sender address.
- D6: reminder cadence and wording (default: off, monthly at most, one-step unsubscribe).
