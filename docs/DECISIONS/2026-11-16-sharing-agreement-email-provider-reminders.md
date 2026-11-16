# Decision: one-time sharing agreement, email provider order, and reminder cadence

**Status:** Accepted (sections 1 and 2, owner decision 2026-11-16). Section 3 records the owner's direction and the adopted default, which the owner may change.
**Date:** 2026-11-16
**Amends:** `docs/PRODUCT/LIVING_MEMORY_SHARE_POLICY_V2.md` (how the external-platform boundary is communicated); `docs/EXECUTION/V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md` inputs O2 and D6.

## Context

The share flow repeated a boundary statement on every share. Email sending had no provider choice, and reminders defaulted to monthly at most. The owner answered on 2026-11-16. In summary:
- Sharing is always the user's choice, and users should easily be able to share what they want.
- The product does not set those boundaries. Codify it as one agreement, with "friends and family only" and "public" check marks.
- Save the agreement, and then it is done for as long as they use the app: these are adults, not children.
- Resend is the primary email provider. Cloudflare Email is used for verified users while its program matures.
- Email should integrate with the app through prefilled links.
- The owner asked whether once a month is enough, and how other services handle reminders.

## Decision

### 1. One-time sharing agreement

- **Asked once.** Before a person's first share link, they choose once:
  - **Friends and family:** they may send links to the people they choose, and anyone who receives a link can open it and keep a copy.
  - **Public (optional):** they may also post links where anyone may see them, for example on Facebook.
- **Kept, not repeated.** The agreement is stored with its wording version and time, append-only (migration 0028). It is not asked again while that wording stands. The per-share boundary statement is removed.
- **What each choice unlocks.** Friends and family enables links, the device share sheet, copy and WhatsApp. Public additionally enables Facebook. Public can be added at any time from the share screen.
- **Enforced by the server.** A share link cannot be created without at least the friends-and-family agreement.
- **Unchanged:**
  - every Living Memory still begins private;
  - every share is still a deliberate act with a preview of exactly what leaves the archive;
  - sharing never unlocks anything;
  - links can still be revoked.

### 2. Email provider order (O2)

- **Primary: Resend.** It sends from a verified sending domain, with the API key held as a Worker secret and never in the repository or chat.
- **Second: Cloudflare Email Service**, used when Resend is not configured or fails.
- **Why Cloudflare is second.** Its free sending reaches only addresses verified in the Cloudflare account; sending to any recipient needs the Workers Paid plan. Its role can grow as its program matures.
- **No change to the master switch.** Sending still stays off until `EMAIL_SENDING_ENABLED` is set.

### 3. Reminder cadence and app links (D6)

- **What comparable services do.** Storyworth emails a question weekly by default and lets people change the frequency. Remento sends a weekly prompt adjustable from daily to monthly, and the storyteller records by tapping a link in the message.
- **Adopted default.** The person chooses weekly, every two weeks, or monthly, with weekly selected when they turn reminders on. Reminders remain opt-in, with one-step unsubscribe.
- **Prefilled links.** Each email links directly into the app: a reminder opens straight into starting a new memory; a family update opens the family view. The email body still carries no memory content, because inboxes are shared and forwarded.

## Alternatives considered

- **Keep the per-share boundary statement.** Rejected by the owner: it sets boundaries for adults on every share.
- **Cloudflare Email as the only provider.** Rejected for now, because of the recipient restriction above.
- **Monthly-only reminders.** Replaced by a person-chosen cadence in line with comparable services.

## Affected Product Invariants

- **Private by default:** unchanged.
- **Sharing is creator-controlled and never rewarded:** strengthened. The creator's own recorded choice governs which channels appear.
- **Human testimony and generated material stay distinct:** unaffected.

## Evidence required

- Integration test: a link is refused before the agreement; the agreement is append-only and versioned; public builds on friends and family.
- Browser test: asked once; the WhatsApp link appears after agreeing; the Facebook link appears only after the public choice.
- Provider-order and cadence tests (later pull requests).

## Consequences and follow-up

- `LIVING_MEMORY_SHARE_POLICY_V2.md` gains an amendment note under "External-platform truth".
- A future change to the agreement wording needs a new version, and people agree to it once.
- O2 still needs the Resend sending domain verified and `RESEND_API_KEY` stored as a Worker secret by the owner.
