# A04 — English/Spanish solo interface

**Date:** 2026-11-13  
**Base:** main `b55aaf957f6aa896c38331080c89e7e1222c084e`  
**Branch:** `feat/english-spanish-interface`  
**Status:** implementation branch; verification results below; no deployment or live acceptance claimed.

## Integrated prerequisites

PR #21 merged normally as `a63c6061426e7b7079fe056271be66452c3391ee`. PR #22 was retargeted to main, synchronized with merged main, reverified locally (97 unit/integration and 18 phone Chromium tests), and its GitHub CI passed before merge as `b55aaf957f6aa896c38331080c89e7e1222c084e`. No administrator bypass or live migration was used. The historical receipts remain evidence of their original branch state; this receipt supersedes their unmerged status.

## Delivered behavior

420 catalog messages cover the current home, reading controls, capture/import/quality, recording/recovery, account entry, archive, Muse/replies, transcript/context review and history, voluntary finish, share preview/handoff, link inventory/revocation, deletion confirmations, accessibility labels and safe system errors. English wording remains the default. An always-visible selector supports English, Spanish and Puerto Rico locale selection, with device persistence and browser-language fallback. Spanish selections currently share application copy and Clerk's official Latin American Spanish resource.

Language switches preserve component state, unsaved testimony and draft media. Original testimony is never translated by the interface; a browser regression deliberately uses an English catalog phrase as testimony to prove this boundary. Dates and document/source language attributes improve mixed-language presentation. Known API error codes select translated recovery messages; arbitrary diagnostics do not reach the interface. Newly requested Muse questions use the selected language; historical turns remain intact.

Public family views localize their interface and unavailable-link guidance, offer language selection and retain only creator-selected content. The language query carries presentation preference, never authorization. Original captions, frozen transcript revision and private-context exclusion remain intact.

## Verification

`npm run verify` passed on the final code: TypeScript (client and Worker), ESLint, 104 unit/integration tests across 27 files, D1 schema validation, production build, Worker deployment dry run, and all 23 phone Chromium journeys. The dry run performs no deployment. Local runtime was Node 24; CI uses Node 22.

Coverage includes catalog completeness/placeholder parity, UI/source locale boundaries, storage-unavailable behavior, safe code-based errors, Spanish public links and revoked-page recovery without rewriting shared testimony, and a Spanish Muse fallback with unchanged English source. Browser checks cover language persistence/reload, unchanged original-photo SHA-256, Spanish account entry/errors, in-progress edits and retry, Spanish source-confirmed completion, and English/Spanish link revocation and deletion confirmation. A Spanish Pixel 7 screenshot was visually inspected; layout and photograph prominence were retained.

An earlier run passed 104 unit/integration tests and 22/23 browser journeys but timed out at the existing five-second offline-backup assertion. The UI stayed in pending preservation, never falsely claimed success. The unchanged offline test then passed with a trace showing ordered photo → audio → receipt verification, and passed again in the final full 23/23 run. No timeout was raised, assertion removed or retry added to conceal this timing sensitivity. Keep it visible for CI/device follow-up.

Initial lint found an unnecessary escape in the new adversarial locale fixture; that was corrected. GitHub CI is separate from these local results and is reported on the PR.

## Anti-drift review

- Idea/mechanism/customer value: mixed-language families can preserve, review and deliberately share their own story with understandable controls.
- Source authenticity, privacy and ownership: YES. No media write, source replacement, automatic testimony translation, expanded share selection or entitlement change.
- Offline/recovery: YES. Locale can change without browser storage; draft recovery and unchanged original-photo hash are tested. Preference persistence is device-local.
- Cross-device continuity: existing account/source contracts retained; locale preference is not claimed to sync across accounts/devices. Live account acceptance remains pending.
- AI role: source-grounded elicitation, optional context, no rewriting or adjudication; new prompts follow selected UI language, past turns stay attributed.
- Trustworthiness/accessibility: meaningful language labels, document/source lang, translated notices, phone-width checks and preserved focus/unsaved edits. Automated checks do not establish full WCAG conformance.
- Growth: existing bounded, voluntary sharing and revocation; no reward for sharing.
- Architecture: one pure catalog/locale boundary usable by the Worker and client, React subscription for live controls, official pinned Clerk localization dependency; no schema/provider switch.

## Remaining evidence and rollback

Native Spanish/Puerto Rican copy review; real iPhone Safari and Android Chrome; real Clerk email/Google and second-device recovery; live Muse/transcription/TTS; three uncoached human sessions including Spanish/mixed language; broader accessibility/security/operations and expanded-release capabilities remain pending. No paid provider calls, production deployment, billing activation, migration or human acceptance was performed here.

The main JS artifact is 504.72 kB (148.88 kB gzip), slightly above the bundler warning threshold; Worker dry-run upload is 305.43 KiB (70.87 KiB gzip). Track route/vendor splitting before lower-powered-device acceptance; do not equate a successful build with device performance proof.

The locale change adds no database migration. For rollback, retain migration 0008 and the pinned-caption reader required by #22. If reverting localization, revert only this change atop merged main; do not revert to the pre-review sharing reader. Pausing review writes is governed by #22's receipt.
