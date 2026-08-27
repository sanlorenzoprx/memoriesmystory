# Application Task Guide

These instructions apply to work under `app/`.

## Read before changing user experience

1. `../docs/FOUNDATION/03_USER_EXPERIENCE.md`
2. `../docs/FOUNDATION/05_PRODUCT_LANGUAGE.md`
3. `../docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`
4. `../docs/DECISIONS/2026-07-15-first-five-minute-experience.md`
5. `../docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`
6. The current route, feature, style, and test files affected by the task.

## Route responsibilities

- `routes/`: screens, loaders, actions, resource routes, error states, and route-level recovery.
- `features/`: complete user outcomes such as capture, recording, review, and sharing.
- `domain/`: product truth such as provenance, truth state, ownership, and durable state transitions.
- `services/`: narrow infrastructure boundaries used by the domain or a feature.
- `localization/`: message catalogs, locale behavior, and mixed-language support.
- `styles/`: accessible tokens, responsive behavior, and shared presentation rules.

Route modules coordinate user outcomes. They must not become a home for durable business rules or vendor-specific storage behavior.

## First-five-minute UI rules

- Design mobile-first and verify at a representative phone viewport.
- Keep the photograph visually dominant once selected.
- Request camera and microphone permissions only when the related action begins.
- Use human, calm language; do not expose architecture, AI models, or internal packet language.
- Preserve progress across route, network, sign-in, and processing interruptions.
- Never show the locked completion sentence before durable originals and ownership metadata are confirmed.
- Keep Muse invisible until help is useful, then ask one warm question at a time.

## Verification

At minimum, run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Add route and accessibility evidence appropriate to the user outcome. Record a packet receipt for material changes.
