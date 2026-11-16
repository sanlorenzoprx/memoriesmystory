# One-time sharing agreement (owner decision 2026-11-16)

**Result:** PARTIAL — implemented and locally proven; real-device acceptance pending.
**Base:** `main` `920727e` (PR #68).
**Authority:** `docs/DECISIONS/2026-11-16-sharing-agreement-email-provider-reminders.md`, section 1.

## Outcome

The first time a person shares, the share screen asks once how they want to share:
- **Friends and family** (required to share);
- **Public** (optional).

They tap **I agree**, the choice is saved, and it is not asked again. The per-share boundary paragraph is gone.

After agreeing, a ready link offers the device share sheet, copy and WhatsApp. Facebook appears only once Public is chosen; a small **Also allow public sharing** button adds it at any time. Every share still shows its preview, and links remain revocable.

## Change

- `migrations/0028_share_agreements.sql`: append-only and versioned.
- `worker/share-agreement.ts`: `GET` and `POST /resources/share-agreement`. Public builds on friends and family; only the current wording version is accepted.
- `worker/sharing.ts`: share creation returns `409 share_agreement_required` until the friends-and-family choice is made.
- `app/features/living-memory/ShareAgreementCard.tsx` and the share flow wiring in `LivingMemoryExperience.tsx`. Spanish copy and error wording are in `catalog/growth.ts`.
- `docs/PRODUCT/LIVING_MEMORY_SHARE_POLICY_V2.md`: amendment note.

## Evidence

| Check | Result |
| --- | --- |
| Integration `living-memory-sharing.test.ts` (new case) | No link before the agreement; header, friends-and-family requirement and wording version checked; public added later keeps the first row; append-only; link created after agreeing |
| Existing sharing and completion suites | Updated to record the agreement in their fixtures; all pass |
| Browser `family-links.spec.ts` (EN, ES) | Asked once; preview disabled until agreed; WhatsApp after agreeing; Facebook only after the public choice |
| `npm run verify:core` | Pass — 330 tests in 78 files; schema 139 objects |
| Full phone-viewport suite locally | 80 pass; 9 not run (sandbox-only) |

**Reversible:** yes. **Migration:** 0028. **Production deployed:** no.
