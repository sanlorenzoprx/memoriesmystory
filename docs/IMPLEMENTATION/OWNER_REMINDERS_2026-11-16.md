# Opt-in owner reminders (A3, L2.5)

**Result:** PARTIAL — implemented and locally proven with a test double. The wording follows the D6 default and awaits the owner's approval; nothing is sent until O2 and `PUBLIC_APP_ORIGIN`.
**Base:** `main` after PR #66.
**Authority:** V1 launch handoff lane L2 item 5, under the stated default for decision D6: "Off by default; monthly at most; one-step unsubscribe."

## Outcome

An owner who turns on "Email me an occasional reminder to add a memory" gets a short bilingual email that:
- asks whether there is a photograph they have been meaning to talk about, and links to the start screen;
- says it comes at most once a month because they asked for it;
- carries a one-step unsubscribe link and one-click headers.

It is sent at most once per calendar month and never within 28 days of the previous one. It is not sent if the owner finished a Living Memory in the last 30 days.

## Promises protected

- **Consent:** opt-in only; one click stops it; the cadence is stated in the email itself.
- **Monthly at most, enforced by the database:** a partial unique index allows one `sent` row per person per month.
- **No memory content:** no title, words, photograph or names.
- **No pressure or reward:** gentle wording with no streaks, counts or incentives.

## Change

- `migrations/0038_owner_reminders.sql`, allocated by the coordinator (L2's range was used) and recorded in the handoff's migration table.
- `worker/notifications.ts`: `ownerReminderEmail` and `runOwnerReminderPass`, run from the daily cron, which logs counts only.

## Evidence

| Check | Result |
| --- | --- |
| Integration `tests/integration/owner-reminders.test.ts` | 3 pass: off records nothing; one reminder with start link, cadence statement, unsubscribe headers and no content; not again the same day, the same month, or within 28 days across a month boundary; sent again after that; silent without opt-in or after a recent memory |

## Waiting on the owner

D6: approve or change the cadence and the wording above.

**Reversible:** yes. **Migration:** 0038. **Production deployed:** no.
