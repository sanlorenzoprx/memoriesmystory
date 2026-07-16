# Packet 0.1 First-Screen Receipt

**Date:** 2026-07-15

**Branch:** `packet-0/bootstrap`

**Application:** `memoriesmystory`

**Scope:** Docs-grounded first-screen design direction

## User outcome

A new visitor meets one loving idea, one photograph-first moment, and one obvious next action before encountering accounts, permissions, product mechanics, or Muse.

The opening experience now says:

> Old photographs fade. The voices behind them should not.

> Capture a photo. Tell its story. Preserve your voice for the people you love.

The primary action is **Capture Your Memories**. The secondary action is **Import a photo**.

## Foundation traceability

| Implementation choice | Governing source | Protected invariant |
| --- | --- | --- |
| Loving urgency before setup or features | `FOUNDATION/03_USER_EXPERIENCE.md`, 0:00–0:30 | I-11 Technology stays in the background |
| Large “Hold a photograph here” keepsake surface | Photograph-first experience contract | I-02 Photograph and voice remain bound |
| Quiet `Photo → Voice → Preserved → Shared` sequence | Approved first-five-minute emotional arc | I-11, I-14 |
| Muse absent from the first screen | First-five-minute decision and Muse behavior | I-12 Muse listens before asking |
| No “saved,” processing, entitlement, model, or packet language | UX prohibited-language rules | I-08, I-11 |
| Privacy reassurance without a sharing wall | Family visibility and first-screen proposal | I-16 Family controls visibility |

## Visual direction implemented

- Full-viewport responsive composition rather than a centered application card.
- Mobile-first ordering with the keepsake photograph surface presented before the copy block.
- Warm paper, soft light, subtle grain, archival-photo framing, and restrained terracotta accents.
- Photo and voice iconography drawn as accessible inline SVG rather than adding a third-party asset or visual dependency.
- Large touch targets, visible keyboard focus, reduced-motion handling, forced-colors support, and a skip link.
- Responsive transitions at compact, tablet, desktop, and short-desktop viewports.

## Code boundaries

- Approved opening copy and the four-stage sequence live in `app/features/first-experience/content.ts`.
- `app/routes.tsx` coordinates the home and first-photograph introduction routes.
- `app/styles/global.css` owns the responsive visual system for this packet.
- `tests/unit/first-experience.test.ts` locks the approved copy, actions, sequence, and absence of Muse/AI/internal save language.

The Markdown Foundation documents remain design-time sources of truth. The running application does not parse them. Traceability is enforced through the repository task guide, tests, and this receipt.

## Validation performed

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Results:

- TypeScript application and Worker checks passed.
- ESLint passed.
- Vitest passed: 2 files, 4 tests.
- Vite production build passed.
- `git diff --check` passed.

## Visual acceptance status

Automated screenshot rendering was attempted but not claimed as evidence: the local Playwright package had no browser binary, and the connected cloud browser blocks loopback development URLs. The responsive structure and accessibility fallbacks were code-reviewed, but product-owner visual acceptance remains required on the locally running branch.

## Deliberately deferred

- Camera and library permission requests.
- Image selection, preview, quality guidance, and local draft persistence.
- Durable D1/R2 preservation and truthful save states.
- Voice recording and playback.
- Muse assistance, processing, review, and sharing.

The first-screen actions lead into the photograph introduction without claiming those deferred capabilities are complete.
