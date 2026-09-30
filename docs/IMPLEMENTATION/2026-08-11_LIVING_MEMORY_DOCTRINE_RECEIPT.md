# Living Memory Doctrine + Domain Ratification Receipt

**Date:** 2026-08-11  
**Repository:** `sanlorenzoprx/memoriesmystory`  
**Base:** `packet-4/account-binding-recovery` at `2df806817142b57058dbe25cadb90dbfe1c0f915`  
**Branch:** `agent/living-memory-doctrine`  
**Draft PR:** #4 — `Ratify Living Memory doctrine and domain`  
**Validated code head:** `33ad7b70ae79408083c4303d5cd728d230c5f9dd`

## Human/product outcome

The repository now has one coherent governing mechanism:

**Idea:** A photograph can outlive the story that gives it meaning.  
**Mechanism:** Living Memory.  
**Product:** Memories: My Story, a private-first Living Memory Archive.

The change preserves validated Packet 1–4 implementation while replacing stale product semantics that would have forced future work back toward `Memory Story` + share-to-unlock.

## Ratified behavior

- Living Memory is the canonical customer/domain object.
- Existing `MemoryStory` persistence remains compatibility infrastructure beneath the aggregate.
- Privacy-first means private by default and creator-controlled, not private-only.
- External sharing uses a bounded Share Artifact.
- Sharing never unlocks another free Living Memory.
- Facebook is the first public social-sharing target; WhatsApp is the next family-to-family target.
- Muse helps people remember and may not manufacture testimony.
- Original photo/audio/human testimony outrank generated derivatives.
- The first-five-minute target is **Photo → Voice → Muse → Preserved → Playback → Invite/Share**.
- Canonical activation event: `first_living_memory_completed`.
- Long-term value ladder: **Moment → Chapter → Life → Family**.
- Material work must pass the Living Memory anti-drift checklist.

## Code added/changed

- Added `LivingMemoryId` compatibility alias.
- Added first-class `LivingMemory` aggregate with durable original-photo/audio and source-binding checks.
- Added canonical product/share/referral event vocabulary.
- Deprecated `grantShareUnlock`; compatibility calls fail closed and never grant a reward.
- Central Phase 1 config currently exposes one initial free Living Memory and disables share rewards.
- Added operation kinds for Living Memory activation and Share Artifact work while retaining the historical share-unlock kind as deprecated compatibility debt.
- Replaced the old linear packet handoff assumption with a forward-only dependency graph.

## Doctrine and execution documents changed

Foundation/product/execution authority was reconciled across:

- Founding Principles;
- Product Invariants;
- Twenty-Year Product Vision;
- User Experience;
- Product Language;
- Build Order;
- Canonical Scope;
- Core Experiences;
- Foundation Traceability;
- Voluntary Share Policy V2;
- Living Memory Definition;
- Anti-Drift Checklist;
- Definition of Done;
- Phase Gates;
- Master Build Prompt;
- Source Manifest;
- Task Queue;
- Implementation migration plan.

Good Karma Share Policy V1 is retained only as an explicitly superseded historical record.

## Landing-page boundary

The landing page was deliberately **not** redesigned in this slice. The existing product surface is not being treated as authoritative positioning. Its replacement is a dedicated follow-up slice after this doctrine/domain PR is accepted.

The future landing surface must be software-first with AI integration and center the transformation:

**Photo → Voice → Living Memory**

It must not restore mail-in digitization as the primary business/product mechanism.

## Validation evidence

GitHub Actions workflow: **CI run 31545554398** on validated head `33ad7b70ae79408083c4303d5cd728d230c5f9dd`.

Clean-install results:

- `npm ci` — completed.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm test` — PASS: **13 test files, 54 tests**.
- `npm run build` — PASS.
- `npm run deploy:dry-run` — PASS; Wrangler resolved `DB`, `MEDIA_BUCKET`, assets, `APP_NAME`, and `PUBLIC_BRAND_NAME`; no production deployment occurred.
- `npx playwright install --with-deps chromium` — PASS.
- `npm run test:e2e` — PASS: **8/8 phone-chromium tests**.

Existing capture/recovery evidence remained green, including:

- media durability integration;
- account binding/recovery integration;
- local capture/reload recovery;
- offline photo → voice continuation;
- original voice preservation/retrieval/recovery;
- phone viewport keyboard reachability;
- identity staging preflight contracts.

## Failures found and resolved during validation

### 1. Stale five-story assertion

The first PR CI run failed because `tests/unit/app-identity.test.ts` still asserted the former hard-coded free limit of five. The test was reconciled with centralized configuration and the current one-initial-free-memory/no-share-reward policy.

### 2. Obsolete eight-packet handoff contract

The next CI run exposed a handoff test that required exactly one active task and a hard-coded `packet-1` through `packet-8` linear sequence. The task queue now represents the actual Living Memory dependency graph. Packet 4 is paused honestly while doctrine ratification is active. The test now enforces one active task, unique task IDs, valid earlier dependencies, and no self-dependencies.

### 3. Test syntax error

The first version of the new dependency-graph assertion contained a parenthesis error. Typecheck caught it before lint/tests. The assertion was corrected and the complete CI pipeline then passed.

No test was weakened to hide a product conflict; stale tests were changed only where their asserted product contract had been explicitly superseded.

## Known limitations / debt

- `npm ci` reports **8 dependency audit findings: 1 moderate and 7 high**. This receipt does not claim they were introduced by this slice or that they are harmless. They require a separate dependency/security review rather than an unreviewed `npm audit fix` inside a doctrine migration.
- `MemoryStory` names remain in persistence, routes, migrations, and historical receipts by design.
- Deprecated `grantShareUnlock` / `grant_share_unlock` compatibility surfaces remain until runtime callers are proven migrated.
- Runtime emission of `first_living_memory_completed` is not yet wired to the durable completion boundary.
- The bounded Share Artifact runtime and Facebook/WhatsApp handoff are not yet implemented.
- Full Muse runtime, Family Archive, contributions, retrieval/timeline, Memory Circle, resurfacing, derivative storytelling, and legacy stewardship remain future slices.
- Packet 4 Facebook identity-provider acceptance remains deferred; Facebook **social sharing** is a separate requirement and does not require Facebook login.

## Production effects

None.

- No production deployment.
- No DNS changes.
- No destructive migrations.
- No production secrets changed.
- No landing-page replacement.

## Next dependency-safe work

After this PR is accepted, the next product-surface slice is the deliberate landing-positioning replacement. The next runtime slice is `first_living_memory_completed` at the durable completion/Magic Moment boundary; it remains dependent on the unfinished identity/ownership completion path where required.
