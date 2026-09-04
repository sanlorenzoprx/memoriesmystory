# Decision: Preservation Thesis and First-Story Share Message

**Status:** Accepted  
**Date:** 2026-09-04  
**Approval source:** Explicit product-owner direction in conversation on 2026-09-04.

## Context

The existing first-screen headline already creates loving urgency:

> Old photographs fade. The voices behind them should not.

The product-owner approved a stronger emotional distinction between preserving an image and preserving the person behind it, and asked for that sentiment to appear both on the landing page and in the first Memory Story sharing phase.

## Decision

Add this secondary landing-page thesis without displacing the existing headline or first action:

> **A photograph preserves what they looked like. Their voice preserves who they were in the moment.**

Support it with:

> **You do not have to preserve a lifetime today. Preserve one story before it becomes only a photograph.**

For a deliberate social/native share after a Memory Story is durably preserved, offer this editable default caption:

> **A photograph keeps the image. A voice keeps the person in the moment.**

Optional brand tag:

> **#MemoriesMyStory**

The default caption and tag are optional. A user may edit or remove either without affecting the qualifying share or Good Karma unlock. Private/family sharing may omit social copy entirely.

The application must not automatically insert names, relationships, family facts, story excerpts, transcript text, Muse-generated material, or other private content into the default share text.

## Why

The product is not preserving media for its own sake. The photograph is the doorway; the real voice carries presence, personality, pacing, humor, uncertainty, and the storyteller's own way of remembering.

The approved wording makes that value legible while keeping the action small: one photograph and one story, not an obligation to organize a lifetime.

## Affected invariants

- I-01 — original voice is the primary artifact.
- I-02 — photograph and story belong together.
- I-11 — technology stays in the background.
- I-16 — privacy by default.
- I-21 — sharing is deliberate.
- I-24 — first five Memory Stories use share-to-unlock.

## Boundaries

- Locked completion copy remains unchanged.
- No public sharing is required.
- No hashtag or branded caption is required for unlock.
- No pricing, storage, entitlement, or preservation behavior changes.
- The landing-page copy is implemented now.
- The social-share copy is a binding product/implementation contract for the future share UI; no dead runtime code is added before that UI exists.

## Verification

Current implementation must prove the landing thesis renders on the phone-first first experience.

When the share UI is implemented, acceptance must prove:
- the caption and hashtag are editable/removable;
- private sharing can proceed without social copy;
- removal does not affect unlock eligibility;
- no private or generated story content is inserted automatically.
