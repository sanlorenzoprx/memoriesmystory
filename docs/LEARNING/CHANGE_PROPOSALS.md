# Learning Change Proposals

Proposals turn recorded evidence into reviewable change candidates. Follow `README.md` in this folder before promoting a proposal.

### P-2026-07-15-001 — Docs-grounded Packet 0.1 first screen

- **Status:** implemented
- **Triggering observations:** L-2026-07-15-001.
- **Proposed change:** Replace the generic Packet 0 placeholder with a full-screen, mobile-first opening experience using Apple Photos warmth, Airbnb trust, Calm pacing, and Pinterest photo-first discovery as directional references. Lead with “Old photographs fade. The voices behind them should not.” Support it with “Capture a photo. Tell its story. Preserve your voice for the people you love.” Use **Capture Your Memories** as the primary action, **Import a photo** as the secondary action, and show `Photo → Voice → Preserved → Shared` quietly. Keep Muse absent until help is useful and remove internal save, entitlement, and packet language from the first screen.
- **Governing documents:** `../FOUNDATION/03_USER_EXPERIENCE.md`, `../FOUNDATION/05_PRODUCT_LANGUAGE.md`, `../DECISIONS/2026-07-15-first-five-minute-experience.md`.
- **Affected code and tests:** `../../app/routes.tsx`, `../../app/styles/global.css`, route/accessibility checks, and a Packet 0.1 implementation receipt.
- **Product Invariants protected or at risk:** Protects I-11 and I-14; must not weaken I-08 truthful durable-save language or I-12 Muse listens before asking.
- **Privacy, accessibility, and recovery impact:** First screen must remain keyboard accessible, readable with reduced motion and high zoom, mobile-first, private by default, and free of premature permission prompts.
- **Approval required:** Product-owner approval received in conversation on 2026-07-15. Implementation remains subject to visual review.
- **Success evidence:** On a representative phone viewport, a new user can state why the product matters and identify how to capture or import a photograph without reading technical or feature-tour language.
- **Decision or implementation receipt:** `../IMPLEMENTATION/PACKET_0_1_FIRST_SCREEN_RECEIPT.md`; product-owner visual acceptance remains pending on the running branch.

### P-2026-07-16-001 — Scalable Phase 1 production-ready campaign handoff

- **Status:** implemented
- **Triggering observations:** L-2026-07-16-001.
- **Proposed change:** Establish the campaign scope, scalable-architecture posture, phase gates, one-active-task queue, authority/stop rules, source exclusions, environment boundary, and master build prompt needed to implement Phase 1 continuously without opening production.
- **Governing documents:** `../FOUNDATION/04_TECHNICAL_PRINCIPLES.md`, `../FOUNDATION/08_BUILD_ORDER.md`, `../IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`, and `../EXECUTION/DEFINITION_OF_DONE_V1.md`.
- **Affected code and tests:** Execution, Security, Operations, decision and receipt documents; task-queue contract test.
- **Product Invariants protected or at risk:** Protects I-06, I-07, I-08, I-14, I-15, I-16, and I-24; risks unnecessary complexity if scale is confused with premature distribution.
- **Privacy, accessibility, and recovery impact:** Makes isolated environments, secret handling, multilingual/real-device acceptance, interruption recovery, and private staging evidence explicit gates.
- **Approval required:** Product-owner approval received in conversation on 2026-07-16.
- **Success evidence:** A new builder can identify one active packet, the exact authority and source, scalable boundaries, required gates, prohibited actions, and the production-closed completion contract without another repository.
- **Decision or implementation receipt:** `../DECISIONS/2026-07-16-production-ready-scalable-phase-1.md` and `../IMPLEMENTATION/PACKET_0_3_HANDOFF_RECEIPT.md`.
