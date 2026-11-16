# Email preferences and one-step unsubscribe (A3, L2.3)

**Result:** PARTIAL — implemented and locally proven; nothing is sent yet (sending off until O2).
**Base:** `main` after PR #64.
**Authority:** V1 launch handoff lane L2 item 3; owner decision 2026-11-15 (email to owner and invited family).

## Outcome

**Email choices** appear on the archive page (owner: reminders and family updates) and on the family page for invited relatives (family updates). Every optional email is **off** until the person turns it on. The panel says these emails never carry memory words, photographs or titles, and that each has a link to stop them. A choice shows as saved only after the server confirms it. A failed save is said plainly and the box stays as it was.

Every optional email will carry a signed unsubscribe link that works without signing in.
- Opening the link changes nothing, because mail scanners open links. It shows one bilingual button.
- Pressing the button, or a one-click POST from a mail client (RFC 8058), turns off that one kind of email for that one person.

## Promises protected

- **Consent:** opt-in by default; every change is recorded with its source (`settings` or `unsubscribe_link`) in an append-only history.
- **Least privilege:** the link is an HMAC over one person and one kind. Changing the person, the kind or the signature, or using another deployment's secret, is refused. Another person's preference is untouched (tested).
- **Truthful saved state:** versioned writes. A stale view gets `409` and is asked to reopen.

## Change

- `migrations/0023_email_preferences.sql`.
- `worker/email-preferences.ts`: `GET`/`PUT /resources/email/preferences` (session, `X-Memories-Request: email-v1`, version check); `GET`/`POST /resources/email/unsubscribe?t=…`; `unsubscribeToken` for senders.
- `worker/index.ts` routes it. `worker/rate-limit.ts` counts the unsubscribe page as a public route.
- `app/features/notifications/EmailPreferencesPanel.tsx` on `/archive` and `/family`, with Spanish copy and error codes in `catalog/messaging.ts`.

## Evidence

| Check | Result |
| --- | --- |
| Integration `tests/integration/email-preferences.test.ts` | 3 pass: defaults off; session and header required; stale version refused; history recorded; GET changes nothing; POST turns off one kind only and is idempotent; forged person, kind, signature or secret refused with no change to anyone |
| Browser `tests/e2e/email-preferences.spec.ts` (EN, ES) | 2 pass: starts off; a failed save is said plainly and nothing is shown saved; a confirmed save is shown |
| `npm run verify:core` | Pass — 315 tests in 74 files; schema 129 objects |
| Full phone-viewport suite locally | 77 pass; 9 not run (sandbox-only) |

## Next

L2.4 notices to invited family will check `family_updates` before every send and include `List-Unsubscribe` and `List-Unsubscribe-Post` headers built from `unsubscribeToken`.

**Reversible:** yes. **Migration:** 0023. **Production deployed:** no.
