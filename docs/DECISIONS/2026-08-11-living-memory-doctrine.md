# Living Memory Doctrine Ratification

**Status:** approved product-owner decision  
**Date:** 2026-08-11  
**Scope:** constitutional product doctrine, sharing policy, domain vocabulary, build order, and first implementation contracts

## Context

The product foundation already protected authentic voice, source media, family legacy, privacy, continuity, and truthful AI behavior. A subsequent product review clarified the commercial and product mechanism using the sequence **Idea → Mechanism → Product**.

The governing idea is:

> A photograph can outlive the story that gives it meaning.

The governing mechanism is the **Living Memory**: a photograph preserved together with the authentic human voice, story, context, people, place, time, family contributions, provenance, and future resurfacing that give it meaning.

The product is **Memories: My Story**, a private-first Living Memory Archive that makes Living Memories easy to create, enrich, preserve, rediscover, share by choice, and pass down.

## Decisions

1. **Living Memory becomes the canonical customer and product-domain object.** Existing `MemoryStory` persistence and source-grounding contracts remain valid implementation infrastructure and are mapped beneath the Living Memory aggregate rather than discarded.
2. **Privacy-first means private by default and creator-controlled, not private-only.** A Living Memory starts private. The creator deliberately chooses whether a shareable copy leaves the private archive.
3. **Sharing is voluntary and is not exchanged for another free Living Memory.** The prior Good Karma share-to-unlock rule is superseded. Growth must come from the value of the Living Memory itself.
4. **Facebook is the first public social-sharing target for the initial demographic.** WhatsApp is the next priority for family-to-family distribution. External sharing must use a bounded Share Artifact and must not expose private archive metadata by default.
5. **The first-five-minute activation event is `first_living_memory_completed`.** The product must make an ordinary photograph feel materially more valuable after authentic voice and context are preserved with it.
6. **Muse helps people remember.** Muse may ask, structure, retrieve, connect, and present source-grounded material. Muse may not invent or silently replace human memory.
7. **The 20-year product test is:** Does this make a memory more alive, more complete, more connected, more durable, more trustworthy, or easier to rediscover?
8. **The landing page will be replaced in a dedicated product-surface slice.** This ratification branch intentionally does not lock final landing-page design or copy.

## Superseded rules

- Product Invariant I-24 requiring five free stories through share-to-unlock is superseded.
- `GOOD_KARMA_SHARE_POLICY_V1.md` is retained only as a visible historical policy record and points to the replacement voluntary sharing policy.
- Customer-facing `Memory Story` terminology is superseded by `Living Memory`. Existing code/database names may remain temporarily when migration would create risk; they must be treated as persistence compatibility names, not product vocabulary.

## Required downstream behavior

- Foundation, product language, build order, share policy, tests, and domain exports must align with this decision.
- Existing original-media, provenance, truth-state, recovery, identity, and durability work remains valid and must not be weakened.
- No production deployment, landing-page replacement, or database renaming is authorized by this decision alone.
