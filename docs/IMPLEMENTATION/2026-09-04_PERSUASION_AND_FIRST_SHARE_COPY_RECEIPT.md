# 2026-09-04 — Persuasion and First-Share Copy Receipt

## Scope

Applied the approved four-part persuasion direction to the current executable Memories: My Story preservation journey and incorporated the product-owner-approved photograph-versus-voice sentiment into the landing page and future first-story social-share contract.

## Customer outcome protected

A person should understand that the product is not merely digitizing a photograph. It keeps the photograph with the real voice and story that give the image human meaning, while making the first action feel small enough to begin.

## Implemented now

Landing experience:
- keeps the existing headline **“Old photographs fade. The voices behind them should not.”**
- adds **“A photograph preserves what they looked like. Their voice preserves who they were in the moment.”**
- adds **“You do not have to preserve a lifetime today. Preserve one story before it becomes only a photograph.”**
- preserves **Capture Your Memories**, **Import a photo**, contextual permissions, privacy promise, and the Photo → Voice → Preserved → Shared journey.

Existing capture/continuity copy in this branch also makes the photograph, voice, local recovery, durable archive, and cross-device benefit more concrete without changing runtime behavior.

## Share-phase contract recorded, not prematurely coded

The share UI is not yet implemented on current `main`. No unused future-share runtime code was added.

When the user deliberately chooses a social/native share after durable preservation, the approved default editable caption is:

> **A photograph keeps the image. A voice keeps the person in the moment.**

Optional tag:

> **#MemoriesMyStory**

The caption and tag:
- are editable/removable;
- are not required for Good Karma unlock;
- may be omitted for private/family link sharing;
- must never automatically include names, relationships, family facts, excerpts, transcript text, Muse-generated content, or other private material.

## Governing updates

- `docs/FOUNDATION/03_USER_EXPERIENCE.md`
- `docs/FOUNDATION/05_PRODUCT_LANGUAGE.md`
- `docs/PRODUCT/GOOD_KARMA_SHARE_POLICY_V1.md`
- `docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`
- `docs/PRODUCT/FOUNDATION_TRACEABILITY.md`
- `docs/DECISIONS/2026-09-04-preservation-thesis-and-first-story-share-message.md`
- Learning observation/proposal and changelog

## Invariants

Protected:
- I-01 original voice
- I-02 photograph + story
- I-11 technology stays in the background
- I-16 privacy by default
- I-21 deliberate sharing
- I-24 first-five share-to-unlock

Unchanged:
- immutable originals;
- truthful durable-save language;
- locked completion sentence;
- no forced public sharing;
- no pricing/commerce/runtime changes.

## Verification

Updated:
- first-experience unit copy contract;
- phone-first E2E first-screen copy acceptance.

Future share implementation must add acceptance proving edit/remove/private-share behavior and independence from caption/tag retention.
