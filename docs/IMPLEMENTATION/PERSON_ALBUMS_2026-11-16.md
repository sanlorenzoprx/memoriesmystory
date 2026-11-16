# L1.1 — Person albums

**Result:** implemented and locally proven; CI, hosted and human acceptance pending.
**Base:** `main` `9211e225006b1ab87feec6d41e694773cecd0c3f` (PR #57).
**Lane:** L1 albums and keepsakes. Owner decision 2026-11-15 (albums, including "a specific person album").

## Human outcome

In "People and relationships", each named person has "Open this person's album". It shows the Living Memories a human linked to that person — photograph and name — each opening the memory. Two people with the same name are two separate albums. Unlinking a memory removes it from the album; removing the person empties it. The page says plainly that nothing is added by recognizing faces or voices.

**Promises protected:** no inferred identity; people stay as a human entered them; private to the owner.

## Change

- `worker/people-routes.ts`: `GET /resources/family-people/person/:id/memories?archiveId=…`, owner only (after the existing archive-ownership check), people only, read-only (any other method is `405`). Returns the person's label and the owner's complete memories in the order linked, with title and the owner's existing photograph address. A removed person returns no memories. No migration.
- `app/services/family-people.ts`: `loadPersonAlbum`.
- `app/features/family-archive/PeoplePanel.tsx`: the album button and view.
- Copy in `app/localization/catalog/albums.ts` (English and Spanish).

## Evidence

| Check | Result |
| --- | --- |
| New Worker test | Linked order and titles; same-name people separate; unlink removes; removal empties; read-only; signed-out refused; another account and relationship records refused |
| New browser journeys (EN, ES) | Album opens with links to each memory; a same-name person shows its own (empty) album; close works |
| `npm run verify:core` | Pass — typecheck, lint, 287 tests in 67 files, 117 schema objects, build, deploy dry run |
| Phone-viewport suite locally | 71 pass; 9 not run (the `legacy-recording.spec.ts` checks cannot launch in this sandbox) |
| Staging / device / human | NOT_RUN |

## Not in this slice

A person album for invited family; sharing or exporting a person album (album export is lane L1.2).

**Reversible:** yes. **Production deployed:** no.
