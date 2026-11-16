# Welcome splash for returning signed-in people

**Result:** PARTIAL — implemented and browser-proven with a stubbed server; real-device acceptance pending.
**Base:** `main` `5a37535` (PR #78).
**Authority:** `docs/DECISIONS/2026-11-16-returning-welcome-splash.md`.

## Change

- `app/features/welcome/WelcomeSplash.tsx`, mounted in the app shell. It reads the person's archive (only a verified session can) and picks a random finished memory. It loads that memory's original photograph through the display address, so HEIC works with the Images binding, and shows the splash only once the photo has loaded.
- `app/styles/global.css`: full-screen photo with a slow zoom and fade; still when reduced motion is preferred.
- Copy in `catalog/growth.ts`: "Bienvenido de nuevo" per the owner, plus translated alternative text.

## Evidence

| Check | Result |
| --- | --- |
| Browser `tests/e2e/welcome-splash.spec.ts` | 4 pass: EN and ES, own photograph shown, closes within about three seconds, not again in the same visit; a tap closes it and "Don't show this at start" holds in a new visit; never for a signed-out visitor, a person with no finished memory, or a deep link |
| Existing localization test | Caught an empty `alt` on the photograph; fixed with translated text |
| `npm run verify:core` | Pass — 351 tests in 83 files |
| Full phone-viewport suite locally | 103 pass |

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
