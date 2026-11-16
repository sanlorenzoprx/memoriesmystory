# Threat model — Memories: My Story V1

**Status:** Prepared 2026-11-16 (lane L7). Review again before launch and after any new external surface.
**Scope:** The Cloudflare Worker, D1, R2, Queue, Durable Object, scheduled jobs, the React app, email, and third-party providers (Clerk, ElevenLabs, Workers AI, Google Gemini directly or through Cloudflare AI Gateway, RealtimeKit, Resend, Cloudflare Email).

## What we protect

1. **Original photographs and voices.** They are immutable, and their loss or silent change is the worst outcome.
2. **Private testimony and context:** transcripts, Muse conversations, relatives' recollections, people and relationship notes.
3. **Who belongs to a family archive, and what each invited person may see.**
4. **Accounts and sessions.**
5. **Truthful state.** "Saved" must mean durably stored; human and generated words must stay distinct.

## Actors

| Actor | Can | Must not |
| --- | --- | --- |
| Owner | Everything in their own archive | Reach another owner's data |
| Invited relative | What their accepted grant scopes allow; contribute if a contributor; organize albums if permitted | See beyond scope, or keep access after revocation |
| Holder of a share link | The bounded share artifact only | Reach the archive, other memories, or anything after revocation |
| Unauthenticated visitor | The landing page, share pages they hold, unsubscribe links | Anything private |
| Automated abuser | Send traffic | Run up model, call or email cost; enumerate tokens |
| Provider or insider with storage access | Read stored bytes | Change originals without detection |

## Threats and controls

| # | Threat | Controls in place | Evidence | Residual risk and next step |
| --- | --- | --- | --- | --- |
| T1 | Cross-account read or write | Every route re-checks the session owner; family routes re-check the grant inside the same D1 batch | Integration suites per route (family access, search, timeline, contributions, export) | Low. Keep the "re-check inside the batch" pattern for new routes |
| T2 | Share-link guessing or leakage | High-entropy tokens stored only as peppered hashes; `noindex`, `no-referrer`; revocation closes page and media; referral ids are one-way and never contain the token | `living-memory-sharing.test.ts`, `growth-events.test.ts` | Links are bearer secrets by design. People agree once that whoever receives a link can open it (decision 2026-11-16) |
| T3 | Invitation forwarded to the wrong person | Acceptance requires the intended verified email; invitation emails say forwarding grants nothing | `family-access.test.ts`, `invitation-email.test.ts` | Depends on Clerk email verification; confirm on staging (O3) |
| T4 | Original silently altered or lost | Immutable-identity triggers; client and server SHA-256 with read-back; daily append-only integrity pass; export checking on the device | `fixity.test.ts`, `original-source-storage.test.ts`, `archive-export-verify.test.ts` | R2 itself is not versioned; a weekly off-account D1 export is an operations task |
| T5 | Cost abuse (model, speech, calls, email) | Per-address rate limits; per-account daily ceilings; remote-recording daily limit; email opt-in, once-a-day and cadence limits | `rate-limit.test.ts`, `daily-ceilings.test.ts`, `owner-reminders.test.ts` | Thresholds need staging evidence. Turnstile is not added because there is no public form yet |
| T6 | Cross-site request forgery on writes | `X-Memories-Request` header on every state-changing route; `SameSite` session cookie | Route tests refuse a missing header | Low |
| T7 | Script injection | React escaping; server pages escape every value; report-only CSP; share pages with a strict CSP | `security-headers.test.ts`, page tests | Enforce the CSP after a week of staging reports |
| T8 | Private data in logs or email | Logs carry ids, codes and counts only; emails carry links and instructions, never content; the delivery record stores no address or body | Tests assert no address in logs and no title or name in email bodies | Review every new log line in code review |
| T9 | Unsubscribe link forged for someone else | HMAC per person and kind; GET changes nothing; constant-time comparison | `email-preferences.test.ts` | Rotating `SESSION_SECRET` invalidates old links; document this before rotating |
| T10 | Over-claiming durability or Muse authorship | "Saved" only after server acknowledgement and re-read; human and generated sources labelled separately; Muse never writes testimony | Browser recovery journeys; `muse-storyteller-sovereignty.test.ts` | Low |
| T11 | Deleted family data lingering | Deletion removes media, rows, integrity rows, and records a minimal receipt and ledger entry | `memory-deletion.test.ts` | Backups and Time Travel keep data for up to 30 days; no "deleted everywhere" claim (D10) |
| T12 | Vulnerable dependency | CI fails on high or critical production advisories | `.github/workflows/ci.yml`; `DEPENDENCY_ADVISORIES.md` | One moderate RealtimeKit `uuid` advisory is accepted with its reason |
| T13 | Unexpected Worker error leaking internals | Top-level fallback returns a stable `503` with no message or stack | `security-headers.test.ts` | Low |
| T16 | A lonely person drawn into dependence on Muse, or harmed in a crisis | One-time adult and AI confirmation; Muse says it is an AI at the start and every three hours; danger answered first with real people; a single family suggestion after a long talk; no streaks, rewards or nudges; one question at a time | `muse-talk.test.ts`, `muse-safety.test.ts`; decision 2026-11-16 | The danger check is a keyword floor; a model-based second check and human review of wording per country are open |
| T15 | A family's words or photographs kept or reused by a model provider | Gemini direct only with a billing-enabled (paid-tier) key, whose prompts and responses Google does not use to improve its products; through AI Gateway, only models listed as zero data retention; the text-only Workers AI fallback never receives a photograph; one photo note per memory, with no names, dates or places | `muse-provider.test.ts`, `muse-photo.test.ts`; decision 2026-11-16 Talk with Muse | The paid tier cannot be checked in code: the owner confirms billing on the key's project. Google may still keep data briefly for abuse monitoring under its terms; legal review (D2) |
| T14 | Provider compromise or misuse of family data | Only approved providers; relatives' voices are not sent to transcription under the current agreement (D5); secrets are only in Worker secrets | Code review; `SECRETS_AND_CONFIGURATION.md` | A new provider needs an owner decision and an updated agreement |

## Open items before launch

1. Enforce the Content-Security-Policy after staging reports (T7).
2. Confirm rate-limit and ceiling thresholds with staging traffic (T5).
3. Rehearse backup restore and Worker rollback on staging (T4, T11).
4. Add Turnstile with the first public form, if one is ever added (T5).
5. Re-run this review with every new external surface, such as Stripe checkout (L5.3).
