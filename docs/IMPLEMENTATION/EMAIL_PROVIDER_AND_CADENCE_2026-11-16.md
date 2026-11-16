# Resend-first email, person-chosen reminder cadence, and direct app links

**Result:** PARTIAL — implemented and locally proven with stubbed providers; a real send needs a verified Resend domain and `RESEND_API_KEY`.
**Base:** `main` `47b5cb2` (PR #69).
**Authority:** `docs/DECISIONS/2026-11-16-sharing-agreement-email-provider-reminders.md`, sections 2 and 3.

## Outcome

**Provider order.** Email goes through **Resend** first: `POST https://api.resend.com/emails` with an `Idempotency-Key`, so a retried send is never delivered twice within Resend's 24-hour window. If Resend is not configured or refuses, **Cloudflare Email Service** carries the message. Sending still stays off until `EMAIL_SENDING_ENABLED` is `"true"`. With no provider configured, the refusal code is `email_provider_missing`.

**Reminder cadence.** In **Email choices**, once reminders are on, the person picks **Every week** (preselected), **Every two weeks** or **Once a month**.
- **When it sends:** the daily pass sends when the person is due under their own cadence. That is no reminder, and no finished memory, within the last 6.5 days (weekly), 13.5 days (every two weeks) or 28 days (monthly, never twice in a calendar month).
- **The wording:** the email says how often it comes and that the frequency can be changed in Email choices.

**Direct links.** A reminder's link is `/?start=camera`. It opens straight into starting a new memory, as tapping the first button would. Family updates already link directly to the family view. Email bodies still carry no memory content.

## Change

- `worker/providers/email-provider.ts`: Resend adapter and Cloudflare fallback. Logs carry the provider and a status code only.
- `worker/notifications.ts`: idempotency keys per invitation, per person-day notice and per person-day reminder; cadence-aware reminder selection and wording; the direct start link.
- `worker/email-preferences.ts` and `migrations/0039_reminder_cadence.sql`: the stored cadence (allocated by the coordinator, recorded in the handoff table).
- `app/features/notifications/EmailPreferencesPanel.tsx`: the **How often** choice, with Spanish copy.
- `app/routes.tsx`: `?start=camera` or `?start=import` begins a draft on arrival.
- `docs/SECURITY/SECRETS_AND_CONFIGURATION.md` and the L8 provisioning list: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `PUBLIC_APP_ORIGIN`.

## Evidence

| Check | Result |
| --- | --- |
| Unit `email-provider.test.ts` | Resend first, with authorization, idempotency key, sender and recipient; falls back to Cloudflare on refusal with no address logged; Resend alone refusing returns a stable code |
| Integration `owner-reminders.test.ts` | Monthly as before; weekly sends again after a week, not after four days or twice a day; every two weeks waits fourteen days; the email states its cadence and links to `/?start=camera` |
| Integration `email-preferences.test.ts` | Cadence defaults to weekly; only the three choices are accepted |
| Browser `email-preferences.spec.ts` (EN, ES) | Weekly preselected; changing it is saved |
| Browser `reminder-link.spec.ts` | `/?start=camera` and `/?start=import` open capture; anything else leaves the start screen alone |
| `npm run verify:core` | Pass — 332 tests in 78 files; schema 139 objects |
| Full phone-viewport suite locally | 81 pass; 9 not run (sandbox-only) |

**Reversible:** yes. **Migration:** 0039. **Production deployed:** no.
