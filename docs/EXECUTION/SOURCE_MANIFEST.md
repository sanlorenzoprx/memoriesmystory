# Canonical Build Source Manifest

## Current authority

- Repository: `https://github.com/sanlorenzoprx/memoriesmystory`
- Development base: current `origin/main`; audited baseline for this scope change is `0d4452eb9ffb78ad22758d00ab32df0fdead0367`.
- Approved scope amendment: `docs/DECISIONS/2026-11-13-expanded-first-release.md`.
- Current acceptance map: `docs/EXECUTION/EXPANDED_FIRST_RELEASE.md`.
- Current implementation/status authority: code, tests and dated receipts; `docs/CURRENT_STATE.md` and `docs/EXECUTION/TASK_QUEUE.json` route ongoing work.

Every implementation slice begins from current protected main (or an explicitly reviewed dependent PR), not a historical packet/doctrine branch or copied prompt. Historical doctrine receipts preserve their original provenance.

## Include

- all tracked current Foundation, Product, Architecture, Execution, Security, Operations, tests, and implementation receipts in the branch/revision being worked;
- validated Packet 1–4 code and evidence unless a current decision explicitly supersedes behavior;
- synthetic photographs/audio created specifically for tests, with no family or production data;
- empty example environment files only.

## Compatibility source rule

`docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md` remains useful historical/technical detail from the pre-Living-Memory campaign. Where it conflicts with the 2026-08-11 decision, Foundation v2, Voluntary Share Policy V2, current User Experience, or current Phase Gates, the newer governing source wins. In particular, no share-to-unlock instruction from that specification is active.

Do not perform broad terminology-only rewrites of validated code or migrations. Existing `MemoryStory` implementation names are compatibility infrastructure beneath the `LivingMemory` aggregate until a functional migration warrants change.

## Exclude

- every legacy repository or ZIP as implementation authority;
- code, schemas, prompts, architecture, configuration, or business rules from another product;
- real family photographs, voices, transcripts, credentials, tokens, private URLs, or production exports;
- generated build output, Playwright reports, Wrangler local state, `.dev.vars*`, and `.env*` except tracked examples;
- superseded Good Karma share-to-unlock behavior.

## Fresh-start check

Before implementation, verify the remote URL, branch/revision, clean worktree, technical identifier `memoriesmystory`, current Living Memory decision, and absence of unrelated repository references. If source authority is ambiguous, stop before changing code.
