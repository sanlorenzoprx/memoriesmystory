# L2 — Messaging

**Scope:** Cloudflare Email adapter; invitations by email; preferences and unsubscribe; notifications to invited family; owner reminders. Sending stays off until owner inputs O2 and D6.
**Migration numbers:** 0022–0024
**Owns:** worker/providers/email-provider.ts, worker/notifications.ts, app/features/notifications/, app/localization/catalog/messaging.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L2.1 email adapter and L2.2 invitations by email implemented by the coordinator, sending off, CI pending.

## Merged

None yet.

## Evidence level reached

L2.1–L2.2: INTEGRATION_PROVEN locally with a test double (receipt `docs/IMPLEMENTATION/INVITATION_EMAIL_2026-11-16.md`); migration 0022.

## Next

L2.3 preferences and signed one-step unsubscribe; L2.4 "something new is waiting" notices to invited family (sending off).

## Waiting on the owner

- O2: sending domain onboarded for Cloudflare Email and the sender address.
- D6: reminder cadence and wording (default: off, monthly at most, one-step unsubscribe).
