# Automated WCAG 2.2 A/AA review (L7)

**Result:** PARTIAL — automated checks pass on every main screen and state in both languages; the screen-reader and real-device review is in the acceptance kit (journey J8).
**Base:** `main` `0d677a5` (PR #76).
**Authority:** V1 launch handoff lane L7 ("WCAG 2.2 AA review"); Product Invariant I-14 (accessibility begins at the first screen).

## What was checked

`tests/e2e/accessibility.spec.ts` runs axe-core with the WCAG 2.0, 2.1 and 2.2 A and AA rules, on a phone-size screen, in English and Spanish (Puerto Rico). It covers 14 page states:
- the first screen;
- the archive;
- the archive with every panel open (search, timeline, albums, export, check an export, email choices);
- the family view;
- a finished memory;
- the one-time sharing agreement;
- capture.

## Finding and fix

| Rule | Where | Fix |
| --- | --- | --- |
| `label-content-name-mismatch` (WCAG 2.5.3 Label in Name), serious | The text-size buttons on every page showed "A", "A+" and "A++" but were announced only as "Use large text". A voice-control user saying "tap A plus" could not reach them | The spoken name now begins with the visible text: "A+, Use large text" (and Spanish "A+, Usar texto grande") |

After the fix, all 14 states report no violations.

## Limits

Automated rules find only part of WCAG. Not covered here:
- screen-reader announcement order;
- focus order in long flows;
- recording controls with VoiceOver and TalkBack;
- the largest text size on real phones;
- colour contrast over photographs.

These are journey J8 in `docs/EXECUTION/ACCEPTANCE_KIT_V1.md`.

## Also fixed: a reload race in unsent contribution media

The full suite showed one intermittent failure in `family-unsent-media.spec.ts`: the photo preview appeared before the photo had been written to the device, so an immediate reload could lose it. A chosen photograph or recording is now kept on the device first, and shown only after. All three contribution suites passed three repeated runs (18 of 18), and the whole suite passed after a clean `npm ci` (97 pass).

## Change

- `app/features/TextSizeControl.tsx`: label in name.
- `app/features/family-archive/FamilyContributionsPanel.tsx`: keep before showing.
- `tests/e2e/accessibility.spec.ts`: new scan.
- Dev dependency `@axe-core/playwright` pinned at 4.14.0 (released 2026-10-15). It never ships to people.

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
