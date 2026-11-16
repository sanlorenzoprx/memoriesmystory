# Email adapter and invitations by email (A3, L2.1–L2.2)

**Result:** PARTIAL — implemented and locally proven with sending switched off; a real send needs owner input O2 (sending domain and sender address).
**Base:** `main` `0db4d3a` (PR #63).
**Authority:** owner decision 2026-11-15 (Cloudflare Email; messages to owner and invited family), V1 launch handoff lane L2 items 1–2.

## Outcome

When creating a family invitation, the owner can tick **Also email the invitation link to this address**. If email is available, the existing private link goes to the invited address in English and Spanish. The message says the link works only for that address and that forwarding it grants nothing. The result is stated plainly:
- "We emailed this invitation to them.";
- "This invitation is no longer active, so it was not emailed."; or
- "Email is not available yet, so nothing was emailed. Send the link below yourself."

The copyable link stays available whatever the result.

Ticking the box after an invitation was made, and submitting again, replays the same invitation rather than creating a second one, and emails it once.

## Promises protected

- **Privacy:**
  - The email carries only a link and instructions: never a memory title, album name, words, photograph, or anyone's name. A test checks the message against those values.
  - The delivery record stores no address, subject or body.
  - Logs carry an error type only; a test asserts no address reaches the log.
- **Creator control:** nothing is emailed unless the owner asks for it on that invitation.
- **Least privilege unchanged:** accepting still requires the intended verified account. A revoked, accepted or expired invitation sends nothing.
- **Truthfulness:** "emailed" is shown only when the provider accepted the message. A retry never emails twice: at most one `sent` record per invitation, enforced by a unique index.
- **No reward for sharing:** nothing is counted or credited.

## Change

- `worker/providers/email-provider.ts`: the Cloudflare Email Service adapter (`env.EMAIL.send`). It fails closed with a stable code: `email_sending_off`, `email_sender_unconfigured`, `email_binding_missing`, `email_recipient_invalid` or `email_provider_failed`.
- `worker/notifications.ts`: `invitationEmail` and `sendInvitationEmail`, which re-reads the invitation, sends at most once and records the outcome.
- `worker/family-access-routes.ts`: an optional `emailInvitation` on invitation create or replay. It is not part of the idempotency hash, so asking later replays the same invitation.
- `migrations/0022_email_deliveries.sql`: the append-only delivery record.
- `wrangler.jsonc`: `EMAIL_SENDING_ENABLED` is `"false"`. No `send_email` binding is declared yet; it is added with the sending domain (L8 provisioning list).
- Client: a checkbox and the result line in `FamilyInvitationsPanel`, with Spanish copy in `catalog/messaging.ts`.

## Evidence

| Check | Result |
| --- | --- |
| Unit `tests/unit/email-provider.test.ts` | 2 pass: every refusal code; bilingual message; link escaped |
| Integration `tests/integration/invitation-email.test.ts` | 5 pass: off sends nothing and says so; sends only when asked, once, to the lower-cased invited address, with no memory, album or account content; a later request replays and emails once; revoked sends nothing; provider failure recorded with no address logged |
| Browser `family-access.spec.ts` (EN, ES), extended | Ticking the box afterwards reuses the same request key and shows the honest "not available" line |
| `npm run verify:core` | Pass — 312 tests in 73 files; schema 125 objects |
| Full phone-viewport suite locally | 75 pass; 9 not run (sandbox-only) |
| Real send to a real inbox | NOT_RUN — needs O2; no real person may be emailed from an unapproved sender |

## Not done here

- L2.3: preferences and a signed one-step unsubscribe. This is required before any notification or reminder; an invitation is a one-off, owner-requested message.
- L2.4: "something new is waiting" notices to invited family.
- L2.5: opt-in owner reminders, which wait on D6 cadence and wording.

**Reversible:** yes. **Migration:** 0022. **Production deployed:** no.
