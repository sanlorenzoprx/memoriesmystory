# Albums that hold Chapters — wording and starter ideas

**Result:** PARTIAL — implemented and locally proven; CI, device and human acceptance pending.
**Base:** `main` `a9b226836eb3f6328743e1399455fda6600bf956` (PR #52).
**Authority:** owner decision 2026-11-15, `docs/DECISIONS/2026-11-15-albums-reminders-export-tiers.md` (accepted).

## Human outcome

The family archive is organized as **Album → Chapter → Living Memory**. An owner makes an album such as "Family vacation" and organizes it with Chapters such as "Places we visited". When creating an album the page offers name ideas — Family holidays, Vacations, About one person, A family home, A family tradition. An idea only fills in the name; nothing is created until the person chooses and saves.

## Change

- The existing container that already held Chapters was labelled "private archive". It is now labelled **Album** throughout the organization panel and the family invitation scope wording, in English and Spanish. No stored data, route or migration changed.
- Starter album ideas and a one-line explanation of albums and Chapters were added to the album settings.
- `docs/FOUNDATION/05_PRODUCT_LANGUAGE.md` gains the term **Album** by explicit owner decision; "Chapter" keeps its meaning.
- The decision record is updated from proposed to accepted with the owner's five answers.

## Evidence

| Check | Result |
| --- | --- |
| `npm run verify:core` | Pass — typecheck, lint, 272 tests in 63 files, 108 schema objects, build, deploy dry run |
| New browser journeys (EN, ES) | 2 pass: album label shown; an idea fills the name and creates nothing; saving creates the album with the chosen name |
| Full phone-viewport suite locally | 65 pass; 9 not run (the `legacy-recording.spec.ts` checks cannot launch in the review sandbox) |
| Staging / device / human | NOT_RUN |

## Not yet built from the same decision

- Person albums (a named person's memories gathered as an album).
- Owner-granted permission for an invited relative to organize albums.
- Album export.
- Email reminders and invitations through Cloudflare Email.

**Reversible:** yes (wording only). **Production deployed:** no.
