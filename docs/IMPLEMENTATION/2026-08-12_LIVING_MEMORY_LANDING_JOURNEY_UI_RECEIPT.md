# Living Memory Landing + Journey UI Implementation Receipt

**Date:** 2026-08-12  
**Branch:** `agent/living-memory-landing-visual`  
**Stacked base:** `agent/living-memory-landing-contract`  
**PR:** #6  
**Status:** implementation complete for public/identity/creation/checkout-shell/thank-you visual slice; Stripe payment execution remains a separate blocked dependency

## Governing sources revalidated

- `docs/PRODUCT/LIVING_MEMORY_LANDING_PAGE_BLUEPRINT_V1.md`
- `docs/PRODUCT/LIVING_MEMORY_PUBLIC_COPY_STANDARD_V1.md`
- `docs/PRODUCT/LIVING_MEMORY_PROOF_LEDGER_V1.md`
- `docs/PRODUCT/LIVING_MEMORY_LANDING_VISUAL_DIRECTION_V3.md`
- `docs/PRODUCT/LIVING_MEMORY_OFFER_V1.md`
- Foundation Living Memory doctrine

## Implemented customer journey

### Free Living Memory

`landing → sign in → create → existing recoverable capture runtime`

The landing CTA carries `intent=free`. After a successful Clerk session, the customer returns directly to `/create` instead of returning to the landing page or choosing the free offer again.

### Paid offer

`landing → select Chapter/Life/Family → sign in → matching checkout shell`

The selected offer survives sign-in as an explicit offer identifier. After sign-in, the customer is routed directly to `/checkout/<offer>`.

The product never asks the customer to select the same paid offer twice.

## Shared brand shell

Landing, identity, creation, capture, checkout, thank-you, and archive routes share one header/footer implementation and one visual token system.

The shared system includes:

- navy / cream / gold palette;
- editorial serif headings and highly readable body copy;
- common button hierarchy;
- common navigation;
- common privacy/trust language;
- common responsive behavior;
- same simplified heart + human-voice-wave mark in the header and browser favicon.

The older Packet 1–4 capture/archive behavior is not rewritten. A presentation-only override layer maps the proven capture/archive surfaces into the current Living Memory visual language while preserving the existing offline, recovery, media, and account behavior.

Customer-facing archive language now uses **Living Memory / Living Memories / Family Archive** rather than exposing older compatibility terminology such as `MemoryStory`.

## Hero decision

Current implementation headline:

> **Your voice turns a photograph into a Living Memory.**

Supporting line:

> **A photograph shows the moment. Your voice tells the story behind it.**

Rationale: the headline contains the object (photograph), customer action (voice), transformation (turns), and named outcome (Living Memory) in one plain-language sentence.

## Landing implementation

The implementation follows the full Blueprint rather than the compressed early renderings. Separate paced sections cover:

1. Idea / hero;
2. Magic Moment demonstration;
3. free invitation;
4. problem;
5. stakes;
6. desired future;
7. proof;
8. free invitation after proof;
9. mechanism;
10. ease;
11. Muse trust;
12. free invitation after Muse;
13. Memory Circle;
14. privacy;
15. voluntary sharing;
16. Moment → Chapter → Life → Family;
17. what a Living Memory can hold;
18. category difference;
19. memorial / legacy belief;
20. free-before-price bridge;
21. Chapter / Life / Family offer;
22. obstacle/value stack;
23. customer-proof evolution;
24. trust;
25. FAQ;
26. final free CTA.

Free calls to action remain contextual entrances to the same one-free-Living-Memory entitlement. No share-to-unlock or artificial scarcity was added.

## Login / identity UX

Clerk remains the identity provider.

The sign-in surface is visually integrated into the brand journey. It changes supporting copy based on customer intent:

- free Living Memory;
- paid checkout;
- archive continuation.

The identity layer preserves the existing account-session and local-draft claim behavior rather than replacing it.

## Creation UX

`/create` is a new branded handoff into the proven capture runtime.

It gives two explicit choices:

- **Capture Your Memories** — camera path;
- **Import a photo** — existing-device path.

The page explains the customer sequence in plain language:

**Photo → Voice → Muse → Living Memory**

## Checkout boundary

A branded, signed-in checkout shell exists for:

- Chapter — $247 one-time;
- Life — $747 one-time;
- Family — $1,497 one-time.

The checkout presents the selected offer and purchase summary.

**Stripe payment processing is not implemented in this repository at this point.** No fake payment flow and no local raw-card collection were added. The payment control remains disabled until a real Stripe session/Elements/Checkout integration is implemented and server-validated.

The thank-you route exists as the intended post-payment handoff and does not claim payment occurred unless a future payment integration routes to it after verified success.

## Browser identity

`public/favicon.svg` now uses the same navy/gold heart + voice-wave mark as the application header.

`index.html` sets the matching theme color, favicon, product title, and Living Memory description.

## Tests migrated / added

The legacy E2E tests previously treated `/` as the direct capture launcher. They were updated to the new product truth:

- landing promise + free CTA;
- free CTA → sign-in intent → creation;
- `/create` → camera/import capture paths;
- all existing photograph recovery, offline, camera permission, audio durability, reload recovery, and keyboard-access behavior underneath.

A commercial journey spec was added for:

- Chapter selection → sign-in intent → matching checkout;
- shared brand banner across landing/create/checkout/thank-you;
- shared favicon;
- thank-you handoff.

## Validation history

- First implementation run: typecheck caught a narrow TypeScript offer-ID issue in identity intent handling. Fixed by explicit `OfferId | null` narrowing.
- Next run: full compile/build/unit/E2E validation passed after migrating the existing capture tests to the new `/create` entry.
- Additional commercial-congruence E2E run: one assertion failed because the brand home link correctly exists in both header and footer and the test used an unscoped strict locator. The test was corrected to assert the brand link inside the page banner specifically. No product behavior was changed to satisfy that test.

Final head must pass the full repository CI before this receipt is treated as validated.

## Known follow-on work

1. Connect Stripe using a real server-side validated checkout/session boundary.
2. Route verified Stripe success to the thank-you handoff and persist entitlement evidence.
3. Make the header account-aware (`Sign In` vs `My Archive`) when Clerk is configured without breaking the local no-Clerk development path.
4. Replace synthetic/CSS product illustration media with licensed, generated, or explicitly consented production assets.
5. Validate 10-minute source-voice economics before publishing it as a hard entitlement.
6. Add real permissioned customer proof as it becomes available; do not fabricate placeholders.
7. Run visual/manual accessibility review on desktop, phone, and tablet after staging deployment.

## Anti-drift result

**Idea strengthened:** yes — the public surface teaches why a photograph alone can lose its story.  
**Mechanism strengthened:** yes — Living Memory is demonstrated as photo + authentic voice + context.  
**Customer value:** yes — the page leads to one free Magic Moment and paid preservation scope.  
**Source authenticity preserved:** yes.  
**Privacy preserved:** yes.  
**Ownership preserved:** yes.  
**Cross-device behavior:** existing Clerk/archive behavior preserved.  
**Offline behavior:** existing recoverable capture behavior preserved and retested.  
**AI role:** Muse supports the memory; it does not author it.  
**Does this make the memory more alive, complete, durable, connected, trustworthy, or retrievable?** **YES**.
