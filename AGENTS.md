# Repository Operating Guide

This is the root instruction router for every human or AI-assisted task in `memoriesmystory`.

The mission is to preserve a person through the memories they tell, the photographs that awaken those memories, and the sound of their real voice. Implementation speed never outranks that mission.

## Before any action

Read these files in order:

1. `AGENTS.md` — choose the correct task route below.
2. `README.md` — confirm repository identity and current state.
3. `docs/00_START_HERE.md` — understand document authority.
4. `docs/ENGINEERING/KNOWN_OUTCOME_ENGINEERING_V1.md` — resolve work against verified building blocks before creating new architecture.
5. The task-specific sources in the table below.
6. The nearest nested `AGENTS.md` in the folder being changed.

Inspect the current implementation and tests before proposing or making a change. Documents guide the implementation; the application does not read Markdown files at runtime.

Known-Outcome Engineering governs **how** implementation is resolved and tested. It does not override Foundation, Product, privacy, preservation, or implementation sources, and it does not permit product behavior or architecture to be inherited from another repository.

## Task router

| If the task is about | Read before acting | Work primarily in |
| --- | --- | --- |
| First screen, onboarding, copy, accessibility, or the first five minutes | `docs/FOUNDATION/03_USER_EXPERIENCE.md`, `docs/FOUNDATION/05_PRODUCT_LANGUAGE.md`, `docs/DECISIONS/2026-07-15-first-five-minute-experience.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`, `app/AGENTS.md` | `app/routes/`, `app/features/`, `app/styles/`, route tests |
| Photograph capture, voice recording, drafts, recovery, or durable completion | `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `docs/FOUNDATION/03_USER_EXPERIENCE.md`, `docs/FOUNDATION/04_TECHNICAL_PRINCIPLES.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md` | `app/features/`, `app/domain/`, `app/services/`, `migrations/`, tests |
| Muse, transcription, generated descriptions, or truth state | `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `docs/FOUNDATION/06_AI_BEHAVIOR_GUIDE.md`, `docs/FOUNDATION/03_USER_EXPERIENCE.md`, `docs/PRODUCT/CORE_EXPERIENCES.md` | `app/features/`, `app/domain/`, `app/services/`, tests |
| Sharing, free-story entitlement, or unlocking | `docs/PRODUCT/GOOD_KARMA_SHARE_POLICY_V1.md`, `docs/PRODUCT/CANONICAL_SCOPE.md`, `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`, `config/phase-1-limits.ts` | `app/features/`, `app/domain/`, `config/`, tests |
| Cloudflare Worker, D1, R2, Queue, AI bindings, security, or deployment | `docs/FOUNDATION/04_TECHNICAL_PRINCIPLES.md`, `docs/ARCHITECTURE/FOUNDATION_STACK.md`, `docs/ARCHITECTURE/APP_IDENTITY.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`, `docs/ENGINEERING/KNOWN_OUTCOME_ENGINEERING_V1.md`, `worker/AGENTS.md` | `worker/`, `workers/`, `migrations/`, `wrangler.jsonc`, integration tests |
| Product or Foundation document changes | `docs/AGENTS.md`, `docs/00_START_HERE.md`, `docs/LEARNING/README.md`, `docs/PRODUCT/OPEN_DECISIONS.md` | `docs/` |
| Tests, acceptance evidence, packet completion, or test-runtime changes | `tests/AGENTS.md`, `docs/PRODUCT/FOUNDATION_TRACEABILITY.md`, `docs/IMPLEMENTATION/README.md`, `docs/ENGINEERING/KNOWN_OUTCOME_ENGINEERING_V1.md`, `config/known-outcome-engineering.v1.json` | `tests/`, `docs/IMPLEMENTATION/`, `scripts/`, test configuration |
| Production readiness, secrets, CI, or handoff | `docs/EXECUTION/README.md`, `docs/EXECUTION/DEFINITION_OF_DONE_V1.md`, `docs/SECURITY/SECRETS_AND_CONFIGURATION.md`, `docs/OPERATIONS/ENVIRONMENTS_AND_HANDOFF.md`, `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`, `tests/AGENTS.md` | `.github/`, `config/`, `docs/EXECUTION/`, `docs/SECURITY/`, `docs/OPERATIONS/`, tests |
| Application or resource naming | `docs/ARCHITECTURE/APP_IDENTITY.md`, `config/app-identity.ts` | the smallest affected configuration and code files |

If a task crosses rows, read every applicable source. If two sources conflict, stop and apply the priority order in `docs/00_START_HERE.md`; do not silently choose the easier interpretation.

## Required work loop

1. **Route:** identify the task row and governing documents.
2. **Inspect:** read the live code, configuration, tests, latest implementation receipt, and existing capabilities that may already solve the outcome.
3. **Trace:** state which experience promise or Product Invariant the change protects.
4. **Resolve:** apply the Known-Outcome Resolution Ladder; classify the work as `REUSE`, `ADAPT`, `COMPOSE`, `ADAPTER`, `NOVEL`, `WORKAROUND`, or `TEST_FAULT`; declare the smallest unresolved surface.
5. **Change:** make the smallest complete vertical change; do not add speculative layers.
6. **Verify:** use the lowest real behavior-owning test layer; prefer platform-native/runtime behavior over handwritten platform emulation; run proportionate type, lint, unit, integration, build, accessibility, recovery, and phone-viewport checks.
7. **Receipt:** record material packet evidence under `docs/IMPLEMENTATION/`, including scenario identity, novelty classification, tests, recovery evidence, and stop reason.
8. **Learn:** add durable evidence or a proposed rule change through `docs/LEARNING/README.md`.
9. **Stop:** once the intended preservation/user outcome is trustworthy, return to real-user experience and evidence rather than expanding architecture for its own sake.

## Non-negotiable boundaries

- The only canonical repository is `https://github.com/sanlorenzoprx/memoriesmystory`.
- Every technical application identifier is `memoriesmystory`; the customer-facing brand is **Memories: My Story**.
- No code, architecture, or product rule is inherited from another repository.
- Original photograph and voice assets are immutable.
- “Saved” is shown only after durable confirmation.
- Human testimony and Muse-generated material remain visibly distinct.
- Muse listens first and stays out of the way unless useful.
- Locked Foundation documents are never silently rewritten by an implementation or learning loop.
- `NOVEL`, `WORKAROUND`, and `TEST_FAULT` require evidence that known internal/platform/official mechanisms were checked first.
- Live external mutations require explicit authorization; passing local tests does not silently authorize staging/production actions.

## Completion

A task is complete only when the intended user outcome, relevant recovery behavior, verification evidence, documentation impact, Known-Outcome resolution, and stop condition are accounted for. Passing code checks alone is not completion.
