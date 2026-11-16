# Share handoff and referral events (G02, G03, L4.1–L4.2)

**Result:** PARTIAL — implemented and locally proven; real-device handoff and staging evidence pending.
**Base:** `main` `bd70a0f` (PR #66).
**Authority:** `docs/PRODUCT/LIVING_MEMORY_SHARE_POLICY_V2.md` (approved): preserve first, share by choice, no share-to-unlock, track the loop with product events. V1 launch handoff lane L4 items 1–2.

## Outcome

**Share handoff (G02).** When a private family link is ready, the creator can:
- use the device share sheet, as before;
- **Send on WhatsApp**, which opens `wa.me` with a short message and the link;
- **Share on Facebook**, which opens Facebook's sharer with the link.

Nothing is posted for them, and no publishing API is used. A plain statement says who can open the link: anyone who receives it, and on Facebook everyone who can see the post. It also says revoking stops future access, but saved copies cannot be recalled. The share preview and the share page still show the same allowlisted projection; existing tests are unchanged.

**Referral events (G03).** The policy's loop events are recorded content-free:
- **Share prompt viewed:** once per person per memory.
- **Share started:** with its channel (`native`, `whatsapp`, `facebook` or `copy`).
- **Share opened:** at most once per share per day. Opens are not counted per visitor.
- **Referred visitor:** once per browser session.
- **Referred first memory started and completed:** once per person, and only when it is truly their first draft or first finished memory.

The share page's "Create your own Living Memory" link appears only when the creator kept the brand attribution. It carries an opaque `ref_` id derived one-way from the share, never the link token.

## Promises protected

- **No reward for sharing:** recording any event grants nothing. A test checks entitlements are unchanged.
- **No fingerprinting or identifiers:** no IP address, user agent, email, testimony or token is recorded. The device keeps only the opaque referral id, for 30 days.
- **Creator control:** the discovery link follows the creator's attribution choice; handoffs are explicit taps.
- **Honest boundary:** the reach of a link, and that copies cannot be recalled, is stated without fear-based language.

## Change

- `app/features/living-memory/LivingMemoryExperience.tsx`: WhatsApp and Facebook links, the boundary statement and event calls. Spanish copy in `catalog/growth.ts`.
- `worker/referral.ts`: `referralIdForShare`, `recordShareOpened` and `POST /resources/growth/events`, which checks ownership, a real first memory and channel values, and collapses duplicates through idempotency keys.
- `worker/sharing.ts`: the discovery link on attributed share pages and the daily opened event, which never blocks the page.
- `app/services/growth-events.ts`, and `app/routes.tsx` (the landing screen remembers a referral).
- No migration: `product_events` already allows these names.

## Evidence

| Check | Result |
| --- | --- |
| Integration `growth-events.test.ts` | 3 pass: header, session, ownership and channel checks; prompt once per memory; visitor once per key without an account; referred first only when truly first, once; entitlements unchanged |
| Integration `living-memory-sharing.test.ts` (new case) | Discovery link only with attribution; one opened row per share per day; no visitor id or token in events |
| Browser `family-links.spec.ts` (EN, ES, new case) | WhatsApp and Facebook links carry exactly the bounded share URL, never the memory id; boundary statement shown |
| Browser `referral-visit.spec.ts` | Visit recorded once per session with only event, key and ref; malformed ref ignored |
| `npm run verify:core` | Pass — 327 tests in 77 files |
| Full phone-viewport suite locally | 80 pass; 9 not run (sandbox-only) |
| Real phone handoff to WhatsApp and Facebook | NOT_RUN |

## Not done here

- L4.3: a public landing page with synthetic demonstration media.
- Share page headers (`noindex`, `no-referrer`) were done in L7.1 (PR #57).

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
