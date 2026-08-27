# Repository Operating Guide

This is the root instruction router for every human or AI-assisted task in `memoriesmystory`.

The mission is to preserve a person through the memories they tell, the photographs that awaken those memories, and the sound of their real voice. Implementation speed never outranks that mission.

## Before any action

Read these files in order:

1. `AGENTS.md` — choose the correct task route below.
2. `README.md` — confirm repository identity and current state.
3. `docs/00_START_HERE.md` — understand document authority.
4. The task-specific sources in the table below.
5. The nearest nested `AGENTS.md` in the folder being changed.

Inspect the current implementation and tests before proposing or making a change. Documents guide the implementation; the application does not read Markdown files at runtime.

## Task router

| If the task is about | Read before acting | Work primarily in |
| --- | --- | --- |
| First screen, onboarding, copy, accessibility, or the first five minutes | `docs/FOUNDATION/03_USER_EXPERIENCE.md`, `docs/FOUNDATION/05_PRODUCT_LANGUAGE.md`, `docs/DECISIONS/2026-07-15-first-five-minute-experience.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`, `app/AGENTS.md` | `app/routes/`, `app/features/`, `app/styles/`, route tests |
| Photograph capture, voice recording, drafts, recovery, or durable completion | `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `docs/FOUNDATION/03_USER_EXPERIENCE.md`, `docs/FOUNDATION/04_TECHNICAL_PRINCIPLES.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md` | `app/features/`, `app/domain/`, `app/services/`, `migrations/`, tests |
| Muse, transcription, generated descriptions, or truth state | `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `docs/FOUNDATION/06_AI_BEHAVIOR_GUIDE.md`, `docs/FOUNDATION/03_USER_EXPERIENCE.md`, `docs/PRODUCT/CORE_EXPERIENCES.md` | `app/features/`, `app/domain/`, `app/services/`, tests |
| Sharing, free-story entitlement, or unlocking | `docs/PRODUCT/GOOD_KARMA_SHARE_POLICY_V1.md`, `docs/PRODUCT/CANONICAL_SCOPE.md`, `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `config/phase-1-limits.ts` | `app/features/`, `app/domain/`, `config/`, tests |
| Cloudflare Worker, D1, R2, Queue, AI bindings, security, or deployment | `docs/FOUNDATION/04_TECHNICAL_PRINCIPLES.md`, `docs/ARCHITECTURE/FOUNDATION_STACK.md`, `docs/ARCHITECTURE/APP_IDENTITY.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`, `worker/AGENTS.md` | `worker/`, `workers/`, `migrations/`, `wrangler.jsonc`, integration tests |
| Product or Foundation document changes | `docs/AGENTS.md`, `docs/00_START_HERE.md`, `docs/LEARNING/README.md`, `docs/PRODUCT/OPEN_DECISIONS.md` | `docs/` |
| Tests, acceptance evidence, or packet completion | `tests/AGENTS.md`, `docs/PRODUCT/FOUNDATION_TRACEABILITY.md`, `docs/IMPLEMENTATION/README.md` | `tests/`, `docs/IMPLEMENTATION/` |
| Production readiness, secrets, CI, or handoff | `docs/EXECUTION/README.md`, `docs/EXECUTION/DEFINITION_OF_DONE_V1.md`, `docs/SECURITY/SECRETS_AND_CONFIGURATION.md`, `docs/OPERATIONS/ENVIRONMENTS_AND_HANDOFF.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`, `tests/AGENTS.md` | `.github/`, `config/`, `docs/EXECUTION/`, `docs/SECURITY/`, `docs/OPERATIONS/`, tests |
| Application or resource naming | `docs/ARCHITECTURE/APP_IDENTITY.md`, `config/app-identity.ts` | the smallest affected configuration and code files |

If a task crosses rows, read every applicable source. If two sources conflict, stop and apply the priority order in `docs/00_START_HERE.md`; do not silently choose the easier interpretation.

## Required work loop

1. **Route:** identify the task row and governing documents.
2. **Inspect:** read the live code, configuration, tests, and latest implementation receipt.
3. **Trace:** state which experience promise or Product Invariant the change protects.
4. **Change:** make the smallest complete vertical change; do not add speculative layers.
5. **Verify:** run proportionate type, lint, unit, integration, build, accessibility, and phone-viewport checks.
6. **Receipt:** record material packet evidence under `docs/IMPLEMENTATION/`.
7. **Learn:** add durable evidence or a proposed rule change through `docs/LEARNING/README.md`.

## Non-negotiable boundaries

- The only canonical repository is `https://github.com/sanlorenzoprx/memoriesmystory`.
- Every technical application identifier is `memoriesmystory`; the customer-facing brand is **Memories: My Story**.
- No code, architecture, or product rule is inherited from another repository.
- Original photograph and voice assets are immutable.
- “Saved” is shown only after durable confirmation.
- Human testimony and Muse-generated material remain visibly distinct.
- Muse listens first and stays out of the way unless useful.
- Locked Foundation documents are never silently rewritten by an implementation or learning loop.

## Completion

A task is complete only when the intended user outcome, relevant recovery behavior, verification evidence, and documentation impact are accounted for. Passing code checks alone is not completion.
