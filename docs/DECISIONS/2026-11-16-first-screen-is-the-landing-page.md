# Decision: the first screen is the landing page (G04)

**Status:** Accepted (owner decision 2026-11-16)
**Date:** 2026-11-16

## Context

The V1 launch handoff listed G04: "A public page that explains the product in English and Spanish and leads to capture. Synthetic demonstration media only." The current first screen already does this: it states the promise, leads straight to capture or import, makes the privacy promise, and shows the Living Memory journey, in English and Spanish. That screen is governed by `docs/FOUNDATION/03_USER_EXPERIENCE.md` and the 2026-07-15 first-five-minute decision, which rejects beginning with a product tour.

## Decision

The owner chose, in their words, to "keep the first screen as the landing page". No separate marketing page and no demonstration section are built for V1. G04 is satisfied by the existing first screen. Arrivals from a share page are attributed through `?ref=` on that same screen (PR #67).

## Alternatives considered

- A short demonstration (synthetic photograph and voice) below the first actions.
- A separate public page that links to capture.

Both were set aside: they would change a locked first-screen contract and delay a person's first memory.

## Affected Product Invariants

- **I-11 Technology stays in the background:** preserved.
- **I-14 Accessibility and global readiness begin at the first screen:** preserved.

## Evidence required

The existing first-experience and localization browser journeys continue to pass.

## Consequences and follow-up

Lane L4 is complete. Any future landing or marketing page needs a new decision record.
