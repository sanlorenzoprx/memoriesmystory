# Repository Operating Guide

This is the root instruction router for every human or AI-assisted task in `memoriesmystory`.

The mission is to preserve the human meaning behind family photographs through **Living Memories**: authentic source media, real voice, story, context, relationships, family contributions, and durable provenance. Implementation speed never outranks that mission.

## Before any action

Read these files in order:

1. `AGENTS.md` — choose the correct task route below.
2. `README.md` — confirm repository identity and current state.
3. `docs/00_START_HERE.md` — understand document authority.
4. The task-specific sources in the table below.
5. The nearest nested `AGENTS.md` in the folder being changed.

Inspect the current implementation and tests before making a change. Documents guide implementation; the application does not read Markdown files at runtime.

## Task router

| If the task is about | Read before acting | Work primarily in |
| --- | --- | --- |
| First screen, landing, onboarding, copy, accessibility, or the first five minutes | `docs/FOUNDATION/03_USER_EXPERIENCE.md`, `docs/FOUNDATION/05_PRODUCT_LANGUAGE.md`, `docs/PRODUCT/LIVING_MEMORY_DEFINITION.md`, `docs/DECISIONS/2026-07-15-first-five-minute-experience.md`, `app/AGENTS.md` | `app/routes/`, `app/features/`, `app/styles/`, route tests |
| Photograph capture, voice recording, drafts, recovery, or durable completion | `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `docs/PRODUCT/LIVING_MEMORY_DEFINITION.md`, `docs/FOUNDATION/04_TECHNICAL_PRINCIPLES.md` | `app/features/`, `app/domain/`, `app/services/`, `migrations/`, tests |
| Muse, transcription, generated descriptions, retrieval, or truth state | `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `docs/FOUNDATION/06_AI_BEHAVIOR_GUIDE.md`, `docs/PRODUCT/LIVING_MEMORY_DEFINITION.md` | `app/features/`, `app/domain/`, `app/services/`, tests |
| Sharing, Facebook/WhatsApp handoff, or growth instrumentation | `docs/PRODUCT/LIVING_MEMORY_SHARE_POLICY_V2.md`, `docs/PRODUCT/LIVING_MEMORY_ANTI_DRIFT_CHECKLIST.md`, `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `config/phase-1.ts` | `app/features/`, `app/domain/`, `config/`, tests |
| Refactoring, code cleanup, compatibility removal, bundle size, or performance boundaries | `docs/ENGINEERING/VALUE_BEARING_CODE_STANDARD.md`, `docs/PRODUCT/LIVING_MEMORY_ANTI_DRIFT_CHECKLIST.md` | the smallest affected runtime/style/test files |
| Cloudflare Worker, D1, R2, Queue, AI bindings, security, or deployment | `docs/FOUNDATION/04_TECHNICAL_PRINCIPLES.md`, `docs/ARCHITECTURE/FOUNDATION_STACK.md`, `docs/ARCHITECTURE/APP_IDENTITY.md`, `worker/AGENTS.md` | `worker/`, `workers/`, `migrations/`, `wrangler.jsonc`, integration tests |
| Product or Foundation document changes | `docs/AGENTS.md`, `docs/00_START_HERE.md`, `docs/LEARNING/README.md`, `docs/PRODUCT/OPEN_DECISIONS.md` | `docs/` |
| Tests, acceptance evidence, or packet completion | `tests/AGENTS.md`, `docs/PRODUCT/FOUNDATION_TRACEABILITY.md`, `docs/PRODUCT/LIVING_MEMORY_ANTI_DRIFT_CHECKLIST.md` | `tests/`, `docs/IMPLEMENTATION/` |
| Production readiness, secrets, CI, or handoff | `docs/EXECUTION/README.md`, `docs/EXECUTION/DEFINITION_OF_DONE_V1.md`, `docs/SECURITY/SECRETS_AND_CONFIGURATION.md`, `docs/OPERATIONS/ENVIRONMENTS_AND_HANDOFF.md` | `.github/`, `config/`, `docs/EXECUTION/`, `docs/SECURITY/`, `docs/OPERATIONS/`, tests |
| Application or resource naming | `docs/ARCHITECTURE/APP_IDENTITY.md`, `config/app-identity.ts` | the smallest affected configuration and code files |

If a task crosses rows, read every applicable source. If sources conflict, apply the priority order in `docs/00_START_HERE.md`; do not silently choose the easier interpretation.

## Required work loop

1. **Route:** identify the governing documents.
2. **Inspect:** read live code, configuration, tests, and latest receipt.
3. **Trace:** state which Living Memory promise or Product Invariant the change protects.
4. **Value test:** for cleanup/refactor work, state what customer outcome would break if each retained compatibility layer or module were deleted.
5. **Anti-drift:** complete `docs/PRODUCT/LIVING_MEMORY_ANTI_DRIFT_CHECKLIST.md` for material changes.
6. **Change:** make the smallest complete vertical change; preserve validated infrastructure.
7. **Verify:** run proportionate type, lint, unit, integration, build, accessibility, and phone-viewport checks.
8. **Receipt:** record material packet evidence under `docs/IMPLEMENTATION/`.
9. **Learn:** add durable evidence or a proposed rule change through `docs/LEARNING/README.md`.

## Non-negotiable boundaries

- The only canonical repository is `https://github.com/sanlorenzoprx/memoriesmystory`.
- Every technical application identifier is `memoriesmystory`; the customer-facing brand is **Memories: My Story**.
- No code, architecture, or product rule is inherited from another repository.
- Living Memory is the canonical product object; `MemoryStory` is a compatibility implementation name where still present.
- Original photograph and voice assets are immutable.
- “Saved” is shown only after durable confirmation.
- Human testimony and Muse-generated material remain visibly distinct.
- Muse listens first and never manufactures testimony.
- New Living Memories begin private by default.
- Sharing is creator-controlled and never rewarded with another free Living Memory.
- Value-bearing behavior is preserved through refactors; non-value-bearing history, duplicate UI generations, and expired compatibility layers are removed rather than carried indefinitely.
- Locked Foundation documents are never silently rewritten; behavior changes require an approved decision record and coordinated downstream updates.

## Completion

A task is complete only when the intended user outcome, authenticity, privacy, recovery, verification evidence, and documentation impact are accounted for. Passing code checks alone is not completion.
