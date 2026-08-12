# Start Here

This page is the navigation map for product, design, engineering, commercial offer, and AI-agent work on Memories: My Story.

Before using this map, read the root `../AGENTS.md`. Folder-level `AGENTS.md` files refine instructions near the work.

## Foundation Rule #000

Everything that follows is subordinate to the Foundation documents.

When documents conflict, use this priority order:

1. `FOUNDATION/00_FOUNDING_PRINCIPLES.md` — who we are.
2. `FOUNDATION/01_PRODUCT_INVARIANTS.md` — what must never change.
3. `FOUNDATION/99_THE_SOUL_OF_memoriesmystory.md` — why we protect it.
4. `FOUNDATION/02_PRODUCT_VISION.md` — where we are going.
5. `FOUNDATION/03_USER_EXPERIENCE.md` — how the experience should feel.
6. `FOUNDATION/04_TECHNICAL_PRINCIPLES.md` — how we build it.

Approved dated decision records explain intentional amendments to locked documents. Database schemas, APIs, prompts, UI components, growth mechanics, pricing, and implementation details must conform to the current Foundation.

## Read in this order

### Constitutional Foundation

- `FOUNDATION/00_FOUNDING_PRINCIPLES.md`
- `FOUNDATION/01_PRODUCT_INVARIANTS.md`
- `FOUNDATION/99_THE_SOUL_OF_memoriesmystory.md`
- `FOUNDATION/02_PRODUCT_VISION.md`

### Experience and implementation guides

- `FOUNDATION/03_USER_EXPERIENCE.md`
- `FOUNDATION/04_TECHNICAL_PRINCIPLES.md`
- `FOUNDATION/05_PRODUCT_LANGUAGE.md`
- `FOUNDATION/06_AI_BEHAVIOR_GUIDE.md`
- `FOUNDATION/07_PRODUCT_DECISION_FRAMEWORK.md`
- `FOUNDATION/08_BUILD_ORDER.md`

### Product control documents

- `PRODUCT/LIVING_MEMORY_DEFINITION.md`
- `PRODUCT/MEMORY_CIRCLE_DEFINITION.md`
- `PRODUCT/LIVING_MEMORY_SHARE_POLICY_V2.md`
- `PRODUCT/LIVING_MEMORY_ANTI_DRIFT_CHECKLIST.md`
- `PRODUCT/CORE_EXPERIENCES.md`
- `PRODUCT/CANONICAL_SCOPE.md`
- `PRODUCT/OPEN_DECISIONS.md`
- `PRODUCT/FOUNDATION_TRACEABILITY.md`

### Commercial / landing implementation contracts

These documents define current commercial hypotheses and the public page implementation beneath the Foundation. They may evolve through evidence without changing the core product doctrine.

Read the current versions in this order:

- `PRODUCT/LIVING_MEMORY_OFFER_V1.md`
- `PRODUCT/LIVING_MEMORY_LANDING_PAGE_BUILD_CONTRACT_V2.md`
- `PRODUCT/LIVING_MEMORY_PUBLIC_COPY_STANDARD_V1.md`
- `PRODUCT/LIVING_MEMORY_PROOF_LEDGER_V1.md`
- `PRODUCT/LIVING_MEMORY_LANDING_VISUAL_DIRECTION_V3.md`

Current precedence for landing work:

- Build Contract V2 governs section/order/conversion structure.
- Public Copy Standard V1 governs visible customer language.
- Proof Ledger V1 governs what may be claimed and how proof is labeled.
- Visual Direction V3 governs Rendering 3 density, type scale, pacing, and visible copy treatment.

The following remain historical inputs superseded where current contracts conflict:

- `PRODUCT/LIVING_MEMORY_LANDING_PAGE_BUILD_CONTRACT_V1.md`
- `PRODUCT/LIVING_MEMORY_LANDING_VISUAL_DIRECTION_V1.md`
- `PRODUCT/LIVING_MEMORY_LANDING_VISUAL_DIRECTION_V2.md`
- `PRODUCT/GOOD_KARMA_SHARE_POLICY_V1.md`

## What is settled

- The governing idea is: **A photograph can outlive the story that gives it meaning.**
- The canonical product mechanism and customer object is the **Living Memory**.
- Memories: My Story is a private-first **Living Memory Archive**, not a generic photo app, storage service, social network, genealogy database, journal, or AI biography generator.
- Existing `MemoryStory` code/database names are compatibility infrastructure beneath the Living Memory aggregate until a migration has real product value.
- Original photographs, recordings, and attributed human testimony remain canonical.
- Muse helps people remember and never silently manufactures testimony.
- Different recollections are preserved, not reconciled by AI into false certainty.
- Originals are never overwritten.
- Privacy-first means private by default and creator-controlled, not private-only.
- External sharing uses a bounded Share Artifact internally; public copy translates this into plain language such as “a copy you choose to share.”
- Sharing is voluntary and does **not** unlock another free Living Memory.
- Facebook is the first public social-sharing priority; WhatsApp follows for family-to-family distribution.
- The first-five-minute activation event is `first_living_memory_completed`.
- The first-five-minute product sequence is **Photo → Voice → Muse → Preserved → Playback → Invite/Share**.
- One complete first Living Memory is the free Magic Moment; paid scope begins with Chapter.
- The free Magic Moment is intentionally repeated as the primary landing conversion at contextually appropriate points rather than shown only in the hero.
- Customer-facing copy targets approximately **grade 6–7 readability** with **grade 8 as the normal maximum**, while preserving adult tone and enough context to keep meaning clear.
- Internal terms such as mechanism, source-grounded, provenance, attributed recollections, affect, retrieval, and bounded Share Artifact should not appear in ordinary customer copy when familiar words can carry the meaning.
- The initial commercial test ladder is **Chapter $247 → Life $747 → Family $1,497**, subordinate to evidence and cost validation.
- Target paid source voice entitlement is up to 10 minutes per Living Memory; the free first Living Memory targets the same complete experience unless cost evidence requires a change that still preserves the Magic Moment.
- Live **Memory Circle** is included in Life and Family.
- Memory Circle means remembering around one photograph from anywhere: same room, remote live, hybrid, or later attributed contribution. Public copy should explain this simply as sharing the moment of telling a photograph's story together.
- Before direct customer proof exists, landing proof must clearly distinguish mechanism demonstration, premise research, and technical product evidence. Customer proof may never be fabricated.
- Landing-page pacing favors one dominant idea per section, large readable type, generous negative space, and progressive disclosure over compressed information density.
- Rendering 3 specifically targets roughly **40–50% less visible information per viewport than Rendering 2** while retaining the full persuasion sequence over a longer page.
- The long-term value ladder is **Moment → Chapter → Life → Family**.
- Accessibility, multilingual use, portability, offline recovery, cross-device continuity, and legacy stewardship are foundational.
- The completion message remains: **“This memory is now part of your family's history.”**
- `sanlorenzoprx/memoriesmystory` is the only canonical application repository.

## Current sequencing

The Living Memory doctrine/domain slice is ratified on the stacked development line. The active task is the landing-positioning slice: define and then replace the public surface around **Idea → Photo → Voice → Living Memory → Magic Moment → Chapter / Life / Family** without disturbing the existing capture/recovery runtime.

The next visual/code work must follow Build Contract V2 + Public Copy Standard V1 + Proof Ledger V1 + Visual Direction V3.

Rendering 3 should test only three primary questions:

1. Can she comfortably read it?
2. Does she understand and believe how a Living Memory works?
3. Does she keep finding a natural invitation to try one photograph herself?

## What remains open

Open product and business questions live in `PRODUCT/OPEN_DECISIONS.md`. An undecided implementation detail must not reopen a settled foundation principle.
