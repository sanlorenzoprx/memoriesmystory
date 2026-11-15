# E05a — Authorized literal search of the family archive

**Result:** PARTIAL — implemented and locally proven; clean-install CI, hosted identity, device and human acceptance pending.
**Base:** `main` `3106d9d58c7d78d514f3ec660f3adac9b2dd42f4` (PR #47).
**Scope:** the first E05 slice: permission-scoped search over human-entered words, with each match naming its source. Draft and recently-played discovery, date-range filters and any AI-assisted answer are not included.

## Human outcome

An owner can find a Living Memory without knowing its exact title: by its name, a Chapter name, a person they named, what the storyteller said about who, where, when and what, a relative's written recollection, or the words a speaker wrote for their recording. Searching "tia maria" finds "tía María". Each match says where the words came from — for example "Prima Lucía remembered" or "Where the storyteller said it was · approximately" — so a recollection is never shown as a verified fact.

Invited family can search inside their own invitation only, and only over memory names and the recollections the owner included for family. Private Chapters, named people and storyteller context are never searchable by family.

**Promises protected:** private by default with explicit scope; revocation and deletion take effect on the next search; differing recollections stay separately attributed; approximate stays approximate; no inference, ranking by meaning, or generated text.

## Change

- `app/domain/family-search.ts`: accent- and case-insensitive literal matching, a coarse SQL pattern, and a snippet cut from the person's own words without altering them. No stemming or synonyms.
- `worker/family-search.ts`: `GET /resources/family-search?q=…[&grantId=…]`. Session required. Owner mode reads only the caller's own complete memories. Member mode requires the caller's own accepted grant, restricts every row to that grant's memory/Chapter/archive scope, uses only owner-included sources whose contributor grant still holds, and re-checks the grant after the query. Only the storyteller's current answer for each context detail is searched, never a superseded one. Results are bounded (20 memories, 6 matches each) with a `truncated` flag. Responses are `private, no-store`. No query text is stored or logged.
- No migration, index or new storage. No vector database or model call.
- Client: `FamilySearchPanel` on the owner's archive page (results link to the memory) and inside each family invitation (results are not links). English and Spanish.

## Evidence

| Check | Result |
| --- | --- |
| Unit tests (`family-search.test.ts`) | 5 pass: accent/case folding in EN/ES with aligned length, literal-only behaviour, wildcard escaping, bounded query, unaltered snippet |
| Worker tests (`family-search.test.ts`) | 4 pass: title, Chapter, person, current context (approximate kept; superseded not found), recollection with attribution; family limited to scope and to owner-included words; Chapter reference removal, revocation, borrowed grant, stranger, cross-account and deleted memory all return nothing; session, bounds, literal `%`/`_`, cache headers |
| `npm run verify:core` | Pass — typecheck, lint, 260 tests in 58 files, 108 schema objects, build, deploy dry run |
| Browser journeys (EN, ES) | 4 pass: owner failed search recoverable, normalized query, sources named, no-results state; member search bound to the invitation with no private links |
| Full phone-viewport suite locally | 59 pass; 9 not run |
| Staging / hosted Clerk / real device / human | NOT_RUN |

The nine checks not run are all in `tests/e2e/legacy-recording.spec.ts`, which launches its own browser build that is not installed in the review sandbox. Clean-install CI is the authority for the full suite.

## Known limits

- **Scale.** Matching uses `LIKE` over the owner's rows with a 300-row candidate cap. That is adequate for the configured archive limits; measure before adding an index or full-text table.
- **Not searched:** machine transcripts (not human-approved), people notes, relationship labels, drafts, and "recently played".
- **Literal only.** "aunt" does not find "tía"; a date typed differently does not match. That is deliberate for now.
- The owner's search includes relatives' submitted recollections still awaiting review; family search does not.
- No rate limit yet on this route (review finding F3 still applies).

**Reversible:** yes (no schema change). **Production deployed:** no.
