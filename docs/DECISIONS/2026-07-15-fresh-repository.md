# Decision: Fresh Canonical Repository

**Status:** Accepted  
**Date:** 2026-07-15  
**Canonical repository:** `sanlorenzoprx/memoriesmystory`
**Local repository:** `C:\repos\memoriesmystory`  
**Technical application name:** `memoriesmystory`

## Context

Memories: My Story needs one clean implementation source that begins from the approved Foundation and Phase 1 experience contract.

## Decision

`sanlorenzoprx/memoriesmystory` is the only canonical application repository.

The canonical local checkout is `C:\repos\memoriesmystory`. Every technical application identifier uses `memoriesmystory`; the display brand **Memories: My Story** remains human-facing copy.

The repository begins from the combined documentation package containing:

- the constitutional Foundation;
- approved product rules;
- the Cloudflare-native technical foundation;
- the Phase 1 solo Memory Story build specification;
- decision records, tests structure, and implementation placeholders.

No application code, schema, migration, provider layer, compatibility boundary, test, or business rule is inherited from another codebase.

## Alternatives considered

### Begin with a broad pre-existing application structure

Rejected because it would carry assumptions that were created before the Foundation and first-five-minute contract were settled.

### Merge several application histories

Rejected because it would create competing sources of truth and obscure which behavior was actually approved.

## Affected Product Invariants

- I-06 Originals are immutable.
- I-07 History is additive and attributable.
- I-08 “Saved” means durably confirmed.
- I-11 Technology stays in the background.
- I-22 Limits are centrally configurable.

## Evidence required

- The repository begins from the combined package.
- Repository-wide search finds no references to another repository or application history.
- Initial implementation creates only the React Router/Cloudflare baseline required by Packet 0.
- Every later build packet produces a commit and verification receipt.

## Consequences and follow-up

- Packet 0 is a fresh repository bootstrap, not a migration.
- There is no backward-compatibility obligation to an unimplemented schema or runtime.
- Any proposed code import requires a new explicit decision; the default is to implement from the approved contracts.
