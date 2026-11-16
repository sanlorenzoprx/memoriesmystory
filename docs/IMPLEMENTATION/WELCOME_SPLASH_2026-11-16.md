# Welcome splash for returning signed-in people

**Result:** PARTIAL — implemented and browser-proven with a stubbed server; real-device acceptance pending.
**Base:** `main` `5a37535` (PR #78).
**Authority:** `docs/DECISIONS/2026-11-16-returning-welcome-splash.md`.

## Change

- `app/features/welcome/WelcomeSplash.tsx`, mounted in the app shell. It reads the person's archive (only a verified session can) and picks a random finished memory. It loads that memory's original photograph through the display address, so HEIC works with the Images binding, and shows the splash only once the photo has loaded. The splash holds the photograph only: no words, no buttons (owner: "the image is all the meaning [the] splash screen needs").
- `WelcomeSplashSetting` in the archive (`ArchiveExperience.tsx`), shown once a memory is finished: "Show one of my photographs when I open the app".
- `app/styles/global.css`: full-screen photo with a slow zoom and fade; still when reduced motion is preferred.
- Copy in `catalog/growth.ts`: translated alternative text and the archive setting label. The earlier greeting and sentences were removed.

## Evidence

| Check | Result |
| --- | --- |
| Browser `tests/e2e/welcome-splash.spec.ts` | EN and ES: own photograph shown with no visible text and no buttons, closes within about three seconds, not again in the same visit; a tap closes it; the archive setting turns it off and back on across visits; never for a signed-out visitor, a person with no finished memory, or a deep link |
| Existing localization test | Caught an empty `alt` on the photograph; fixed with translated text |
| `npm run verify:core` | Pass — 351 tests in 83 files |
| Full phone-viewport suite locally | 103 pass |

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
