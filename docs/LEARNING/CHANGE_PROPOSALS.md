# Learning Change Proposals

Proposals turn recorded evidence into reviewable change candidates. Follow `README.md` in this folder before promoting a proposal.

### P-2026-07-15-001 — Docs-grounded Packet 0.1 first screen

- **Status:** approved
- **Triggering observations:** L-2026-07-15-001.
- **Proposed change:** Replace the generic Packet 0 placeholder with a full-screen, mobile-first opening experience using Apple Photos warmth, Airbnb trust, Calm pacing, and Pinterest photo-first discovery as directional references. Lead with “Old photographs fade. The voices behind them should not.” Support it with “Capture a photo. Tell its story. Preserve your voice for the people you love.” Use **Capture Your Memories** as the primary action, **Import a photo** as the secondary action, and show `Photo → Voice → Preserved → Shared` quietly. Keep Muse absent until help is useful and remove internal save, entitlement, and packet language from the first screen.
- **Governing documents:** `../FOUNDATION/03_USER_EXPERIENCE.md`, `../FOUNDATION/05_PRODUCT_LANGUAGE.md`, `../DECISIONS/2026-07-15-first-five-minute-experience.md`.
- **Affected code and tests:** `../../app/routes.tsx`, `../../app/styles/global.css`, route/accessibility checks, and a Packet 0.1 implementation receipt.
- **Product Invariants protected or at risk:** Protects I-11 and I-14; must not weaken I-08 truthful durable-save language or I-12 Muse listens before asking.
- **Privacy, accessibility, and recovery impact:** First screen must remain keyboard accessible, readable with reduced motion and high zoom, mobile-first, private by default, and free of premature permission prompts.
- **Approval required:** Product-owner approval received in conversation on 2026-07-15. Implementation remains subject to visual review.
- **Success evidence:** On a representative phone viewport, a new user can state why the product matters and identify how to capture or import a photograph without reading technical or feature-tour language.
- **Decision or implementation receipt:** Pending Packet 0.1 implementation after repository-guidance review.
