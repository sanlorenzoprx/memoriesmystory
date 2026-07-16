# Learning Observations

Observations preserve evidence separately from proposed solutions. Follow `README.md` in this folder before adding or changing an entry.

### L-2026-07-15-001 — Packet 0 first screen did not express the product promise

- **Status:** corroborated
- **Evidence source:** Product-owner review of the running Packet 0 screen and supplied screenshot on 2026-07-15.
- **Observed fact:** The screen used a generic centered application card, implementation language, and a broad “Begin first memory” action. The product owner did not experience the intended invitation to capture and preserve a loved person's photograph and real voice.
- **Interpretation:** Merely storing Foundation documents in the repository does not make a hard-coded interface conform to them. Each user-facing packet needs explicit document traceability and experience-level review.
- **Confidence and contrary evidence:** High confidence from direct owner feedback. Packet 0 was intentionally a technical bootstrap, so the screen was not evidence that the approved experience itself was wrong.
- **Affected experience or invariant:** First-five-minute emotional arc; I-11 technology stays in the background; I-14 accessibility and global readiness begin at the first screen.
- **Related proposal:** P-2026-07-15-001.

### L-2026-07-15-002 — Task-specific reading paths were implicit

- **Status:** addressed
- **Evidence source:** Repository review on 2026-07-15.
- **Observed fact:** `docs/00_START_HERE.md` established document order, but the repository had no root agent instruction file mapping common implementation tasks to the exact documents, folders, and verification evidence required before action.
- **Interpretation:** A task router and nested folder guidance reduce the chance that an implementation begins from code alone or reviews unrelated documents while missing the governing contract.
- **Confidence and contrary evidence:** High. Existing README files offered useful folder summaries but did not form a complete pre-action route.
- **Affected experience or invariant:** Foundation Rule #000; outcome-driven build order; I-11 technology stays in the background.
- **Related proposal:** Implemented directly as non-behavioral repository governance in the root and nested `AGENTS.md` files.

### L-2026-07-16-001 — Production readiness must preserve a scalable architecture path

- **Status:** addressed
- **Evidence source:** Product-owner approval in conversation on 2026-07-16.
- **Observed fact:** The owner approved the Phase 1 production-ready-not-live boundary, staging/auth/language/Workers AI/Turnstile recommendations, and explicitly required the architecture always to be built to scale.
- **Interpretation:** Scale should be a verified architectural property—statelessness, durable contracts, idempotency, immutable storage, migrations, queues, observability, and environment isolation—not permission for premature services or speculative frameworks.
- **Confidence and contrary evidence:** High confidence from explicit owner direction. No evidence currently requires microservices, Durable Objects, Workflows, or a broad provider registry in the solo flow.
- **Affected experience or invariant:** I-06 immutable originals, I-07 additive history, I-08 truthful durability, I-14 accessibility, I-15 language readiness, I-16 privacy, and I-24 share-to-unlock integrity.
- **Related proposal:** P-2026-07-16-001.
