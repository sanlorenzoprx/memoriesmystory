# Start Here

This page is the navigation map for product, design, engineering, and AI-agent work on Memories: My Story.

## Foundation Rule #000

Everything that follows is subordinate to the Foundation documents.

When documents conflict, use this priority order:

1. `00_FOUNDING_PRINCIPLES.md` — who we are.
2. `01_PRODUCT_INVARIANTS.md` — what must never change.
3. `99_THE_SOUL_OF_memoriesmystory.md` — why we protect it.
4. `02_PRODUCT_VISION.md` — where we are going.
5. `03_USER_EXPERIENCE.md` — how the experience, beginning with the first five minutes, should feel.
6. `04_TECHNICAL_PRINCIPLES.md` — how we build it.

Database schemas, APIs, prompts, UI components, growth mechanics, pricing, and implementation details must conform to these documents.

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

- `PRODUCT/CORE_EXPERIENCES.md`
- `PRODUCT/GOOD_KARMA_SHARE_POLICY_V1.md`
- `PRODUCT/OPEN_DECISIONS.md`
- `PRODUCT/FOUNDATION_TRACEABILITY.md`

### Architecture

- `ARCHITECTURE/FOUNDATION_STACK.md`
- `ARCHITECTURE/REPOSITORY_STRUCTURE.md`
- `ARCHITECTURE/APP_IDENTITY.md`

### Implementation

- `IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`
- `IMPLEMENTATION/README.md`

## What is settled

- The real voice is the primary artifact.
- A photograph and its story belong together.
- The platform never silently corrects a memory.
- Different recollections are preserved, not reconciled by AI.
- Originals are never overwritten.
- Technology and AI remain in the background.
- Accessibility, multilingual use, portability, and continuity are foundational.
- A completed Memory Story is durably cloud-preserved and can be exported.
- The first build target is one complete, emotionally successful solo Memory Story.
- The first five Memory Stories are free under the Good Karma share-to-unlock sequence; this is a non-negotiable launch rule.
- The completion message is locked exactly: **“This memory is now part of your family's history.”**
- Memories: My Story is a Cloudflare-first web application, not an Android application.
- The first-five-minute experience is approved as the binding first implementation contract in `FOUNDATION/03_USER_EXPERIENCE.md`.
- Camera and microphone permissions are requested only in context; first-use guidance repeats for the first few uses, becomes lighter with confidence, and remains replayable.
- `sanlorenzoprx/memoriesmystory` is the only canonical application repository and begins as a fresh implementation.
- The local repository path is `C:\repos\memoriesmystory`; every technical application identifier uses exactly `memoriesmystory`.

## What remains open

Open product and business questions live only in `PRODUCT/OPEN_DECISIONS.md`. An undecided implementation detail must not be allowed to reopen a settled foundation principle.
