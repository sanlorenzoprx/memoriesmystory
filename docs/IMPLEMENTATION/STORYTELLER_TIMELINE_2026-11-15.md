# E06a — Timeline from the storyteller's own words

**Result:** PARTIAL — implemented and locally proven; clean-install CI, hosted identity, device and human acceptance pending.
**Base:** `main` `d71d181ce3fa13cfd2df25c0936f1528eec2f888` (PR #48).
**Scope:** the timeline half of E06. Opt-in resurfacing (reminders) is not built.

## Human outcome

An owner can open a timeline of their completed Living Memories ordered by the year the storyteller named. Each entry shows the storyteller's own words about when ("verano de 1950, creo"), marked as approximate when they said so. A memory whose "when" has no year ("one Christmas") is kept under "Remembered without a year". A memory with an unknown, omitted or never-asked date is kept under "Date not known", with the reassurance that no date is needed.

**Promises protected:** approximate, unknown and omitted are valid answers; no date is inferred or reformatted; nothing is silently placed on a calendar date; the storyteller's words are shown unchanged.

## Change

- `app/domain/family-timeline.ts`: `yearWrittenIn` returns a four-digit year only when the person wrote one ("the 1950s", "'50", an age or a longer number give none); `groupTimeline` separates dated, remembered-without-a-year and unknown.
- `worker/family-timeline.ts`: `GET /resources/family-timeline`, owner only, the caller's complete memories with the storyteller's current "time" answer (a superseded answer is never used). `private, no-store`. Bounded at 500 entries with a `truncated` flag. No migration.
- There is no family mode: storyteller context is private to the owner under the current access rules.
- Client: `FamilyTimelinePanel` on the archive page, English and Spanish.

## Evidence

| Check | Result |
| --- | --- |
| Unit tests | 2 pass: year only when written; undated and unknown kept apart |
| Worker test | 1 pass: current answer unchanged, approximate kept, superseded answer and other context kinds ignored, unknown kept, another account sees nothing, session and method checks |
| `npm run verify:core` | Pass — typecheck, lint, 263 tests in 60 files, 108 schema objects, build, deploy dry run |
| Browser journeys (EN, ES) | 2 pass: recoverable failure, ascending years, approximate wording, undated and unknown sections |
| Full phone-viewport suite locally | 61 pass; 9 not run |
| Staging / hosted Clerk / real device / human | NOT_RUN |

The nine checks not run are all in `tests/e2e/legacy-recording.spec.ts`, which launches its own browser build that is not installed in the review sandbox. Clean-install CI is the authority for the full suite.

## Known limits and open decisions

- **Resurfacing is not built.** Reminders need two owner decisions first: the delivery channel (in-app only, email, or push — the last two add a provider and stored contact consent) and the cadence wording shown to the person. The handoff requires opt-in, transparent cadence and a verified opt-out.
- Ordering uses the first year written; "between 1948 and 1951" is placed at 1948 and still shows the full words.
- Only the storyteller's "time" detail is used. Dates on named people and contributors' recollections are not placed on the timeline.
- Family members have no timeline.

**Reversible:** yes (no schema change). **Production deployed:** no.
