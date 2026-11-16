# L2 — Messaging

**Scope:** Cloudflare Email adapter; invitations by email; preferences and unsubscribe; notifications to invited family; owner reminders. Sending stays off until owner inputs O2 and D6.
**Migration numbers:** 0022–0024
**Owns:** worker/providers/email-provider.ts, worker/notifications.ts, app/features/notifications/, app/localization/catalog/messaging.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress, sending off. L2.1–L2.3 merged; L2.4 family update notices implemented by the coordinator, CI pending.

## Merged

- L2.1 email adapter and L2.2 invitations by email — PR #64, `4fa3fbd`.
- L2.3 preferences and one-step unsubscribe — PR #65, `fda32f6`.

## Evidence level reached

L2.1–L2.2: INTEGRATION_PROVEN with a test double (receipt `docs/IMPLEMENTATION/INVITATION_EMAIL_2026-11-16.md`); migration 0022.
L2.3: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/EMAIL_PREFERENCES_2026-11-16.md`); migration 0023.
L2.4: INTEGRATION_PROVEN locally with a test double (receipt `docs/IMPLEMENTATION/FAMILY_UPDATE_NOTICES_2026-11-16.md`); migration 0024.

## Next

L2.5 opt-in owner reminders: waits on D6 cadence and wording; the preference and unsubscribe already exist.

## Waiting on the owner

- O2: sending domain onboarded for Cloudflare Email and the sender address.
- D6: reminder cadence and wording (default: off, monthly at most, one-step unsubscribe).
