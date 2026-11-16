# Owner-granted permission for a relative to make albums

**Result:** PARTIAL — implemented and locally proven; CI, hosted identity, device and human acceptance pending.
**Base:** `main` `0be3408b59f98fdc5b0015d16bd66fc7a761cc5f` (PR #53).
**Authority:** owner decision 2026-11-15, answer 2, in `docs/DECISIONS/2026-11-15-albums-reminders-export-tiers.md`.

## Human outcome

For each person who has accepted a family invitation, the owner can turn on "Let this person make albums". That person then sees an "Albums you can make" section in their family view and can create their own albums and Chapters and arrange the memories they were invited to see. Their albums live in the owner's family archive and are marked "Made by a family member"; the owner can rename, change or remove them. The owner can turn the permission off at any time, which stops the relative immediately and leaves the albums with the owner.

A permitted relative cannot see, rename, remove or add to albums the owner or anyone else made, cannot place a memory they were not invited to, and cannot rename a memory.

**Promises protected:** private by default; permission is explicit, per person and revocable; arranging memories never widens anyone's access; originals are untouched (only references are created).

## Change

- Migration `0021_family_album_permissions.sql`: `family_album_permissions` (one row per permitted invitation, owner-only by trigger), append-only `family_album_permission_events`, `family_album_authors` (who made an album, valid only under a live permission), and the Chapter membership rule extended so the recorded maker of an album may place the owner's complete memories in it.
- `worker/family-access-routes.ts`: `POST /resources/family-access/grants/:id/album-permission` (owner only, accepted invitations only); `canOrganizeAlbums` on invitation and membership listings.
- `worker/archive-routes.ts`: the album routes accept `?grantId=` for a relative. The grant must be the caller's own accepted invitation with a permission row. Every read and write is limited to albums that relative made; memories are limited to the invitation's scope; the permission is re-checked inside each write batch; memory naming is refused.
- Client: the owner's switch in the invitations list; the relative's album section, which reuses the album panel without owner-only controls. English and Spanish.

## Evidence

| Check | Result |
| --- | --- |
| New Worker tests | 3 pass: off by default; only the owner can grant, never for a pending invitation; another person's invitation cannot be borrowed; relative sees no owner albums and only invited memories; relative's album belongs to the owner and is marked; out-of-scope memory refused; owner's album cannot be read, renamed, removed, added to or used as a destination; memory naming refused; a second permitted relative cannot touch the first's album; removal and revocation stop access at once and leave albums with the owner; the database refuses an album maker without a live permission |
| Existing album, Chapter and access tests | Pass unchanged, including the native workerd/D1 run |
| `npm run verify:core` | Pass — typecheck, lint, 275 tests in 64 files, 117 schema objects, build, deploy dry run |
| New browser journeys (EN, ES) | 4 pass: no album section without permission; with it, a relative creates a Chapter and every request carries their invitation; owner turns the permission on and off |
| Full phone-viewport suite locally | 69 pass; 9 not run (the `legacy-recording.spec.ts` checks cannot launch in the review sandbox) |
| Staging / hosted Clerk / device / human | NOT_RUN |

## Known limits and open decisions

- **Adding images.** A relative adds images through the existing reviewed photograph contributions. Letting a relative's upload create a new Living Memory in the owner's archive is not built: it touches the owner's plan limits and the photograph-plus-voice definition of a Living Memory, and needs an owner decision.
- A relative's albums count toward the owner's album limit (20).
- Albums a relative made are not automatically shared with other family; only the owner creates invitations.
- If an invitation is deleted with its album, the "made by" record goes with it and the album remains a plain owner album.

Migration 0021 is required before a matching deployment. **Reversible:** yes (additive schema; one trigger replaced). **Production deployed:** no.
