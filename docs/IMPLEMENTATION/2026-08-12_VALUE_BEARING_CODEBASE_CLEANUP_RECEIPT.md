# Value-Bearing Codebase Cleanup Receipt

Date: 2026-08-12
Repository: `sanlorenzoprx/memoriesmystory`
Branch: `agent/value-bearing-cleanup`
Base: `agent/living-memory-landing-visual`
Draft PR: #7
Production deploy: **No**
Stripe integration: **No**

## Purpose

Apply the active engineering rule:

> **What customer outcome or Product Invariant would break if this were deleted?**

Retain code that protects a material customer outcome. Remove code that only carries history, duplicate presentation, expired compatibility, or unnecessary startup cost.

This cleanup treats customer-journey congruency as functional product behavior, not visual decoration.

## Value-bearing behavior preserved

The following behavior was intentionally retained and revalidated:

- recoverable local Living Memory drafts;
- camera and photo import;
- contextual camera permission with denial fallback;
- original human voice capture;
- contextual microphone permission;
- original photograph and original voice preservation;
- offline continuation from photograph to voice;
- background durability synchronization;
- reload recovery;
- account binding;
- Family Archive retrieval;
- cross-device durability contracts;
- keyboard-accessible phone flow.

These capabilities directly protect trust, source authenticity, ownership, continuity, and the Living Memory Magic Moment.

## Non-value-bearing code removed

Deleted rather than hidden:

- `app/styles/global.css` — superseded UI generation containing old homepage/header/hero rules mixed with runtime presentation;
- `app/styles/legacy-brand-overrides.css` — temporary bridge that existed only to override the older visual generation;
- `app/features/first-experience/content.ts` — obsolete pre-Living-Memory landing copy module;
- `tests/unit/first-experience.test.ts` — copy-only test that froze the obsolete module rather than a current customer outcome.

The duplicate capture-route brand header/logo was also removed because the shared BrandShell now owns customer navigation and identity.

## Current presentation boundaries

Added:

- `app/styles/base.css` — small universal browser/accessibility foundation;
- `app/styles/brand-experience.css` — current public and journey brand system;
- `app/styles/living-memory-runtime.css` — capture/archive presentation loaded only with the runtime that uses it.

The customer no longer moves through competing generations of visual logic.

## Runtime loading cleanup

Before this slice, `app/routes.tsx` statically imported creation, capture, identity, commerce, thank-you, and archive. `app/main.tsx` also mounted Clerk for the whole application when configured.

After this slice:

- Landing and BrandShell remain eager.
- `/create` loads creation on demand.
- `/capture/:draftId` loads capture/audio/offline runtime on demand.
- `/auth/protect` loads identity + Clerk on demand.
- checkout and thank-you load commerce on demand.
- archive loads archive + Clerk on demand.
- `app/main.tsx` no longer imports Clerk.

The customer does not pay the startup cost of a capability before reaching the step that needs it.

## Bundle evidence

### Before cleanup

Validated PR #6 build:

- main CSS: **45.73 KB raw / 10.53 KB gzip**
- main JS: **459.41 KB raw / 135.62 KB gzip**

### After cleanup

CI run `31581963879`:

- initial/current-brand CSS: **25.33 KB raw / 6.21 KB gzip**
- initial JS: **322.42 KB raw / 99.83 KB gzip**
- Living Memory runtime CSS: **9.59 KB raw / 2.67 KB gzip**, lazy
- Living Memory start chunk: **2.94 KB / 1.07 KB gzip**
- Archive chunk: **3.45 KB / 1.26 KB gzip**
- Commerce chunk: **3.74 KB / 1.31 KB gzip**
- Identity chunk: **5.13 KB / 1.96 KB gzip**
- Capture chunk: **28.04 KB / 8.07 KB gzip**

Main bundle change:

- JS raw: approximately **29.8% smaller**
- JS gzip: approximately **26.4% smaller**
- initial CSS raw: approximately **44.6% smaller**
- initial CSS gzip: approximately **41.0% smaller**

The goal is not byte reduction for its own sake. The bundle structure now matches the customer journey and capability boundaries.

## Guardrail added

`tests/unit/value-bearing-codebase.test.ts` verifies that:

- retired UI generations remain deleted;
- public startup does not import Clerk or Living Memory runtime CSS;
- capture, identity, archive, and commerce remain route-loaded.

The durable engineering standard is documented in:

`docs/ENGINEERING/VALUE_BEARING_CODE_STANDARD.md`

and routed from root `AGENTS.md`.

## Verification

CI run `31581963879` on the cleanup code passed:

- typecheck — PASS
- lint — PASS
- unit/integration — **55/55 PASS**
- production build — PASS
- Cloudflare deployment dry-run — PASS
- phone-first Playwright — **11/11 PASS**

A later documentation head also passed CI run `31582212958` before this receipt was added.

A final current-head CI run is required after this receipt commit and is the acceptance source for PR #7.

## Known retained compatibility

Internal `MemoryStory` persistence terminology is not deleted merely for naming purity. It remains where removing it would cause unnecessary storage/schema churn without creating customer value.

Some older internal/customer strings may still exist inside the proven originals runtime. They should be migrated when touched or in a focused vocabulary cleanup, but only without weakening the tested capture/durability path.

## Known security debt

`npm ci` continues to report:

- 1 moderate vulnerability
- 7 high vulnerabilities

No blind `npm audit fix` was run. Dependency remediation should be a separate controlled change with compatibility verification.

## Acceptance

This slice is accepted only when the final PR head passes the complete CI pipeline. It remains a draft and must not be deployed to production as part of this cleanup.
