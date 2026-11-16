# Decision: a welcome splash for returning signed-in people

**Status:** Accepted (owner decision 2026-11-16)
**Date:** 2026-11-16

## Context

The owner asked for a brief welcome when a verified, signed-in person returns: one of their own Living Memories, as a reminder of what they have built and can build. The first-five-minute experience (`2026-07-15-first-five-minute-experience.md`) must not change: a new person's first three interactions stay exactly as they are.

## Decision

In the owner's words: "this occurs after someone has become a verified signed in user… a splash screen of one of the living legacy the user has created 3 seconds… just a reminder of what they can build or have built. Does not mess with the 1st 5 min experience."

- **Who sees it:** only a person whose verified session can read their archive and who has at least one finished Living Memory. A new visitor, a signed-out person, or someone with no finished memory never sees it.
- **What it shows:** one of their own Living Memory photographs, chosen at random, with a gentle line: "You have preserved N Living Memories. Every photograph has a story. Which one is next?" The photo slowly zooms and fades; it stays still when the device asks for reduced motion.
- **How long:** about three seconds, then it closes by itself. Any tap or key closes it sooner.
- **When:** once per visit, on the start screen or the archive only. Never on a deep link (a reminder's start link, or a referral).
- **Turning it off:** "Don't show this at start" turns it off on that device.
- **Spanish greeting:** "Bienvenido de nuevo", the owner's chosen wording.

## Alternatives considered

- A favourite photograph chosen by the person. Deferred: random keeps the reminder fresh and needs no extra setting. A favourite can be added later.
- Showing it to every visitor. Rejected: it would change the first five minutes.

## Affected Product Invariants

- **Private by default:** preserved. The photograph is shown only to its owner after verified sign-in.
- **I-11 Technology stays in the background:** preserved. The splash is short, skippable and can be turned off.
- **I-14 Accessibility:** preserved. Reduced motion is respected; the photograph has translated alternative text; the automated WCAG scan stays clean.

## Evidence required

Browser tests for showing, closing, once per visit, turning off, and never for new visitors, people without memories, or deep links.
