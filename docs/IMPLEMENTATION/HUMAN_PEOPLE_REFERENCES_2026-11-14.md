# E02 — Human-entered people and relationship references

Base: current main `2d226f56ecf68d008d4ca3f26744dae774743b40`, after the owner-private Chapters implementation and cloud-check extension. The complete V2 handoff explicitly requests human-entered people/relationships; this adds no identity inference or new provider.

## Outcome and boundaries

An archive owner can optionally add named, unnamed or ambiguous people, personal notes, date wording with known/approximate/unknown precision, and references to owned complete Living Memories. Unknown/omitted dates contain no invented date. Identical names create independent records. An owner can state a relationship in their own words and retain their stated uncertainty. A deliberate same-person link preserves both entries and their histories; removing the link reverses that association without merging records or media.

The optional People panel is collapsed until requested and does not add work to initial capture. English/Spanish controls translate interface text, never personal names, date wording or notes. Failed person/relationship saves retain their draft and idempotency key. Canonical reads precede saved notices. Unsaved person and relationship edits participate in archive-change protection alongside Chapter edits. Source references are metadata; no original bytes are copied, changed or deleted.

Migration 0015 adds owner-private records and additive attributed version history. People removal marks the reference inactive and preserves history; explicit restoration creates a new version. Earlier human versions can prepare a new edit. Relationships involving inactive entries are hidden from the current assembly until those entries are deliberately restored. The owner-only history interface returns the newest 50 versions; all versions remain in D1 for complete export work. Archive-container removal removes its organizational metadata, including people/history, without touching underlying Living Memories or originals, consistently with E01.

Routes require the archive owner's account session, CSRF checks, bounded input, valid owned memory references and same-archive active people. Conversation guest cookies and share artifacts confer no rights. Mutations commit the version change, operation receipt and attributed history in one D1 batch. Retried requests replay their receipt; stale or changed requests cannot overwrite later testimony. Identity/ownership fields are immutable. Central technical limits bound records, reference count, text and reads; these are not paid-plan promises. No face matching, automatic identity merge, inferred genealogy, external records or AI adjudication is used.

## Verification

Six new route tests passed: same-name separation and unchanged originals; attributed correction/removal/restoration history; retry/no duplicate history and stale rejection; unrelated-account/CSRF/foreign-memory denial; uncertain relationships/reversible links; unnamed and unknown references. The existing native workerd/D1/R2 bulk organization test now also commits actual person creation, idempotent retry, correction and stale rejection, verifies both attributed versions, and checks all 120 memories and original object keys/ETags remain unchanged.

Local core verification passed 217 tests plus schema integrity/foreign keys/69 required objects, typecheck, lint, build and Cloudflare dry run. A subsequently added malformed-success/fallback API check passed separately, with typecheck/lint and build rerun (218 total unit/integration checks across the suite). Both new phone-browser journeys passed in English/Spanish, proving recovery with the same request key, retained human uncertainty and independent same-name entries. The full 51-test phone-browser suite also passed, including all earlier capture, scans, recording, Chapters, localization and recovery journeys. Clean-install CI remains pending at the time of this entry.

The preceding E01 cloud run 43634180628 passed with confirmed cleanup; it pins the E01 candidate and does not claim this E02 code was cloud-tested. No full staging application or production deployment, real-human acceptance or complete V2 release is claimed. Apply migration 0015 before deploying this Worker/client candidate. Existing large-bundle warning remains.

Anti-drift: human-sourced context and recoverable attribution protect I-03–I-09/I-25; private owner-scoped retrieval protects I-19; uncertainty and independent recollections protect I-05–I-07; immutable originals and honest acknowledgements protect I-08/I-10; optional bilingual controls and recovery support I-15/I-17/I-18. No sharing or reward changes. Next is E03 least-privilege family invitations and roles, with separate contribution authority and immediate revocation checks.

## Merged result

PR #42 merged as `a0c4500e3223e755e574332e511922f362c057a0` after clean-install CI 43635510632 passed all 218 unit/integration tests and 51 phone-browser checks. The reviewed source head was `4bf4ea93b35b3247651da5129f59a7860a53024c`. E02 human/device and hosted identity acceptance remain distinct from automated proof. E03 invitation/permission implementation now follows on current main.
